import { Router } from 'express';
import { google } from 'googleapis';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { encrypt, decrypt } from '../utils/crypto';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Initialize OAuth2 client
const getOAuth2Client = () => {
  console.log('[Google OAuth] Config values:', {
    clientId: config.googleClientId ? 'SET' : 'MISSING',
    clientSecret: config.googleClientSecret ? 'SET' : 'MISSING',
    redirectUri: config.googleRedirectUri || 'MISSING',
  });
  
  if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUri) {
    throw new Error('Google OAuth credentials not configured');
  }

  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri
  );
};

// GET /api/auth/google/calendar - Initiate OAuth flow
router.get('/google/calendar', authenticate, (req: AuthRequest, res) => {
  try {
    const oauth2Client = getOAuth2Client();
    
    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Request refresh token
      scope: scopes,
      prompt: 'consent', // Force consent screen to get refresh token
      state: req.user!.id, // Pass user ID in state
    });

    res.json({
      success: true,
      data: { authUrl },
    });
  } catch (error) {
    console.error('Failed to generate Google auth URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate Google OAuth',
    });
  }
});

// GET /api/auth/google/callback - Handle OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;

    if (!code || !userId) {
      return res.redirect(`${config.appUrl}/dashboard/settings?error=missing_params`);
    }

    const oauth2Client = getOAuth2Client();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);
    
    if (!tokens.access_token) {
      return res.redirect(`${config.appUrl}/dashboard/settings?error=no_access_token`);
    }

    oauth2Client.setCredentials(tokens);

    // Get user's email and primary calendar
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email;

    // Get primary calendar
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarList = await calendar.calendarList.list();
    const primaryCalendar = calendarList.data.items?.find(cal => cal.primary);

    // Save or update Google Calendar integration (doesn't affect other providers)
    await prisma.calendarIntegration.upsert({
      where: { 
        userId_provider: {
          userId: userId as string,
          provider: 'google',
        }
      },
      create: {
        userId: userId as string,
        provider: 'google',
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleAccessToken: encrypt(tokens.access_token),
        googleRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleCalendarId: primaryCalendar?.id || 'primary',
        googleUserEmail: userEmail || null,
        isActive: true,
      },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleAccessToken: encrypt(tokens.access_token),
        googleRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleCalendarId: primaryCalendar?.id || 'primary',
        googleUserEmail: userEmail || null,
        isActive: true,
      },
    });

    // Redirect back to settings
    res.redirect(`${config.appUrl}/dashboard/settings?success=google_calendar_connected`);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect(`${config.appUrl}/dashboard/settings?error=oauth_failed`);
  }
});

// POST /api/auth/google/disconnect - Disconnect Google Calendar
router.post('/google/disconnect', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // Delete Google Calendar integration (doesn't affect other providers)
    const deleted = await prisma.calendarIntegration.deleteMany({
      where: { 
        userId: req.user!.id,
        provider: 'google',
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({
        success: false,
        error: 'Google Calendar not connected',
      });
    }

    res.json({
      success: true,
      data: { disconnected: true, provider: 'google' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;


