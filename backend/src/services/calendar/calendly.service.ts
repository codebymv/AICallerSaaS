// ============================================
// Calendly Service - API Integration (BYOC)
// Users provide their own Personal Access Tokens
// ============================================

import { logger } from '../../utils/logger';

const CALENDLY_API_BASE = 'https://api.calendly.com';

export interface CalendlyUser {
  uri: string;
  name: string;
  email: string;
  scheduling_url: string;
  timezone: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendlyEventType {
  uri: string;
  name: string;
  active: boolean;
  slug: string;
  scheduling_url: string;
  duration: number;
  description_plain: string | null;
  description_html: string | null;
  color: string;
  type: string; // 'StandardEventType' or 'AdhocEventType'
}

export interface CalendlyAvailableTime {
  status: 'available' | 'unavailable';
  start_time: string; // ISO datetime
  invitees_remaining: number;
}

export interface CalendlyScheduledEvent {
  uri: string;
  name: string;
  status: 'active' | 'canceled';
  start_time: string;
  end_time: string;
  event_type: string;
  location: {
    type: string;
    location?: string;
  };
  invitees_counter: {
    total: number;
    active: number;
    limit: number;
  };
  created_at: string;
  updated_at: string;
  event_memberships: Array<{
    user: string;
  }>;
}

export interface CreateInviteeParams {
  email: string;
  name: string;
  phone?: string;
  timezone?: string;
  questions_and_answers?: Array<{
    question: string;
    answer: string;
  }>;
}

export class CalendlyService {
  private accessToken: string;
  private timezone: string;

  constructor(accessToken: string, timezone: string = 'America/New_York') {
    this.accessToken = accessToken;
    this.timezone = timezone;
  }

  /**
   * Validate a Personal Access Token by fetching user info
   * Used for BYOC (Bring Your Own Calendly) setup
   */
  static async validatePersonalAccessToken(token: string): Promise<CalendlyUser> {
    const response = await fetch(`${CALENDLY_API_BASE}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('[Calendly] Token validation failed:', error);
      if (response.status === 401) {
        throw new Error('Invalid Calendly Personal Access Token');
      }
      throw new Error(`Failed to validate token: ${response.status}`);
    }

    const data = await response.json() as { resource: CalendlyUser };
    return data.resource;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${CALENDLY_API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error(`[Calendly] API error (${endpoint}):`, error);
      throw new Error(`Calendly API error: ${response.status}`);
    }

    const data = await response.json() as T;
    return data;
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<CalendlyUser> {
    const data = await this.request<{ resource: CalendlyUser }>('/users/me');
    return data.resource;
  }

  /**
   * Get user's event types
   */
  async getEventTypes(userUri: string): Promise<CalendlyEventType[]> {
    const params = new URLSearchParams({
      user: userUri,
      active: 'true',
    });

    const data = await this.request<{ collection: CalendlyEventType[] }>(
      `/event_types?${params.toString()}`
    );
    
    return data.collection;
  }

  /**
   * Get available time slots for an event type
   */
  async getAvailableSlots(
    eventTypeUri: string,
    startDate: string, // YYYY-MM-DD
    endDate?: string   // YYYY-MM-DD, defaults to startDate
  ): Promise<CalendlyAvailableTime[]> {
    const end = endDate || startDate;
    
    // Calculate start and end times in ISO format
    const startTime = new Date(`${startDate}T00:00:00`).toISOString();
    const endTime = new Date(`${end}T23:59:59`).toISOString();

    const params = new URLSearchParams({
      event_type: eventTypeUri,
      start_time: startTime,
      end_time: endTime,
    });

    const data = await this.request<{ collection: CalendlyAvailableTime[] }>(
      `/event_type_available_times?${params.toString()}`
    );

    // Filter to only available slots
    return data.collection.filter(slot => slot.status === 'available');
  }

  /**
   * Format available slots for voice output (in business timezone)
   */
  formatSlotsForVoice(slots: CalendlyAvailableTime[], maxSlots: number = 5): string {
    if (slots.length === 0) {
      return 'No available time slots for that date.';
    }

    const formattedSlots = slots.slice(0, maxSlots).map(slot => {
      const date = new Date(slot.start_time);
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
   * Get scheduled events (bookings)
   */
  async getScheduledEvents(
    userUri: string,
    minStartTime?: string,
    maxStartTime?: string,
    status: 'active' | 'canceled' = 'active'
  ): Promise<CalendlyScheduledEvent[]> {
    const params = new URLSearchParams({
      user: userUri,
      status,
    });

    if (minStartTime) params.append('min_start_time', minStartTime);
    if (maxStartTime) params.append('max_start_time', maxStartTime);

    const data = await this.request<{ collection: CalendlyScheduledEvent[] }>(
      `/scheduled_events?${params.toString()}`
    );

    return data.collection;
  }

  /**
   * Schedule an event (create invitee via scheduling link)
   * Note: Calendly doesn't have a direct API to create bookings.
   * The proper flow is to redirect users to the scheduling_url.
   * For AI booking, we'll use the single-use scheduling link approach.
   */
  async createSingleUseLink(eventTypeUri: string): Promise<string> {
    const data = await this.request<{ resource: { booking_url: string } }>(
      '/scheduling_links',
      {
        method: 'POST',
        body: JSON.stringify({
          max_event_count: 1,
          owner: eventTypeUri,
          owner_type: 'EventType',
        }),
      }
    );

    return data.resource.booking_url;
  }
}

export default CalendlyService;
