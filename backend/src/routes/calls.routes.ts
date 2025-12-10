// ============================================
// Call Routes
// ============================================

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error-handler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { initiateCallSchema, callFilterSchema, paginationSchema } from '../lib/validators';
import { ERROR_CODES } from '../lib/constants';
import { TwilioService } from '../services/twilio.service';
import { config } from '../config';

const router = Router();

// Apply auth to all routes
router.use(authenticate);

// GET /api/calls - List calls with filtering and pagination
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const pagination = paginationSchema.parse({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      sortBy: req.query.sortBy || 'createdAt',
      sortOrder: req.query.sortOrder || 'desc',
    });

    const filter = callFilterSchema.parse({
      agentId: req.query.agentId,
      status: req.query.status,
      direction: req.query.direction,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });

    const where: any = {
      userId: req.user!.id,
    };

    if (filter.agentId) where.agentId = filter.agentId;
    if (filter.status) where.status = filter.status;
    if (filter.direction) where.direction = filter.direction;
    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = new Date(filter.startDate);
      if (filter.endDate) where.createdAt.lte = new Date(filter.endDate);
    }

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        orderBy: { [pagination.sortBy!]: pagination.sortOrder },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        include: {
          agent: {
            select: { id: true, name: true, voice: true },
          },
        },
      }),
      prisma.call.count({ where }),
    ]);

    res.json({
      success: true,
      data: calls,
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        hasMore: pagination.page * pagination.limit < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/calls/:id/recording - Proxy call recording
router.get('/:id/recording', async (req: AuthRequest, res, next) => {
  try {
    const call = await prisma.call.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!call) {
      throw createError('Call not found', 404, ERROR_CODES.CALL_NOT_FOUND);
    }

    if (!call.recordingUrl) {
      throw createError('Recording not available', 404, ERROR_CODES.CALL_NOT_FOUND);
    }

    // Fetch recording from Twilio with authentication
    const response = await fetch(call.recordingUrl, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64'),
      },
    });

    if (!response.ok) {
      throw createError('Failed to fetch recording', response.status);
    }

    // Stream the recording to the client
    res.setHeader('Content-Type', response.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('Content-Length', response.headers.get('content-length') || '0');
    
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});

// GET /api/calls/:id - Get single call
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const call = await prisma.call.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
      include: {
        agent: {
          select: { id: true, name: true, voice: true },
        },
      },
    });

    if (!call) {
      throw createError('Call not found', 404, ERROR_CODES.CALL_NOT_FOUND);
    }

    res.json({
      success: true,
      data: call,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/calls - Initiate outbound call
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = initiateCallSchema.parse(req.body);

    // Verify agent ownership
    const agent = await prisma.agent.findFirst({
      where: {
        id: data.agentId,
        userId: req.user!.id,
        isActive: true,
      },
    });

    if (!agent) {
      throw createError('Agent not found or inactive', 404, ERROR_CODES.AGENT_NOT_FOUND);
    }

    // Check user quota
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { minutesUsed: true, minutesLimit: true },
    });

    if (user && user.minutesUsed >= user.minutesLimit) {
      throw createError('Call quota exceeded', 403, ERROR_CODES.CALL_QUOTA_EXCEEDED);
    }

    // Get from number
    let fromNumber = data.fromNumber;
    if (!fromNumber) {
      const phoneNumber = await prisma.phoneNumber.findFirst({
        where: { userId: req.user!.id, isActive: true },
      });
      fromNumber = phoneNumber?.phoneNumber || config.twilioPhoneNumber;
    }

    if (!fromNumber) {
      throw createError('No phone number available', 400, ERROR_CODES.PHONE_NUMBER_NOT_FOUND);
    }

    // Create call record
    const call = await prisma.call.create({
      data: {
        userId: req.user!.id,
        agentId: data.agentId,
        direction: 'outbound',
        from: fromNumber,
        to: data.toNumber || data.to,
        status: 'initiated',
        metadata: data.metadata || {},
        callSid: `pending_${Date.now()}`, // Will be updated by Twilio
        // Agent snapshot - preserve agent config at time of call
        agentName: agent.name,
        agentVoice: agent.voice,
        agentVoiceProvider: agent.voiceProvider,
      },
    });

    // Initiate Twilio call
    try {
      const twilioService = new TwilioService();
      const toPhone = data.toNumber || data.to;
      const result = await twilioService.makeCall(
        toPhone,
        fromNumber,
        `${config.apiUrl}/api/webhooks/twilio/voice?agentId=${data.agentId}&callId=${call.id}`
      );

      // Update with real call SID
      await prisma.call.update({
        where: { id: call.id },
        data: {
          callSid: result.callSid,
          status: 'queued',
        },
      });

      res.status(201).json({
        success: true,
        data: {
          ...call,
          callSid: result.callSid,
        },
      });
    } catch (twilioError) {
      // Update call status to failed
      await prisma.call.update({
        where: { id: call.id },
        data: {
          status: 'failed',
          errorMessage: (twilioError as Error).message,
        },
      });
      throw createError('Failed to initiate call', 500, ERROR_CODES.TWILIO_ERROR);
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/calls/:id/end - End a call
router.post('/:id/end', async (req: AuthRequest, res, next) => {
  try {
    const call = await prisma.call.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!call) {
      throw createError('Call not found', 404, ERROR_CODES.CALL_NOT_FOUND);
    }

    if (!['queued', 'ringing', 'in-progress'].includes(call.status)) {
      throw createError('Call is not active', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const twilioService = new TwilioService();
    await twilioService.endCall(call.callSid);

    await prisma.call.update({
      where: { id: call.id },
      data: {
        status: 'completed',
        endTime: new Date(),
      },
    });

    res.json({
      success: true,
      data: { ended: true },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/calls/analytics - Get call analytics
router.get('/analytics/summary', async (req: AuthRequest, res, next) => {
  try {
    const { startDate, endDate, agentId } = req.query;

    const where: any = {
      userId: req.user!.id,
    };

    if (agentId) where.agentId = agentId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [totalCalls, completedCalls, totalDuration, avgDuration, totalCost] = await Promise.all([
      prisma.call.count({ where }),
      prisma.call.count({ where: { ...where, status: 'completed' } }),
      prisma.call.aggregate({
        where: { ...where, status: 'completed' },
        _sum: { duration: true },
      }),
      prisma.call.aggregate({
        where: { ...where, status: 'completed' },
        _avg: { duration: true },
      }),
      prisma.call.aggregate({
        where,
        _sum: { costUsd: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalCalls,
        completedCalls,
        failedCalls: totalCalls - completedCalls,
        totalDuration: totalDuration._sum.duration || 0,
        avgDuration: Math.round(avgDuration._avg.duration || 0),
        totalCost: Number(totalCost._sum.costUsd || 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
