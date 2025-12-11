import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { createError, ERROR_CODES } from '../lib/constants';
import { logger } from '../utils/logger';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate);

// GET /api/messages/conversations - Get all conversations for the user
router.get('/conversations', async (req: AuthRequest, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const agentId = req.query.agentId as string | undefined;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const messageCount = req.query.messageCount as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const where: any = {
      userId: req.user!.id,
    };

    if (agentId) {
      where.agentId = agentId;
    }

    if (search) {
      where.OR = [
        { externalNumber: { contains: search } },
        // You could also search by contact name if you join contacts
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      where.lastMessageAt = {};
      if (startDate) where.lastMessageAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.lastMessageAt.lte = end;
      }
    }

    // Status filter - filter by last message status
    // This requires a subquery or post-filtering
    let statusFilter = status;

    // Message count filter - we'll filter after fetching
    let messageCountFilter = messageCount;

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              voice: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1, // Get last message for preview
            select: {
              id: true,
              body: true,
              direction: true,
              status: true,
              createdAt: true,
              numMedia: true,
            },
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        // Fetch more to account for filtering
        skip: statusFilter || messageCountFilter ? 0 : (page - 1) * limit,
        take: statusFilter || messageCountFilter ? 1000 : limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    // Transform conversations to include lastMessage nicely
    let transformedConversations = conversations.map(conv => ({
      id: conv.id,
      externalNumber: conv.externalNumber,
      twilioNumber: conv.twilioNumber,
      lastMessageAt: conv.lastMessageAt,
      messageCount: conv._count.messages,
      agent: conv.agent,
      lastMessage: conv.messages[0] || null,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }));

    // Apply status filter (by last message status)
    if (statusFilter) {
      transformedConversations = transformedConversations.filter(
        conv => conv.lastMessage?.status?.toUpperCase() === statusFilter.toUpperCase()
      );
    }

    // Apply message count filter
    if (messageCountFilter) {
      transformedConversations = transformedConversations.filter(conv => {
        const count = conv.messageCount;
        switch (messageCountFilter) {
          case '<5':
            return count < 5;
          case '5-10':
            return count >= 5 && count <= 10;
          case '>10':
            return count > 10;
          default:
            return true;
        }
      });
    }

    // Calculate total after filtering
    const filteredTotal = transformedConversations.length;
    
    // Apply pagination after filtering
    if (statusFilter || messageCountFilter) {
      transformedConversations = transformedConversations.slice((page - 1) * limit, page * limit);
    }

    res.json({
      success: true,
      data: transformedConversations,
      meta: {
        page,
        limit,
        total: statusFilter || messageCountFilter ? filteredTotal : total,
        totalPages: Math.ceil((statusFilter || messageCountFilter ? filteredTotal : total) / limit),
        hasMore: page * limit < (statusFilter || messageCountFilter ? filteredTotal : total),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/messages/conversations/:id - Get a single conversation with all messages
router.get('/conversations/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            voice: true,
            communicationChannel: true,
          },
        },
      },
    });

    if (!conversation) {
      throw createError('Conversation not found', 404, ERROR_CODES.NOT_FOUND);
    }

    // Fetch messages with pagination (newest first for display, then reverse for chat order)
    const [messages, totalMessages] = await Promise.all([
      prisma.message.findMany({
        where: {
          conversationId: id,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          messageSid: true,
          type: true,
          direction: true,
          status: true,
          from: true,
          to: true,
          body: true,
          mediaUrls: true,
          mediaTypes: true,
          numMedia: true,
          sentAt: true,
          deliveredAt: true,
          aiGenerated: true,
          errorCode: true,
          errorMessage: true,
          agentName: true,
          createdAt: true,
        },
      }),
      prisma.message.count({ where: { conversationId: id } }),
    ]);

    // Reverse to get chronological order for chat display
    const chronologicalMessages = messages.reverse();

    res.json({
      success: true,
      data: {
        conversation: {
          id: conversation.id,
          externalNumber: conversation.externalNumber,
          twilioNumber: conversation.twilioNumber,
          lastMessageAt: conversation.lastMessageAt,
          agent: conversation.agent,
          createdAt: conversation.createdAt,
        },
        messages: chronologicalMessages,
      },
      meta: {
        page,
        limit,
        total: totalMessages,
        totalPages: Math.ceil(totalMessages / limit),
        hasMore: page * limit < totalMessages,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/messages - Get all messages (flat list, like calls)
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const agentId = req.query.agentId as string | undefined;
    const status = req.query.status as string | undefined;
    const direction = req.query.direction as string | undefined;
    const type = req.query.type as string | undefined;

    const where: any = {
      userId: req.user!.id,
    };

    if (agentId) {
      where.agentId = agentId;
    }

    if (status) {
      where.status = status;
    }

    if (direction) {
      where.direction = direction;
    }

    if (type) {
      where.type = type;
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              voice: true,
            },
          },
          conversation: {
            select: {
              id: true,
              externalNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    res.json({
      success: true,
      data: messages,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/messages/analytics/summary - Get messaging analytics
// Note: This route must come BEFORE /api/messages/:id to avoid "analytics" being treated as an id
router.get('/analytics/summary', async (req: AuthRequest, res, next) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where = {
      userId: req.user!.id,
      createdAt: {
        gte: startDate,
      },
    };

    const [
      totalMessages,
      totalConversations,
      sentMessages,
      receivedMessages,
      smsCount,
      mmsCount,
      deliveredCount,
      failedCount,
    ] = await Promise.all([
      prisma.message.count({ where }),
      prisma.conversation.count({ where: { userId: req.user!.id, lastMessageAt: { gte: startDate } } }),
      prisma.message.count({ where: { ...where, direction: 'OUTBOUND' } }),
      prisma.message.count({ where: { ...where, direction: 'INBOUND' } }),
      prisma.message.count({ where: { ...where, type: 'SMS' } }),
      prisma.message.count({ where: { ...where, type: 'MMS' } }),
      prisma.message.count({ where: { ...where, status: 'DELIVERED' } }),
      prisma.message.count({ where: { ...where, status: 'FAILED' } }),
    ]);

    res.json({
      success: true,
      data: {
        totalMessages,
        totalConversations,
        sentMessages,
        receivedMessages,
        smsCount,
        mmsCount,
        deliveredCount,
        failedCount,
        deliveryRate: totalMessages > 0 ? Math.round((deliveredCount / totalMessages) * 100) : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/messages/:id - Get a single message
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const message = await prisma.message.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            voice: true,
          },
        },
        conversation: {
          select: {
            id: true,
            externalNumber: true,
            twilioNumber: true,
          },
        },
      },
    });

    if (!message) {
      throw createError('Message not found', 404, ERROR_CODES.NOT_FOUND);
    }

    res.json({
      success: true,
      data: message,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
