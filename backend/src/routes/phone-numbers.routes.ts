// ============================================
// Phone Number Routes
// ============================================

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error-handler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ERROR_CODES } from '../lib/constants';
import { TwilioService } from '../services/twilio.service';
import { config } from '../config';

const router = Router();

// Apply auth to all routes
router.use(authenticate);

// GET /api/phone-numbers - List phone numbers
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

// POST /api/phone-numbers - Purchase a phone number
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { areaCode, defaultAgentId } = req.body;

    // Verify agent ownership if provided
    if (defaultAgentId) {
      const agent = await prisma.agent.findFirst({
        where: { id: defaultAgentId, userId: req.user!.id },
      });
      if (!agent) {
        throw createError('Agent not found', 404, ERROR_CODES.AGENT_NOT_FOUND);
      }
    }

    // Purchase from Twilio
    const twilioService = new TwilioService();
    const purchased = await twilioService.purchasePhoneNumber(areaCode);

    // Save to database
    const phoneNumber = await prisma.phoneNumber.create({
      data: {
        userId: req.user!.id,
        phoneNumber: purchased.phoneNumber,
        twilioSid: purchased.sid,
        friendlyName: purchased.friendlyName,
        agentId: defaultAgentId,
      },
    });

    res.status(201).json({
      success: true,
      data: phoneNumber,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/phone-numbers/:id - Update phone number
router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { friendlyName, defaultAgentId, isActive } = req.body;

    // Verify ownership
    const existing = await prisma.phoneNumber.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!existing) {
      throw createError('Phone number not found', 404, ERROR_CODES.PHONE_NUMBER_NOT_FOUND);
    }

    // Verify agent ownership if provided
    if (defaultAgentId) {
      const agent = await prisma.agent.findFirst({
        where: { id: defaultAgentId, userId: req.user!.id },
      });
      if (!agent) {
        throw createError('Agent not found', 404, ERROR_CODES.AGENT_NOT_FOUND);
      }
    }

    const phoneNumber = await prisma.phoneNumber.update({
      where: { id: req.params.id },
      data: {
        friendlyName,
        agentId: defaultAgentId,
        isActive,
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

    // Release from Twilio
    const twilioService = new TwilioService();
    await twilioService.releasePhoneNumber(phoneNumber.twilioSid);

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
