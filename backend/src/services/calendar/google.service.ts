// ============================================
// Google Calendar Service - OAuth2 Integration
// Supports direct programmatic booking
// ============================================

import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../../utils/logger';
import { config } from '../../config';

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: string; // ISO datetime
  end: string; // ISO datetime
  status: string;
  htmlLink: string;
}

export interface GoogleAvailableSlot {
  start: string; // ISO datetime
  end: string; // ISO datetime
}

export interface CreateEventParams {
  summary: string;
  start: string; // ISO datetime
  end: string; // ISO datetime
  attendeeEmail?: string;
  attendeeName?: string;
  description?: string;
  timeZone?: string;
}

export class GoogleCalendarService {
  private oauth2Client: OAuth2Client;
  private calendarId: string;
  private timezone: string;

  constructor(
    accessToken: string,
    refreshToken: string | null,
    calendarId: string = 'primary',
    timezone: string = 'America/New_York'
  ) {
    if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUri) {
      throw new Error('Google OAuth credentials not configured');
    }

    this.oauth2Client = new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri
    );

    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken || undefined,
    });

    this.calendarId = calendarId;
    this.timezone = timezone;
  }

  /**
   * Get the OAuth2 client with auto-refresh capability
   */
  getOAuth2Client(): OAuth2Client {
    return this.oauth2Client;
  }

  /**
   * Get user's email from Google
   */
  async getUserEmail(): Promise<string> {
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      return userInfo.data.email || '';
    } catch (error) {
      logger.error('[Google Calendar] Failed to get user email:', error);
      throw new Error('Failed to fetch Google user info');
    }
  }

  /**
   * Get calendar list
   */
  async getCalendars(): Promise<calendar_v3.Schema$CalendarListEntry[]> {
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      const response = await calendar.calendarList.list();
      return response.data.items || [];
    } catch (error) {
      logger.error('[Google Calendar] Failed to get calendars:', error);
      throw new Error('Failed to fetch Google calendars');
    }
  }

  /**
   * Get available time slots for a date range
   */
  async getAvailableSlots(
    startDate: string,
    endDate: string,
    duration: number = 60 // duration in minutes
  ): Promise<GoogleAvailableSlot[]> {
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      // Parse dates
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Get busy times (existing events)
      const freeBusyResponse = await calendar.freebusy.query({
        requestBody: {
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          timeZone: this.timezone,
          items: [{ id: this.calendarId }],
        },
      });

      const busyTimes = freeBusyResponse.data.calendars?.[this.calendarId]?.busy || [];

      // Generate available slots (simplified - assumes 9 AM to 5 PM)
      const slots: GoogleAvailableSlot[] = [];
      const currentDate = new Date(start);

      while (currentDate < end) {
        const dayStart = new Date(currentDate);
        dayStart.setHours(9, 0, 0, 0);

        const dayEnd = new Date(currentDate);
        dayEnd.setHours(17, 0, 0, 0);

        // Generate hourly slots
        let slotStart = new Date(dayStart);
        while (slotStart < dayEnd) {
          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + duration);

          // Check if slot overlaps with busy time
          const isBusy = busyTimes.some(busy => {
            const busyStart = new Date(busy.start!);
            const busyEnd = new Date(busy.end!);
            return slotStart < busyEnd && slotEnd > busyStart;
          });

          if (!isBusy && slotStart >= start && slotEnd <= end) {
            slots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
            });
          }

          slotStart.setMinutes(slotStart.getMinutes() + duration);
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return slots;
    } catch (error) {
      logger.error('[Google Calendar] Failed to get available slots:', error);
      throw new Error('Failed to fetch availability from Google Calendar');
    }
  }

  /**
   * Create a calendar event (book appointment)
   */
  async createEvent(params: CreateEventParams): Promise<GoogleCalendarEvent> {
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const event: calendar_v3.Schema$Event = {
        summary: params.summary,
        description: params.description,
        start: {
          dateTime: params.start,
          timeZone: params.timeZone || this.timezone,
        },
        end: {
          dateTime: params.end,
          timeZone: params.timeZone || this.timezone,
        },
        attendees: params.attendeeEmail
          ? [
              {
                email: params.attendeeEmail,
                displayName: params.attendeeName,
              },
            ]
          : undefined,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 10 },
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: event,
        sendUpdates: 'all', // Send email notifications to attendees
      });

      const createdEvent = response.data;

      return {
        id: createdEvent.id!,
        summary: createdEvent.summary || '',
        start: createdEvent.start?.dateTime || createdEvent.start?.date || '',
        end: createdEvent.end?.dateTime || createdEvent.end?.date || '',
        status: createdEvent.status || '',
        htmlLink: createdEvent.htmlLink || '',
      };
    } catch (error) {
      logger.error('[Google Calendar] Failed to create event:', error);
      throw new Error('Failed to create Google Calendar event');
    }
  }

  /**
   * Cancel/delete a calendar event
   */
  async deleteEvent(eventId: string): Promise<void> {
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      await calendar.events.delete({
        calendarId: this.calendarId,
        eventId,
        sendUpdates: 'all', // Notify attendees
      });

      logger.info('[Google Calendar] Event deleted:', eventId);
    } catch (error) {
      logger.error('[Google Calendar] Failed to delete event:', error);
      throw new Error('Failed to delete Google Calendar event');
    }
  }

  /**
   * Format available slots for voice response
   */
  formatSlotsForVoice(slots: GoogleAvailableSlot[]): string {
    if (slots.length === 0) {
      return 'I don\'t see any available time slots.';
    }

    const formatted = slots.slice(0, 5).map((slot, index) => {
      const date = new Date(slot.start);
      const timeStr = date.toLocaleString('en-US', {
        timeZone: this.timezone,
        weekday: 'long',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return `${index + 1}. ${timeStr}`;
    });

    return `I have ${slots.length} available time slots. Here are the first few: ${formatted.join(', ')}`;
  }
}


