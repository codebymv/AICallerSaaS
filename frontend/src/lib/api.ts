// API Client for backend communication

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
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
    options: RequestInit = {},
    signal?: AbortSignal
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
      signal,
    });

    if (signal?.aborted) {
      throw new ApiError('Request was aborted by the client.', 'ABORT_ERROR', 0);
    }

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

  // Fetch blob (for audio/video files)
  async fetchBlob(endpoint: string): Promise<Blob> {
    const headers: Record<string, string> = {};

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.error?.message || 'Failed to fetch resource',
        errorData.error?.code || 'FETCH_ERROR',
        response.status
      );
    }

    return response.blob();
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

  async sendMessage(agentId: string, phoneNumber: string, message: string, mediaUrls?: string[], assetIds?: string[]) {
    return this.request<{
      messageSid: string;
      messageId: string;
      status: string;
      type: 'SMS' | 'MMS';
      to: string;
      from: string;
    }>(`/api/agents/${agentId}/message`, {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, message, mediaUrls, assetIds }),
    });
  }

  // Asset endpoints
  async getAssets(params?: { category?: string; agentId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.agentId) searchParams.set('agentId', params.agentId);
    
    const query = searchParams.toString();
    return this.request<any[]>(`/api/assets${query ? `?${query}` : ''}`);
  }

  async getAsset(id: string) {
    return this.request<any>(`/api/assets/${id}`);
  }

  async createAsset(data: {
    name: string;
    description?: string;
    category: string;
    url: string;
    mimeType?: string;
    fileSize?: number;
    agentId?: string;
  }) {
    return this.request<any>('/api/assets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAsset(id: string, data: Partial<{
    name: string;
    description: string;
    category: string;
    url: string;
    mimeType: string;
    fileSize: number;
    agentId: string;
  }>) {
    return this.request<any>(`/api/assets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAsset(id: string) {
    return this.request<{ success: boolean; message: string }>(`/api/assets/${id}`, {
      method: 'DELETE',
    });
  }

  async getAssetStats() {
    return this.request<{ IMAGE: number; DOCUMENT: number; VIDEO: number; OTHER: number }>('/api/assets/categories/stats');
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

  async getCallTimeSeries(days?: number) {
    const query = days ? `?days=${days}` : '';
    return this.request<{ date: string; calls: number; messages: number; duration: number; cost: number }[]>(
      `/api/calls/analytics/timeseries${query}`
    );
  }

  // Messaging/Conversation endpoints
  async getConversations(params?: {
    page?: number;
    limit?: number;
    agentId?: string;
    search?: string;
    status?: string;
    messageCount?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.agentId) searchParams.set('agentId', params.agentId);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.messageCount) searchParams.set('messageCount', params.messageCount);
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);

    const query = searchParams.toString();
    return this.request<any[]>(`/api/messages/conversations${query ? `?${query}` : ''}`);
  }

  async getConversation(id: string, params?: { page?: number; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    return this.request<any>(`/api/messages/conversations/${id}${query ? `?${query}` : ''}`);
  }

  async getMessages(params?: {
    page?: number;
    limit?: number;
    agentId?: string;
    status?: string;
    direction?: string;
    type?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.agentId) searchParams.set('agentId', params.agentId);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.direction) searchParams.set('direction', params.direction);
    if (params?.type) searchParams.set('type', params.type);

    const query = searchParams.toString();
    return this.request<any[]>(`/api/messages${query ? `?${query}` : ''}`);
  }

  async getMessage(id: string) {
    return this.request<any>(`/api/messages/${id}`);
  }

  async getMessagingAnalytics(params?: { days?: number }) {
    const query = params?.days ? `?days=${params.days}` : '';
    return this.request<any>(`/api/messages/analytics/summary${query}`);
  }

  // Contact endpoints
  async getContacts(params?: { search?: string; page?: number; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    return this.request<any[]>(`/api/contacts${query ? `?${query}` : ''}`);
  }

  async getContact(id: string) {
    return this.request<any>(`/api/contacts/${id}`);
  }

  async getContactByPhone(phone: string) {
    return this.request<any>(`/api/contacts/by-phone/${encodeURIComponent(phone)}`);
  }

  async getContactsBatch(phoneNumbers: string[]) {
    return this.request<Record<string, any>>('/api/contacts/batch', {
      method: 'POST',
      body: JSON.stringify({ phoneNumbers }),
    });
  }

  async createContact(data: { name: string; phoneNumber: string; notes?: string }) {
    return this.request<any>('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateContact(id: string, data: { name?: string; phoneNumber?: string; notes?: string }) {
    return this.request<any>(`/api/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteContact(id: string) {
    return this.request<any>(`/api/contacts/${id}`, {
      method: 'DELETE',
    });
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
      messagingServiceSid: string | null;
      authTokenSet: boolean;
      authTokenMasked: string | null;
    }>('/api/settings/twilio');
  }

  async updateTwilioSettings(accountSid: string, authToken: string, messagingServiceSid?: string) {
    return this.request<any>('/api/settings/twilio', {
      method: 'PUT',
      body: JSON.stringify({ accountSid, authToken, messagingServiceSid }),
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

  // Business Profile endpoints
  async getBusinessProfile() {
    return this.request<{
      organizationName: string | null;
      industry: string | null;
      businessDescription: string | null;
      isComplete: boolean;
    }>('/api/settings/business-profile');
  }

  // Storage (S3) endpoints
  async getStorageStatus() {
    return this.request<{
      configured: boolean;
      bucket?: string;
      region?: string;
      stats: {
        twilioRecordings: number;
        s3Recordings: number;
      };
    }>('/api/settings/storage');
  }

  async updateBusinessProfile(data: {
    organizationName?: string;
    industry?: string;
    businessDescription?: string;
  }) {
    return this.request<{
      organizationName: string | null;
      industry: string | null;
      businessDescription: string | null;
      isComplete: boolean;
    }>('/api/settings/business-profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Calendar Integration endpoints
  async getCalendarStatus() {
    return this.request<{
      connected: boolean;
      configured: boolean;
      // New: array of all connected calendars
      calendars?: Array<{
        id: string;
        provider: string;
        email?: string;
        username?: string;
        eventTypeName?: string;
        timezone?: string;
        isActive?: boolean;
      }>;
      connectedProviders?: string[];
      // Legacy: single calendar data
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

  async getGoogleCalendarAuthUrl() {
    return this.request<{
      authUrl: string;
    }>('/api/auth/google/calendar', {
      method: 'GET',
    });
  }

  async disconnectGoogleCalendar() {
    return this.request<{
      success: boolean;
      message: string;
    }>('/api/auth/google/disconnect', {
      method: 'POST',
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

  // Calendar agent assignment is now handled through agent create/update (agent-centric approach)

  async disconnectCalendar(provider?: string) {
    const url = provider 
      ? `/api/calendar/disconnect?provider=${provider}`
      : '/api/calendar/disconnect';
    return this.request<{ disconnected: boolean; provider: string }>( url, {
      method: 'DELETE',
    });
  }

  // ============================================
  // Campaigns
  // ============================================

  async getCampaigns(params?: { page?: number; limit?: number; status?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<any[]>(`/api/campaigns?${query}`);
  }

  async getCampaign(id: string, signal?: AbortSignal) {
    return this.request<any>(`/api/campaigns/${id}`, {}, signal);
  }

  async createCampaign(data: any) {
    return this.request<any>('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCampaign(id: string, data: any) {
    return this.request<any>(`/api/campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCampaign(id: string) {
    return this.request<void>(`/api/campaigns/${id}`, { method: 'DELETE' });
  }

  async startCampaign(id: string) {
    return this.request<any>(`/api/campaigns/${id}/start`, { method: 'POST' });
  }

  async pauseCampaign(id: string) {
    return this.request<any>(`/api/campaigns/${id}/pause`, { method: 'POST' });
  }

  async cancelCampaign(id: string) {
    return this.request<any>(`/api/campaigns/${id}/cancel`, { method: 'POST' });
  }

  async addCampaignLeads(campaignId: string, leads: any[]) {
    return this.request<any>(`/api/campaigns/${campaignId}/leads`, {
      method: 'POST',
      body: JSON.stringify(leads),
    });
  }

  async uploadCampaignLeadsCSV(campaignId: string, csvData: string) {
    return this.request<any>(`/api/campaigns/${campaignId}/leads/upload`, {
      method: 'POST',
      body: JSON.stringify({ csvData }),
    });
  }

  async getCampaignLeads(campaignId: string, params?: { page?: number; limit?: number; status?: string }, signal?: AbortSignal) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<any[]>(`/api/campaigns/${campaignId}/leads?${query}`, {}, signal);
  }

  async updateCampaignLead(campaignId: string, leadId: string, data: any) {
    return this.request<any>(`/api/campaigns/${campaignId}/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCampaignLead(campaignId: string, leadId: string) {
    return this.request<void>(`/api/campaigns/${campaignId}/leads/${leadId}`, { method: 'DELETE' });
  }

  async getCampaignStats(campaignId: string) {
    return this.request<any>(`/api/campaigns/${campaignId}/stats`);
  }

  async convertLeadToContact(campaignId: string, leadId: string) {
    return this.request<any>(`/api/campaigns/${campaignId}/leads/${leadId}/convert-to-contact`, {
      method: 'POST',
    });
  }

  async convertSuccessfulLeadsToContacts(campaignId: string) {
    return this.request<any>(`/api/campaigns/${campaignId}/convert-successful-leads`, {
      method: 'POST',
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
