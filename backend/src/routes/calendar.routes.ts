// ============================================
// Calendar Routes - Calendly Integration (BYOC)
// Supports Personal Access Tokens for BYOC
// ============================================

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error-handler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { CalendlyService } from '../services/calendar/calendly.service';
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
      timezone: string;
      isActive: boolean;
      expiresAt: Date | null;
    }>>`
      SELECT id, provider, "calendlyUserEmail", "calendlyEventTypeName", timezone, "isActive", "expiresAt"
      FROM "CalendarIntegration"
      WHERE "userId" = ${req.user!.id}
      LIMIT 1;
    `;

    if (integration.length === 0) {
      return res.json({
        success: true,
        data: {
          connected: false,
          // BYOC: always show as "configured" since users provide their own tokens
          configured: true,
        },
      });
    }

    const record = integration[0];
    
    res.json({
      success: true,
      data: {
        connected: true,
        configured: true,
        provider: record.provider,
        email: record.calendlyUserEmail,
        eventTypeName: record.calendlyEventTypeName,
        timezone: record.timezone,
        isActive: record.isActive,
        // PATs don't expire unless revoked
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

// Helper function to get active integration with token refresh
async function getActiveIntegration(userId: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  calendlyUserUri: string | null;
  calendlyEventTypeUri: string | null;
  timezone: string;
} | null> {
  const integration = await prisma.$queryRaw<Array<{
    id: string;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
    calendlyUserUri: string | null;
    calendlyEventTypeUri: string | null;
    timezone: string;
    isActive: boolean;
  }>>`
    SELECT id, "accessToken", "refreshToken", "expiresAt", "calendlyUserUri", "calendlyEventTypeUri", timezone, "isActive"
    FROM "CalendarIntegration"
    WHERE "userId" = ${userId} AND "isActive" = true
    LIMIT 1;
  `;

  if (integration.length === 0) {
    return null;
  }

  const record = integration[0];

  // Check if token needs refresh (refresh 5 minutes before expiry)
  if (record.expiresAt && record.refreshToken) {
    const expiresAt = new Date(record.expiresAt);
    const refreshBuffer = 5 * 60 * 1000; // 5 minutes
    
    if (expiresAt.getTime() - Date.now() < refreshBuffer) {
      try {
        logger.info('[Calendar] Refreshing Calendly token for user:', userId);
        
        const decryptedRefreshToken = decrypt(record.refreshToken);
        const newTokens = await CalendlyService.refreshAccessToken(decryptedRefreshToken);
        
        const encryptedAccessToken = encrypt(newTokens.access_token);
        const encryptedRefreshToken = newTokens.refresh_token ? encrypt(newTokens.refresh_token) : record.refreshToken;
        const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

        await prisma.$executeRaw`
          UPDATE "CalendarIntegration"
          SET 
            "accessToken" = ${encryptedAccessToken},
            "refreshToken" = ${encryptedRefreshToken},
            "expiresAt" = ${newExpiresAt},
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = ${record.id};
        `;

        return {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          calendlyUserUri: record.calendlyUserUri,
          calendlyEventTypeUri: record.calendlyEventTypeUri,
          timezone: record.timezone,
        };
      } catch (error) {
        logger.error('[Calendar] Token refresh failed:', error);
        // Continue with existing token, it might still work
      }
    }
  }

  return {
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
    calendlyUserUri: record.calendlyUserUri,
    calendlyEventTypeUri: record.calendlyEventTypeUri,
    timezone: record.timezone,
  };
}

// Export helper for use in voice pipeline
export { getActiveIntegration };

export default router;
