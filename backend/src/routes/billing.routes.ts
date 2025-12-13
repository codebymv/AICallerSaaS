// ============================================
// Billing Routes - Stripe Integration
// ============================================

import { Router, Request, Response } from 'express'; // Import Request/Response
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error-handler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ERROR_CODES } from '../lib/constants';
import { StripeService } from '../services/stripe.service';
import { logger } from '../utils/logger';
import bodyParser from 'body-parser';

const router = Router();
const stripeService = new StripeService();

// ============================================
// Public Webhook Route (No Auth)
// ============================================

// Stripe requires the raw body for signature verification
router.post(
  '/webhook',
  bodyParser.raw({ type: 'application/json' }),
  async (req: Request, res: Response, next) => { // Use explicit types
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      return res.status(400).send('Webhook Error: Missing signature');
    }

    try {
      await stripeService.handleWebhook(sig as string, req.body);
      res.json({ received: true });
    } catch (err: any) {
      logger.error(`[Billing] Webhook Error: ${err.message}`);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// ============================================
// Protected Routes
// ============================================

router.use(authenticate);

// GET /api/billing - Get current billing status
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        plan: true,
        creditsBalance: true,
        minutesUsed: true,
        minutesLimit: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      throw createError('User not found', 404, ERROR_CODES.USER_NOT_FOUND);
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/billing/checkout - Create Checkout Session
router.post('/checkout', async (req: AuthRequest, res, next) => {
  try {
    const { priceId, mode, successUrl, cancelUrl } = req.body;

    if (!priceId || !mode || !successUrl || !cancelUrl) {
      throw createError(
        'Missing required parameters',
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const url = await stripeService.createCheckoutSession(
      req.user!.id,
      priceId,
      mode,
      successUrl,
      cancelUrl
    );

    res.json({
      success: true,
      url,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/billing/portal - Create Customer Portal Session
router.post('/portal', async (req: AuthRequest, res, next) => {
  try {
    const { returnUrl } = req.body;

    if (!returnUrl) {
      throw createError(
        'Return URL is required',
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const url = await stripeService.createPortalSession(
      req.user!.id,
      returnUrl
    );

    res.json({
      success: true,
      url,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
