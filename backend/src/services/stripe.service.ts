// ============================================
// Stripe Service - Payment Processing
// ============================================

import Stripe from 'stripe';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { Plan, User } from '@prisma/client';
import { PLAN_MINUTES, STRIPE_PRICE_TO_PLAN } from '../lib/constants';

export class StripeService {
  private stripe: Stripe;

  constructor() {
    // Initialize Stripe with secret key from config
    // Using a fallback for development if key is missing, though user confirmed they have it
    const apiKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2023-10-16', // Use a stable API version
    });
  }

  /**
   * Get or create a Stripe Customer for a user
   */
  async getOrCreateCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    try {
      // Create new customer in Stripe
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: {
          userId: user.id,
        },
      });

      // Save customer ID to database
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customer.id },
      });

      logger.info('[Stripe] Created new customer', { userId: user.id, customerId: customer.id });
      return customer.id;
    } catch (error) {
      logger.error('[Stripe] Failed to create customer:', error);
      throw error;
    }
  }

  /**
   * Create a Checkout Session for a subscription or one-time payment
   */
  async createCheckoutSession(
    userId: string,
    priceId: string,
    mode: 'subscription' | 'payment',
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const customerId = await this.getOrCreateCustomer(user);

    try {
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        mode,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId,
          type: mode === 'payment' ? 'credit_purchase' : 'subscription_upgrade',
        },
      });

      if (!session.url) throw new Error('Failed to generate session URL');
      return session.url;
    } catch (error) {
      logger.error('[Stripe] Failed to create checkout session:', error);
      throw error;
    }
  }

  /**
   * Create a Customer Portal session for managing subscriptions
   */
  async createPortalSession(userId: string, returnUrl: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const customerId = await this.getOrCreateCustomer(user);

    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return session.url;
    } catch (error) {
      logger.error('[Stripe] Failed to create portal session:', error);
      throw error;
    }
  }

  /**
   * Handle Webhook Events
   * This should be called from the webhook route handler
   */
  async handleWebhook(signature: string, payload: Buffer): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('[Stripe] Webhook secret not configured');
      throw new Error('Webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      logger.error(`[Stripe] Webhook signature verification failed: ${err.message}`);
      throw new Error(`Webhook Error: ${err.message}`);
    }

    logger.info(`[Stripe] Received webhook event: ${event.type}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
        default:
          logger.debug(`[Stripe] Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      logger.error('[Stripe] Error handling webhook event:', error);
      throw error;
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    const type = session.metadata?.type;

    if (!userId) {
      logger.warn('[Stripe] Webhook missing userId in metadata');
      return;
    }

    if (type === 'credit_purchase') {
      // Calculate credits based on amount (assuming $1 = 100 credits logic, or use lookup)
      // Amount is in cents
      const amountPaid = session.amount_total || 0;
      const creditsToAdd = amountPaid / 100 * 100; // $1 = 100 credits (Example ratio)
      
      await prisma.user.update({
        where: { id: userId },
        data: {
          creditsBalance: {
            increment: creditsToAdd,
          },
        },
      });
      logger.info(`[Stripe] Added ${creditsToAdd} credits to user ${userId}`);
    }
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const status = subscription.status;
    
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: {
        id: true,
        plan: true,
        billingPeriodStart: true,
      },
    });

    if (!user) {
      logger.warn(`[Stripe] No user found for customer ${customerId}`);
      return;
    }

    let plan: Plan = 'FREE';

    if (status === 'active' || status === 'trialing') {
      const firstItem = subscription.items.data[0];
      const priceId = firstItem?.price?.id;

      if (priceId && STRIPE_PRICE_TO_PLAN[priceId]) {
        plan = STRIPE_PRICE_TO_PLAN[priceId];
      } else {
        plan = user.plan;
        logger.warn(
          `[Stripe] Unmapped price ID ${priceId || 'unknown'} for user ${user.id}, keeping existing plan ${plan}`
        );
      }
    } else {
      plan = 'FREE';
    }

    const minutesLimit = PLAN_MINUTES[plan];

    const currentPeriodStartUnix = subscription.current_period_start;
    let billingPeriodStart: Date | null = null;
    let resetMinutes = false;

    if (currentPeriodStartUnix) {
      billingPeriodStart = new Date(currentPeriodStartUnix * 1000);

      if (!user.billingPeriodStart) {
        resetMinutes = true;
      } else {
        const previousPeriodStart = new Date(user.billingPeriodStart);
        if (billingPeriodStart.getTime() > previousPeriodStart.getTime()) {
          resetMinutes = true;
        }
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan,
        minutesLimit,
        billingPeriodStart,
        ...(resetMinutes ? { minutesUsed: 0 } : {}),
      },
    });
  }
}
