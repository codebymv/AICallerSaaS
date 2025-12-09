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
  length: number;
  description: string | null;
  ownerId: number;
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
   * Returns ISO 8601 format required by Cal.com API
   */
  formatDateTimeForApi(datetime: string): string {
    // If already in ISO format, return as-is
    if (datetime.includes('T') && datetime.includes(':')) {
      // Ensure it ends with Z for UTC or has timezone
      if (!datetime.endsWith('Z') && !datetime.includes('+') && !datetime.includes('-', 10)) {
        return datetime + ':00Z';
      }
      return datetime;
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
