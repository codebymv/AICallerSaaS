// ============================================
// Phone Number Routes
// ============================================

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error-handler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ERROR_CODES } from '../lib/constants';
import { TwilioService } from '../services/twilio.service';
import { decrypt } from '../utils/crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

// Apply auth to all routes
router.use(authenticate);

// Helper to get user's Twilio service
async function getUserTwilioService(userId: string): Promise<TwilioService> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twilioAccountSid: true, twilioAuthToken: true, twilioConfigured: true },
  });

  if (!user?.twilioConfigured || !user.twilioAccountSid || !user.twilioAuthToken) {
    throw createError(
      'Twilio credentials not configured. Please add your Twilio credentials in Settings.',
      400,
      ERROR_CODES.TWILIO_NOT_CONFIGURED
    );
  }

  return new TwilioService({
    accountSid: user.twilioAccountSid,
    authToken: decrypt(user.twilioAuthToken),
  });
}

// GET /api/phone-numbers - List phone numbers in database
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const phoneNumbers = await prisma.phoneNumber.findMany({
      where: { userId: req.user!.id },
      include: {
        agent: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: phoneNumbers,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/phone-numbers/twilio - List phone numbers from user's Twilio account
router.get('/twilio', async (req: AuthRequest, res, next) => {
  try {
    const twilioService = await getUserTwilioService(req.user!.id);
    const twilioNumbers = await twilioService.listPhoneNumbers();

    // Get already-added numbers from our database
    const existingNumbers = await prisma.phoneNumber.findMany({
      where: { userId: req.user!.id },
      select: { phoneNumber: true },
    });
    const existingSet = new Set(existingNumbers.map((n) => n.phoneNumber));

    // Mark which numbers are already added
    const numbersWithStatus = twilioNumbers.map((n) => ({
      ...n,
      alreadyAdded: existingSet.has(n.phoneNumber),
    }));

    res.json({
      success: true,
      data: numbersWithStatus,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/phone-numbers - Add an existing Twilio phone number
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { phoneNumber, twilioSid, friendlyName, agentId } = req.body;

    if (!phoneNumber) {
      throw createError('Phone number is required', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Verify agent ownership if provided
    if (agentId) {
      const agent = await prisma.agent.findFirst({
        where: { id: agentId, userId: req.user!.id },
      });
      if (!agent) {
        throw createError('Agent not found', 404, ERROR_CODES.AGENT_NOT_FOUND);
      }
    }

    // Check if number already exists
    const existing = await prisma.phoneNumber.findUnique({
      where: { phoneNumber },
    });
    if (existing) {
      throw createError('Phone number already added', 400, ERROR_CODES.ALREADY_EXISTS);
    }

    // Configure webhook URLs on Twilio (if we have the SID)
    if (twilioSid) {
      try {
        const twilioService = await getUserTwilioService(req.user!.id);
        await twilioService.configurePhoneNumber(twilioSid, config.apiUrl, agentId);
      } catch (error) {
        logger.warn('[PhoneNumbers] Could not configure webhooks:', error);
        // Continue anyway - user can configure manually
      }
    }

    // Save to database
    const savedNumber = await prisma.phoneNumber.create({
      data: {
        userId: req.user!.id,
        phoneNumber,
        twilioSid,
        friendlyName: friendlyName || phoneNumber,
        agentId,
      },
    });

    logger.info('[PhoneNumbers] Phone number added', { 
      userId: req.user!.id, 
      phoneNumber 
    });

    res.status(201).json({
      success: true,
      data: savedNumber,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/phone-numbers/:id - Update phone number
router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { friendlyName, agentId, isActive } = req.body;

    // Verify ownership
    const existing = await prisma.phoneNumber.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!existing) {
      throw createError('Phone number not found', 404, ERROR_CODES.PHONE_NUMBER_NOT_FOUND);
    }

    // Verify agent ownership if provided
    if (agentId) {
      const agent = await prisma.agent.findFirst({
        where: { id: agentId, userId: req.user!.id },
      });
      if (!agent) {
        throw createError('Agent not found', 404, ERROR_CODES.AGENT_NOT_FOUND);
      }
    }

    // Update Twilio webhook URL if agent changed and we have the Twilio SID
    if (existing.twilioSid && agentId !== existing.agentId) {
      try {
        const twilioService = await getUserTwilioService(req.user!.id);
        await twilioService.configurePhoneNumber(existing.twilioSid, config.apiUrl, agentId || undefined);
        logger.info('[PhoneNumbers] Updated Twilio webhook for agent change', { 
          phoneNumber: existing.phoneNumber,
          oldAgentId: existing.agentId,
          newAgentId: agentId 
        });
      } catch (error) {
        logger.warn('[PhoneNumbers] Could not update Twilio webhook:', error);
        // Continue anyway - update the database record
      }
    }

    const phoneNumber = await prisma.phoneNumber.update({
      where: { id: req.params.id },
      data: {
        friendlyName,
        agentId: agentId || null,
        isActive,
      },
      include: {
        agent: {
          select: { id: true, name: true },
        },
      },
    });

    res.json({
      success: true,
      data: phoneNumber,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/phone-numbers/:id - Release phone number
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!phoneNumber) {
      throw createError('Phone number not found', 404, ERROR_CODES.PHONE_NUMBER_NOT_FOUND);
    }

    // Release from Twilio (if we have the SID and user has Twilio configured)
    if (phoneNumber.twilioSid) {
      try {
        const twilioService = await getUserTwilioService(req.user!.id);
        await twilioService.releasePhoneNumber(phoneNumber.twilioSid);
      } catch (error) {
        logger.warn('[PhoneNumbers] Could not release from Twilio:', error);
        // Continue anyway - just remove from our database
      }
    }

    // Delete from database
    await prisma.phoneNumber.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
