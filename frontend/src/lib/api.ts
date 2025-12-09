// API Client for backend communication

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Load token from localStorage on client side
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string>),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.error?.message || 'An error occurred',
        data.error?.code || 'UNKNOWN_ERROR',
        response.status,
        data.error?.details
      );
    }

    return data;
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.request<{ user: any; token: string }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
    if (response.data?.token) {
      this.setToken(response.data.token);
    }
    return response;
  }

  async register(email: string, password: string, name?: string) {
    const response = await this.request<{ user: any; token: string }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }
    );
    if (response.data?.token) {
      this.setToken(response.data.token);
    }
    return response;
  }

  async getMe() {
    return this.request<any>('/api/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // Agent endpoints
  async getAgents() {
    return this.request<any[]>('/api/agents');
  }

  async getAgent(id: string) {
    return this.request<any>(`/api/agents/${id}`);
  }

  async createAgent(data: any) {
    return this.request<any>('/api/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAgent(id: string, data: any) {
    return this.request<any>(`/api/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAgent(id: string) {
    return this.request<any>(`/api/agents/${id}`, {
      method: 'DELETE',
    });
  }

  async testAgent(id: string, testMessage: string) {
    return this.request<{ response: string; latency: any }>(
      `/api/agents/${id}/test`,
      {
        method: 'POST',
        body: JSON.stringify({ testMessage }),
      }
    );
  }

  async makeOutboundCall(agentId: string, phoneNumber: string) {
    return this.request<{
      callSid: string;
      callId: string;
      status: string;
      to: string;
      from: string;
    }>(`/api/agents/${agentId}/call`, {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    });
  }

  // Call endpoints
  async getCalls(params?: {
    page?: number;
    limit?: number;
    agentId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.agentId) searchParams.set('agentId', params.agentId);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);

    const query = searchParams.toString();
    return this.request<any[]>(`/api/calls${query ? `?${query}` : ''}`);
  }

  async getCall(id: string) {
    return this.request<any>(`/api/calls/${id}`);
  }

  async initiateCall(data: {
    agentId: string;
    toNumber: string;
    fromNumber?: string;
  }) {
    return this.request<any>('/api/calls', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async endCall(id: string) {
    return this.request<any>(`/api/calls/${id}/end`, {
      method: 'POST',
    });
  }

  async getCallAnalytics(params?: { startDate?: string; endDate?: string; agentId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    if (params?.agentId) searchParams.set('agentId', params.agentId);

    const query = searchParams.toString();
    return this.request<any>(`/api/calls/analytics/summary${query ? `?${query}` : ''}`);
  }

  // Phone number endpoints
  async getPhoneNumbers() {
    return this.request<any[]>('/api/phone-numbers');
  }

  async purchasePhoneNumber(areaCode?: string, defaultAgentId?: string) {
    return this.request<any>('/api/phone-numbers', {
      method: 'POST',
      body: JSON.stringify({ areaCode, defaultAgentId }),
    });
  }

  async updatePhoneNumber(id: string, data: any) {
    return this.request<any>(`/api/phone-numbers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePhoneNumber(id: string) {
    return this.request<any>(`/api/phone-numbers/${id}`, {
      method: 'DELETE',
    });
  }

  // Get phone numbers from user's Twilio account
  async getTwilioPhoneNumbers() {
    return this.request<any[]>('/api/phone-numbers/twilio');
  }

  // Add an existing Twilio phone number
  async addPhoneNumber(data: {
    phoneNumber: string;
    twilioSid?: string;
    friendlyName?: string;
    agentId?: string;
  }) {
    return this.request<any>('/api/phone-numbers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Settings endpoints
  async getTwilioSettings() {
    return this.request<{
      configured: boolean;
      accountSid: string | null;
      authTokenSet: boolean;
      authTokenMasked: string | null;
    }>('/api/settings/twilio');
  }

  async updateTwilioSettings(accountSid: string, authToken: string) {
    return this.request<any>('/api/settings/twilio', {
      method: 'PUT',
      body: JSON.stringify({ accountSid, authToken }),
    });
  }

  async deleteTwilioSettings() {
    return this.request<any>('/api/settings/twilio', {
      method: 'DELETE',
    });
  }

  async testTwilioConnection() {
    return this.request<{
      valid: boolean;
      accountName: string;
      accountStatus: string;
    }>('/api/settings/twilio/test', {
      method: 'POST',
    });
  }

  // Calendar Integration endpoints
  async getCalendarStatus() {
    return this.request<{
      connected: boolean;
      configured: boolean;
      provider?: string;
      email?: string;
      username?: string;
      eventTypeName?: string;
      timezone?: string;
      isActive?: boolean;
      tokenExpired?: boolean;
    }>('/api/calendar/status');
  }

  async connectCalendly(personalAccessToken: string) {
    return this.request<{
      connected: boolean;
      email: string;
      timezone: string;
    }>('/api/calendar/calendly/connect', {
      method: 'POST',
      body: JSON.stringify({ personalAccessToken }),
    });
  }

  async getCalendarEventTypes(): Promise<ApiResponse<Array<{
    uri: string;
    name: string;
    duration: number;
    description: string | null;
    schedulingUrl: string;
    active: boolean;
  }>> & { timezone?: string }> {
    return this.request('/api/calendar/event-types') as any;
  }

  async updateCalendarEventType(eventTypeUri: string, eventTypeName: string) {
    return this.request<{
      eventTypeUri: string;
      eventTypeName: string;
    }>('/api/calendar/event-type', {
      method: 'PUT',
      body: JSON.stringify({ eventTypeUri, eventTypeName }),
    });
  }

  // Cal.com Integration endpoints
  async connectCalcom(apiKey: string) {
    return this.request<{
      connected: boolean;
      username: string;
      email: string;
      timezone: string;
    }>('/api/calendar/calcom/connect', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    });
  }

  async getCalcomEventTypes() {
    return this.request<Array<{
      id: number;
      title: string;
      slug: string;
      duration: number;
      description: string | null;
    }>>('/api/calendar/calcom/event-types');
  }

  async updateCalcomEventType(eventTypeId: number, eventTypeSlug?: string, eventTypeName?: string) {
    return this.request<{
      eventTypeId: number;
      eventTypeName: string;
    }>('/api/calendar/calcom/event-type', {
      method: 'PUT',
      body: JSON.stringify({ eventTypeId, eventTypeSlug, eventTypeName }),
    });
  }

  async getCalcomAvailability(date: string) {
    return this.request<{
      date: string;
      timezone: string;
      slots: Array<{
        startTime: string;
        formatted: string;
      }>;
      voiceFormat: string;
    }>(`/api/calendar/calcom/availability?date=${date}`);
  }

  async testCalendarConnection() {
    return this.request<{
      valid: boolean;
      email: string;
      timezone: string;
    }>('/api/calendar/test', {
      method: 'POST',
    });
  }

  async getCalendarAvailability(date: string) {
    return this.request<{
      date: string;
      timezone: string;
      slots: Array<{
        startTime: string;
        formatted: string;
      }>;
      voiceFormat: string;
    }>(`/api/calendar/availability?date=${date}`);
  }

  async disconnectCalendar() {
    return this.request<{ disconnected: boolean }>('/api/calendar/disconnect', {
      method: 'DELETE',
    });
  }
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(message: string, code: string, status: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const api = new ApiClient(API_BASE_URL);
