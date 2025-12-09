// ============================================
// Cal.com Service - API Integration
// Supports direct programmatic booking
// ============================================

import { logger } from '../../utils/logger';

const CALCOM_API_BASE = 'https://api.cal.com/v2';

// API version headers for different endpoints
const API_VERSIONS = {
  me: '2024-06-11',
  eventTypes: '2024-06-14',
  slots: '2024-09-04',
  bookings: '2024-08-13',
};

export interface CalComUser {
  id: number;
  username: string;
  email: string;
  name: string;
  timeZone: string;
  timeFormat: number;
  defaultScheduleId: number | null;
  avatarUrl: string | null;
  bio: string | null;
}

export interface CalComEventType {
  id: number;
  title: string;
  slug: string;
  length?: number;           // v1 API field
  lengthInMinutes?: number;  // v2 API field
  description: string | null;
  ownerId?: number;
}

export interface CalComAvailableSlot {
  start: string; // ISO datetime
}

export interface CalComBooking {
  id: number;
  uid: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  attendees: Array<{
    name: string;
    email: string;
    timeZone?: string;
  }>;
}

export interface CreateBookingParams {
  eventTypeId: number;
  start: string; // ISO datetime
  name: string;
  email: string;
  timeZone?: string;
  notes?: string;
}

export class CalComService {
  private apiKey: string;
  private timezone: string;

  constructor(apiKey: string, timezone: string = 'America/New_York') {
    this.apiKey = apiKey;
    this.timezone = timezone;
  }

