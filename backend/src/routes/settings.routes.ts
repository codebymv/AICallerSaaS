// ============================================
// Settings Routes - User Configuration
// ============================================

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error-handler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ERROR_CODES } from '../lib/constants';
import { encrypt, decrypt, maskSecret } from '../utils/crypto';
import { TwilioService } from '../services/twilio.service';
import { logger } from '../utils/logger';

const router = Router();

// Apply auth to all routes
router.use(authenticate);

// GET /api/settings/twilio - Get Twilio configuration status
router.get('/twilio', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        twilioAccountSid: true,
        twilioAuthToken: true,
        twilioMessagingServiceSid: true,
        twilioConfigured: true,
      },
    });

    if (!user) {
      throw createError('User not found', 404, ERROR_CODES.USER_NOT_FOUND);
    }

    res.json({
      success: true,
      data: {
        configured: user.twilioConfigured,
        accountSid: user.twilioAccountSid || null,
        messagingServiceSid: user.twilioMessagingServiceSid || null,
        // Never expose the actual auth token, just show if it's set
        authTokenSet: !!user.twilioAuthToken,
        authTokenMasked: user.twilioAuthToken ? maskSecret(decrypt(user.twilioAuthToken)) : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings/twilio - Update Twilio credentials
router.put('/twilio', async (req: AuthRequest, res, next) => {
  try {
    const { accountSid, authToken, messagingServiceSid } = req.body;

    if (!accountSid || !authToken) {
      throw createError(
        'Account SID and Auth Token are required',
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Validate Twilio credentials by making a test API call
    try {
      const testService = new TwilioService({
        accountSid,
        authToken,
      });
      await testService.validateCredentials();
    } catch (twilioError: any) {
      logger.warn('[Settings] Invalid Twilio credentials', { error: twilioError.message });
      throw createError(
        'Invalid Twilio credentials. Please check your Account SID and Auth Token.',
        400,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    // Encrypt and save credentials
    const encryptedToken = encrypt(authToken);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        twilioAccountSid: accountSid,
        twilioAuthToken: encryptedToken,
        twilioMessagingServiceSid: messagingServiceSid || null,
        twilioConfigured: true,
      },
    });

    logger.info('[Settings] Twilio credentials updated', { userId: req.user!.id });

    res.json({
      success: true,
      data: {
        configured: true,
        accountSid,
        messagingServiceSid: messagingServiceSid || null,
        authTokenSet: true,
        authTokenMasked: maskSecret(authToken),
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/settings/twilio - Remove Twilio credentials
router.delete('/twilio', async (req: AuthRequest, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        twilioAccountSid: null,
        twilioAuthToken: null,
        twilioConfigured: false,
      },
    });

    logger.info('[Settings] Twilio credentials removed', { userId: req.user!.id });

    res.json({
      success: true,
      data: { configured: false },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/settings/twilio/test - Test Twilio connection
router.post('/twilio/test', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        twilioAccountSid: true,
        twilioAuthToken: true,
      },
    });

    if (!user?.twilioAccountSid || !user?.twilioAuthToken) {
      throw createError(
        'Twilio credentials not configured',
        400,
        ERROR_CODES.TWILIO_NOT_CONFIGURED
      );
    }

    const twilioService = new TwilioService({
      accountSid: user.twilioAccountSid,
      authToken: decrypt(user.twilioAuthToken),
    });

    const account = await twilioService.validateCredentials();

    res.json({
      success: true,
      data: {
        valid: true,
        accountName: account.friendlyName,
        accountStatus: account.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Business Profile Routes
// ============================================

// GET /api/settings/business-profile - Get business profile
router.get('/business-profile', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        organizationName: true,
        industry: true,
        businessDescription: true,
        businessProfileComplete: true,
      },
    });

    if (!user) {
      throw createError('User not found', 404, ERROR_CODES.USER_NOT_FOUND);
    }

    res.json({
      success: true,
      data: {
        organizationName: user.organizationName,
        industry: user.industry,
        businessDescription: user.businessDescription,
        isComplete: user.businessProfileComplete,
      },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings/business-profile - Update business profile
router.put('/business-profile', async (req: AuthRequest, res, next) => {
  try {
    const { organizationName, industry, businessDescription } = req.body;

    // Determine if profile is complete (organizationName is required)
    const isComplete = !!(organizationName && organizationName.trim());

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        organizationName: organizationName?.trim() || null,
        industry: industry?.trim() || null,
        businessDescription: businessDescription?.trim() || null,
        businessProfileComplete: isComplete,
      },
      select: {
        organizationName: true,
        industry: true,
        businessDescription: true,
        businessProfileComplete: true,
      },
    });

    logger.info('[Settings] Business profile updated', { 
      userId: req.user!.id, 
      isComplete 
    });

    res.json({
      success: true,
      data: {
        organizationName: updatedUser.organizationName,
        industry: updatedUser.industry,
        businessDescription: updatedUser.businessDescription,
        isComplete: updatedUser.businessProfileComplete,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

