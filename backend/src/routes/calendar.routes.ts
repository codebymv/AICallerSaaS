// ============================================
// Calendar Routes - Calendly & Cal.com Integration
// Supports Personal Access Tokens / API Keys
// ============================================

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error-handler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { CalendlyService } from '../services/calendar/calendly.service';
import { CalComService } from '../services/calendar/calcom.service';
import { encrypt, decrypt } from '../utils/crypto';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const router = Router();

// Apply auth to all routes
router.use(authenticate);

// GET /api/calendar/status - Get calendar integration status
router.get('/status', async (req: AuthRequest, res, next) => {
  try {
    const integration = await prisma.$queryRaw<Array<{
      id: string;
      provider: string;
      calendlyUserEmail: string | null;
      calendlyEventTypeName: string | null;
      calcomUsername: string | null;
      calcomUserEmail: string | null;
      calcomEventTypeName: string | null;
      timezone: string;
      isActive: boolean;
      expiresAt: Date | null;
    }>>`
      SELECT id, provider, "calendlyUserEmail", "calendlyEventTypeName", 
             "calcomUsername", "calcomUserEmail", "calcomEventTypeName",
             timezone, "isActive", "expiresAt"
      FROM "CalendarIntegration"
      WHERE "userId" = ${req.user!.id}
      LIMIT 1;
    `;

    if (integration.length === 0) {
      return res.json({
        success: true,
        data: {
          connected: false,
          configured: true,
        },
      });
    }

    const record = integration[0];
    
    // Return provider-specific data
    const providerData = record.provider === 'calcom' 
      ? {
          email: record.calcomUserEmail,
          username: record.calcomUsername,
          eventTypeName: record.calcomEventTypeName,
        }
      : {
          email: record.calendlyUserEmail,
          eventTypeName: record.calendlyEventTypeName,
        };
    
    res.json({
      success: true,
      data: {
        connected: true,
        configured: true,
        provider: record.provider,
        ...providerData,
        timezone: record.timezone,
        isActive: record.isActive,
        tokenExpired: false,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/calendar/calendly/connect - Connect with Personal Access Token (BYOC)
router.post('/calendly/connect', async (req: AuthRequest, res, next) => {
  try {
    const { personalAccessToken } = req.body;

    if (!personalAccessToken) {
      throw createError('Personal Access Token is required', 400, 'MISSING_TOKEN');
    }

    // Validate the token by fetching user info
    const user = await CalendlyService.validatePersonalAccessToken(personalAccessToken);
    
    // Encrypt the token for storage
    const encryptedToken = encrypt(personalAccessToken);

    // Check if integration already exists
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "CalendarIntegration" WHERE "userId" = ${req.user!.id} LIMIT 1;
    `;

    if (existing.length > 0) {
      // Update existing
      await prisma.$executeRaw`
        UPDATE "CalendarIntegration"
        SET 
          "accessToken" = ${encryptedToken},
          "refreshToken" = NULL,
          "expiresAt" = NULL,
          "calendlyUserUri" = ${user.uri},
          "calendlyUserEmail" = ${user.email},
          "timezone" = ${user.timezone},
          "isActive" = true,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = ${req.user!.id};
      `;
    } else {
      // Create new
      const id = crypto.randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "CalendarIntegration" (
          "id", "userId", "provider", "accessToken", "calendlyUserUri", 
          "calendlyUserEmail", "timezone", "isActive", "createdAt", "updatedAt"
        ) VALUES (
          ${id}, ${req.user!.id}, 'calendly', ${encryptedToken}, ${user.uri},
          ${user.email}, ${user.timezone}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        );
      `;
    }

    logger.info('[Calendar] Calendly connected via PAT for user:', req.user!.id);

    res.json({
      success: true,
      data: {
        connected: true,
        email: user.email,
        timezone: user.timezone,
      },
    });
  } catch (error) {
    logger.error('[Calendar] Connect error:', error);
    next(error);
  }
});

// GET /api/calendar/event-types - Get user's event types (also syncs timezone)
router.get('/event-types', async (req: AuthRequest, res, next) => {
  try {
    const integration = await getActiveIntegration(req.user!.id);
    
    if (!integration) {
      throw createError('Calendar not connected', 400, 'CALENDAR_NOT_CONNECTED');
    }

    const calendlyService = new CalendlyService(
      decrypt(integration.accessToken),
      integration.timezone
    );

    // Also refresh user profile to sync timezone
    const user = await calendlyService.getCurrentUser();
    
    // Update timezone if it changed
    if (user.timezone !== integration.timezone) {
      await prisma.$executeRaw`
        UPDATE "CalendarIntegration"
        SET "timezone" = ${user.timezone}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = ${req.user!.id};
      `;
      logger.info('[Calendar] Timezone updated:', user.timezone);
    }

    const eventTypes = await calendlyService.getEventTypes(integration.calendlyUserUri!);

    res.json({
      success: true,
      data: eventTypes.map(et => ({
        uri: et.uri,
        name: et.name,
        duration: et.duration,
        description: et.description_plain,
        schedulingUrl: et.scheduling_url,
        active: et.active,
      })),
      timezone: user.timezone, // Return current timezone
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/calendar/event-type - Select event type for AI to use
router.put('/event-type', async (req: AuthRequest, res, next) => {
  try {
    const { eventTypeUri, eventTypeName } = req.body;

    if (!eventTypeUri) {
      throw createError('Event type URI is required', 400, 'MISSING_EVENT_TYPE');
    }

    await prisma.$executeRaw`
      UPDATE "CalendarIntegration"
      SET 
        "calendlyEventTypeUri" = ${eventTypeUri},
        "calendlyEventTypeName" = ${eventTypeName || null},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${req.user!.id};
    `;

    res.json({
      success: true,
      data: {
        eventTypeUri,
        eventTypeName,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/calendar/availability - Get available slots for a date
router.get('/availability', async (req: AuthRequest, res, next) => {
  try {
    const { date, endDate } = req.query;

    if (!date || typeof date !== 'string') {
      throw createError('Date is required (YYYY-MM-DD format)', 400, 'MISSING_DATE');
    }

    const integration = await getActiveIntegration(req.user!.id);
    
    if (!integration) {
      throw createError('Calendar not connected', 400, 'CALENDAR_NOT_CONNECTED');
    }

    if (!integration.calendlyEventTypeUri) {
      throw createError('No event type selected. Please select an event type in settings.', 400, 'NO_EVENT_TYPE');
    }

    const calendlyService = new CalendlyService(
      decrypt(integration.accessToken),
      integration.timezone
    );

    const slots = await calendlyService.getAvailableSlots(
      integration.calendlyEventTypeUri,
      date,
      typeof endDate === 'string' ? endDate : undefined
    );

    // Format for response
    const formattedSlots = slots.map(slot => ({
      startTime: slot.start_time,
      formatted: new Date(slot.start_time).toLocaleString('en-US', {
        timeZone: integration.timezone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    }));

    res.json({
      success: true,
      data: {
        date,
        timezone: integration.timezone,
        slots: formattedSlots,
        voiceFormat: calendlyService.formatSlotsForVoice(slots),
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/calendar/disconnect - Disconnect calendar integration
router.delete('/disconnect', async (req: AuthRequest, res, next) => {
  try {
    await prisma.$executeRaw`
      DELETE FROM "CalendarIntegration" WHERE "userId" = ${req.user!.id};
    `;

    logger.info('[Calendar] Disconnected for user:', req.user!.id);

    res.json({
      success: true,
      data: { disconnected: true },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Cal.com Routes
// ============================================

// POST /api/calendar/calcom/connect - Connect with Cal.com API Key
router.post('/calcom/connect', async (req: AuthRequest, res, next) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      throw createError('Cal.com API Key is required', 400, 'MISSING_API_KEY');
    }

    // Validate the API key by fetching user info
    const user = await CalComService.validateApiKey(apiKey);
    
    // Encrypt the API key for storage
    const encryptedApiKey = encrypt(apiKey);

    // Check if integration already exists
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "CalendarIntegration" WHERE "userId" = ${req.user!.id} LIMIT 1;
    `;

    if (existing.length > 0) {
      // Update existing - switch to Cal.com
      await prisma.$executeRaw`
        UPDATE "CalendarIntegration"
        SET 
          "provider" = 'calcom',
          "calcomApiKey" = ${encryptedApiKey},
          "calcomUserId" = ${user.id},
          "calcomUsername" = ${user.username},
          "calcomUserEmail" = ${user.email},
          "timezone" = ${user.timeZone},
          "isActive" = true,
          "updatedAt" = CURRENT_TIMESTAMP,
          -- Clear Calendly fields when switching
          "accessToken" = ${encryptedApiKey},
          "calendlyUserUri" = NULL,
          "calendlyUserEmail" = NULL,
          "calendlyEventTypeUri" = NULL,
          "calendlyEventTypeName" = NULL
        WHERE "userId" = ${req.user!.id};
      `;
    } else {
      // Create new
      const id = crypto.randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "CalendarIntegration" (
          "id", "userId", "provider", "accessToken", "calcomApiKey", "calcomUserId",
          "calcomUsername", "calcomUserEmail", "timezone", "isActive", "createdAt", "updatedAt"
        ) VALUES (
          ${id}, ${req.user!.id}, 'calcom', ${encryptedApiKey}, ${encryptedApiKey}, ${user.id},
          ${user.username}, ${user.email}, ${user.timeZone}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        );
      `;
    }

    logger.info('[Calendar] Cal.com connected for user:', req.user!.id);

    res.json({
      success: true,
      data: {
        connected: true,
        provider: 'calcom',
        username: user.username,
        email: user.email,
        timezone: user.timeZone,
      },
    });
  } catch (error) {
    logger.error('[Calendar] Cal.com connect error:', error);
    next(error);
  }
});

// GET /api/calendar/calcom/event-types - Get Cal.com event types
router.get('/calcom/event-types', async (req: AuthRequest, res, next) => {
  try {
    const integration = await getCalComIntegration(req.user!.id);
    
    if (!integration) {
      throw createError('Cal.com not connected', 400, 'CALCOM_NOT_CONNECTED');
    }

    const calcomService = new CalComService(
      decrypt(integration.calcomApiKey),
      integration.timezone
    );

    // Also refresh user profile to sync timezone
    const user = await calcomService.getCurrentUser();
    
    // Update timezone if it changed
    if (user.timeZone !== integration.timezone) {
      await prisma.$executeRaw`
        UPDATE "CalendarIntegration"
        SET "timezone" = ${user.timeZone}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = ${req.user!.id};
      `;
      logger.info('[Calendar] Cal.com timezone updated:', user.timeZone);
    }

    const eventTypes = await calcomService.getEventTypes(integration.calcomUsername || undefined);

    res.json({
      success: true,
      data: eventTypes.map(et => ({
        id: et.id,
        title: et.title,
        slug: et.slug,
        duration: et.length,
        description: et.description,
      })),
      timezone: user.timeZone,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/calendar/calcom/event-type - Select Cal.com event type for AI to use
router.put('/calcom/event-type', async (req: AuthRequest, res, next) => {
  try {
    const { eventTypeId, eventTypeSlug, eventTypeName } = req.body;

    if (!eventTypeId) {
      throw createError('Event type ID is required', 400, 'MISSING_EVENT_TYPE');
    }

    await prisma.$executeRaw`
      UPDATE "CalendarIntegration"
      SET 
        "calcomEventTypeId" = ${eventTypeId},
        "calcomEventTypeSlug" = ${eventTypeSlug || null},
        "calcomEventTypeName" = ${eventTypeName || null},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${req.user!.id};
    `;

    res.json({
      success: true,
      data: {
        eventTypeId,
        eventTypeSlug,
        eventTypeName,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/calendar/calcom/availability - Get Cal.com available slots
router.get('/calcom/availability', async (req: AuthRequest, res, next) => {
  try {
    const { date, endDate } = req.query;

    if (!date || typeof date !== 'string') {
      throw createError('Date is required (YYYY-MM-DD format)', 400, 'MISSING_DATE');
    }

    const integration = await getCalComIntegration(req.user!.id);
    
    if (!integration) {
      throw createError('Cal.com not connected', 400, 'CALCOM_NOT_CONNECTED');
    }

    if (!integration.calcomEventTypeId) {
      throw createError('No event type selected. Please select an event type in settings.', 400, 'NO_EVENT_TYPE');
    }

    const calcomService = new CalComService(
      decrypt(integration.calcomApiKey),
      integration.timezone
    );

    const slots = await calcomService.getAvailableSlots(
      integration.calcomEventTypeId,
      date,
      typeof endDate === 'string' ? endDate : undefined
    );

    // Format for response
    const formattedSlots = slots.map(slot => ({
      startTime: slot.start,
      formatted: new Date(slot.start).toLocaleString('en-US', {
        timeZone: integration.timezone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    }));

    res.json({
      success: true,
      data: {
        date,
        timezone: integration.timezone,
        slots: formattedSlots,
        voiceFormat: calcomService.formatSlotsForVoice(slots),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to get active Calendly integration
// Note: Personal Access Tokens don't expire, so no refresh needed
async function getActiveIntegration(userId: string): Promise<{
  accessToken: string;
  calendlyUserUri: string | null;
  calendlyEventTypeUri: string | null;
  timezone: string;
} | null> {
  const integration = await prisma.$queryRaw<Array<{
    id: string;
    accessToken: string;
    calendlyUserUri: string | null;
    calendlyEventTypeUri: string | null;
    timezone: string;
    isActive: boolean;
  }>>`
    SELECT id, "accessToken", "calendlyUserUri", "calendlyEventTypeUri", timezone, "isActive"
    FROM "CalendarIntegration"
    WHERE "userId" = ${userId} AND "isActive" = true AND "provider" = 'calendly'
    LIMIT 1;
  `;

  if (integration.length === 0) {
    return null;
  }

  const record = integration[0];

  return {
    accessToken: record.accessToken,
    calendlyUserUri: record.calendlyUserUri,
    calendlyEventTypeUri: record.calendlyEventTypeUri,
    timezone: record.timezone,
  };
}

// Helper function to get active Cal.com integration
async function getCalComIntegration(userId: string): Promise<{
  calcomApiKey: string;
  calcomUserId: number | null;
  calcomUsername: string | null;
  calcomEventTypeId: number | null;
  calcomEventTypeSlug: string | null;
  calcomEventTypeName: string | null;
  timezone: string;
} | null> {
  const integration = await prisma.$queryRaw<Array<{
    id: string;
    calcomApiKey: string;
    calcomUserId: number | null;
    calcomUsername: string | null;
    calcomEventTypeId: number | null;
    calcomEventTypeSlug: string | null;
    calcomEventTypeName: string | null;
    timezone: string;
    isActive: boolean;
  }>>`
    SELECT id, "calcomApiKey", "calcomUserId", "calcomUsername", 
           "calcomEventTypeId", "calcomEventTypeSlug", "calcomEventTypeName", 
           timezone, "isActive"
    FROM "CalendarIntegration"
    WHERE "userId" = ${userId} AND "isActive" = true AND "provider" = 'calcom'
    LIMIT 1;
  `;

  if (integration.length === 0) {
    return null;
  }

  const record = integration[0];

  return {
    calcomApiKey: record.calcomApiKey,
    calcomUserId: record.calcomUserId,
    calcomUsername: record.calcomUsername,
    calcomEventTypeId: record.calcomEventTypeId,
    calcomEventTypeSlug: record.calcomEventTypeSlug,
    calcomEventTypeName: record.calcomEventTypeName,
    timezone: record.timezone,
  };
}

// Export helpers for use in voice pipeline
export { getActiveIntegration, getCalComIntegration };

export default router;