  /**
   * Validate an API key by fetching user info
   */
  static async validateApiKey(apiKey: string): Promise<CalComUser> {
    const response = await fetch(`${CALCOM_API_BASE}/me`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'cal-api-version': API_VERSIONS.me,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('[CalCom] API key validation failed:', error);
      if (response.status === 401) {
        throw new Error('Invalid Cal.com API Key');
      }
      throw new Error(`Failed to validate API key: ${response.status}`);
    }

    const data = await response.json() as { status: string; data: CalComUser };
    
    if (data.status !== 'success') {
      throw new Error('Failed to fetch Cal.com user info');
    }
    
    return data.data;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string, 
    apiVersion: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${CALCOM_API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'cal-api-version': apiVersion,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error(`[CalCom] API error (${endpoint}):`, error);
      throw new Error(`Cal.com API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as T;
    return data;
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<CalComUser> {
    const data = await this.request<{ status: string; data: CalComUser }>(
      '/me',
      API_VERSIONS.me
    );
    return data.data;
  }

  /**
   * Get user's event types
   */
  async getEventTypes(username?: string): Promise<CalComEventType[]> {
    const params = new URLSearchParams();
    if (username) {
      params.append('username', username);
    }

    const queryString = params.toString();
    const endpoint = queryString ? `/event-types?${queryString}` : '/event-types';

    const data = await this.request<{ status: string; data: CalComEventType[] }>(
      endpoint,
      API_VERSIONS.eventTypes
    );
    
    // Log the first event type to debug field names
    if (data.data && data.data.length > 0) {
      console.log('[CalCom] Event type sample:', JSON.stringify(data.data[0], null, 2));
    }
    
    return data.data;
  }

  /**
   * Get available time slots for an event type
   */
  async getAvailableSlots(
    eventTypeId: number,
    startDate: string, // YYYY-MM-DD
    endDate?: string   // YYYY-MM-DD, defaults to same day
  ): Promise<CalComAvailableSlot[]> {
    const end = endDate || startDate;
    
    const params = new URLSearchParams({
      eventTypeId: eventTypeId.toString(),
      start: startDate,
      end: end,
      timeZone: this.timezone,
    });

    logger.info('[CalCom] Fetching slots:', { eventTypeId, start: startDate, end, timeZone: this.timezone });

    const data = await this.request<{ 
      status: string; 
      data: Record<string, CalComAvailableSlot[]>  // Response is { "2025-12-09": [...], "2025-12-10": [...] }
    }>(
      `/slots?${params.toString()}`,
      API_VERSIONS.slots
    );

    logger.info('[CalCom] Slots response:', { dates: Object.keys(data.data || {}) });

    // Flatten the slots from all dates
    const allSlots: CalComAvailableSlot[] = [];
    for (const dateSlots of Object.values(data.data || {})) {
      allSlots.push(...dateSlots);
    }

    return allSlots;
  }

  /**
   * Create a booking (the main feature Cal.com has that Calendly doesn't!)
   */
  async createBooking(params: CreateBookingParams): Promise<CalComBooking> {
    const { eventTypeId, start, name, email, timeZone, notes } = params;

    const body = {
      eventTypeId,
      start,
      attendee: {
        name,
        email,
        timeZone: timeZone || this.timezone,
        language: 'en',
      },
      metadata: notes ? { notes } : {},
    };

    logger.info('[CalCom] Creating booking:', { eventTypeId, start, name, email });

    const data = await this.request<{ status: string; data: CalComBooking }>(
      '/bookings',
      API_VERSIONS.bookings,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    logger.info('[CalCom] Booking created successfully:', data.data.uid);
    return data.data;
  }

  /**
   * Format available slots for voice output (in business timezone)
   */
  formatSlotsForVoice(slots: CalComAvailableSlot[], maxSlots: number = 5): string {
    if (slots.length === 0) {
      return 'No available time slots for that date.';
    }

    const formattedSlots = slots.slice(0, maxSlots).map(slot => {
      const date = new Date(slot.start);
      return date.toLocaleString('en-US', {
        timeZone: this.timezone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    });

    if (formattedSlots.length === 1) {
      return `I have ${formattedSlots[0]} available.`;
    }

    const lastSlot = formattedSlots.pop();
    return `I have the following times available: ${formattedSlots.join(', ')}, and ${lastSlot}.`;
  }

  /**
   * Parse a datetime string from natural language context
   * Returns ISO 8601 format required by Cal.com API (UTC)
   * 
   * The datetime from the LLM is in LOCAL time (e.g., Phoenix time).
   * We need to convert it to UTC for the Cal.com API.
   */
  formatDateTimeForApi(datetime: string): string {
    logger.info('[CalCom] formatDateTimeForApi input:', datetime);
    
    // If already in ISO format with timezone, return as-is
    if (datetime.endsWith('Z') || datetime.match(/[+-]\d{2}:\d{2}$/)) {
      logger.info('[CalCom] Already has timezone, returning as-is');
      return datetime;
    }
    
    // If in ISO format without timezone (e.g., 2025-12-10T10:40:00)
    // This is LOCAL time - we need to convert to UTC
    if (datetime.includes('T') && datetime.includes(':')) {
      // Parse as local time in the business timezone
      // The LLM gives us "2025-12-10T10:40:00" meaning 10:40 AM in Phoenix
      // We need to convert this to UTC
      
      // Add seconds if missing
      let normalizedDatetime = datetime;
      if (datetime.match(/T\d{2}:\d{2}$/)) {
        normalizedDatetime = datetime + ':00';
      }
      
      // Create date object - this interprets it as local time
      // Then use the timezone offset to convert properly
      const timezoneOffsets: Record<string, number> = {
        'America/Phoenix': -7,      // MST (no DST)
        'America/New_York': -5,     // EST (or -4 EDT)
        'America/Chicago': -6,      // CST (or -5 CDT)
        'America/Denver': -7,       // MST (or -6 MDT)
        'America/Los_Angeles': -8,  // PST (or -7 PDT)
        'UTC': 0,
      };
      
      const offset = timezoneOffsets[this.timezone] ?? -7; // Default to Phoenix
      
      // Parse the datetime parts
      const match = normalizedDatetime.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
      if (match) {
        const [, year, month, day, hour, minute, second] = match;
        
        // Create UTC date by subtracting the offset
        // If it's 10:40 Phoenix (UTC-7), that's 17:40 UTC
        const utcHour = parseInt(hour) - offset;
        
        // Handle day rollover
        let utcDay = parseInt(day);
        let adjustedHour = utcHour;
        if (utcHour >= 24) {
          adjustedHour = utcHour - 24;
          utcDay += 1;
        } else if (utcHour < 0) {
          adjustedHour = utcHour + 24;
          utcDay -= 1;
        }
        
        const result = `${year}-${month}-${String(utcDay).padStart(2, '0')}T${String(adjustedHour).padStart(2, '0')}:${minute}:${second}Z`;
        logger.info('[CalCom] Converted to UTC:', { from: datetime, to: result, timezone: this.timezone, offset });
        return result;
      }
    }

    // Try to parse various formats
    const date = new Date(datetime);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid datetime format: ${datetime}`);
    }

    return date.toISOString();
  }
}

export default CalComService;
