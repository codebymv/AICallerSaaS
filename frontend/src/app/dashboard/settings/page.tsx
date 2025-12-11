'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Settings, Phone, CheckCircle, XCircle, Loader2, ExternalLink, Eye, EyeOff, HelpCircle, Calendar, Bot, ChevronDown, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DeleteButton } from '@/components/DeleteButton';
import { EmptyState } from '@/components/EmptyState';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES } from '@/lib/constants';

interface TwilioSettings {
  configured: boolean;
  accountSid: string | null;
  messagingServiceSid: string | null;
  authTokenSet: boolean;
  authTokenMasked: string | null;
}

interface ConnectedCalendar {
  id: string;
  provider: string;
  email?: string;
  username?: string;
  eventTypeName?: string;
  timezone?: string;
  isActive?: boolean;
}

interface CalendarStatus {
  connected: boolean;
  configured: boolean;
  // New: array of all connected calendars
  calendars?: ConnectedCalendar[];
  connectedProviders?: string[];
  // Legacy: single calendar data (backwards compatibility)
  provider?: string;
  email?: string;
  username?: string;
  eventTypeName?: string;
  timezone?: string;
  isActive?: boolean;
  tokenExpired?: boolean;
}

interface CalendarEventType {
  // Calendly fields
  uri?: string;
  schedulingUrl?: string;
  active?: boolean;
  // Cal.com fields
  id?: number;
  title?: string;
  slug?: string;
  // Common fields
  name?: string;
  duration: number;
  description: string | null;
}

// Cal.com event type interface
interface CalComEventType {
  id: number;
  title: string;
  slug: string;
  duration: number;
  description: string | null;
}

interface BusinessProfile {
  organizationName: string | null;
  industry: string | null;
  businessDescription: string | null;
  isComplete: boolean;
}

// Phone number interfaces
interface PhoneNumber {
  id: string;
  phoneNumber: string;
  twilioSid?: string;
  friendlyName?: string;
  isActive: boolean;
  agent?: { id: string; name: string; voice?: string } | null;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  voice?: string;
}

// Helper to get avatar for a voice
const getVoiceAvatar = (voiceId?: string): string | null => {
  if (!voiceId) return null;
  const voice = ELEVENLABS_VOICES.find(v => v.id === voiceId.toLowerCase());
  return voice?.avatar || null;
};


export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<TwilioSettings | null>(null);
  const [hasPhoneNumbers, setHasPhoneNumbers] = useState(false);

  // Form state
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [messagingServiceSid, setMessagingServiceSid] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [editing, setEditing] = useState(false);

  // Calendar state
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [eventTypes, setEventTypes] = useState<CalendarEventType[]>([]);
  const [selectedEventType, setSelectedEventType] = useState<string>('');
  const [savingEventType, setSavingEventType] = useState(false);
  const [calendlyToken, setCalendlyToken] = useState('');
  const [showCalendlyToken, setShowCalendlyToken] = useState(false);

  // Cal.com state
  const [calcomApiKey, setCalcomApiKey] = useState('');
  const [showCalcomApiKey, setShowCalcomApiKey] = useState(false);
  const [calcomEventTypes, setCalcomEventTypes] = useState<CalComEventType[]>([]);
  const [calendarTab, setCalendarTab] = useState<'google' | 'calcom' | 'calendly'>('google');
  const [calendarEditing, setCalendarEditing] = useState(false);

  // Settings page tab state
  const [settingsTab, setSettingsTab] = useState<'integrations' | 'organization' | 'preferences'>('integrations');

  // Phone numbers state
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingPhoneNumbers, setLoadingPhoneNumbers] = useState(false);

  // Business Profile state
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [businessProfileLoading, setBusinessProfileLoading] = useState(true);
  const [businessProfileSaving, setBusinessProfileSaving] = useState(false);
  const [showBusinessProfileHelp, setShowBusinessProfileHelp] = useState(false);
  const [businessProfileForm, setBusinessProfileForm] = useState({
    organizationName: '',
    industry: '',
    businessDescription: '',
  });

  const searchParams = useSearchParams();

  useEffect(() => {
    fetchSettings();
    fetchPhoneNumbersAndAgents();
    fetchCalendarStatus();
    fetchBusinessProfile();

    // Handle OAuth callback success/error
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'google_calendar_connected') {
      toast({
        title: 'Google Calendar connected!',
        description: 'Your Google Calendar has been successfully connected.',
      });
      // Remove query param
      window.history.replaceState({}, '', '/dashboard/settings');
    } else if (error) {
      toast({
        title: 'Connection failed',
        description: error === 'oauth_failed' ? 'OAuth authentication failed' : 'An error occurred',
        variant: 'destructive',
      });
      // Remove query param
      window.history.replaceState({}, '', '/dashboard/settings');
    }
  }, [searchParams, toast]);

  const fetchBusinessProfile = async () => {
    setBusinessProfileLoading(true);
    try {
      const response = await api.getBusinessProfile();
      const profile = response.data;
      setBusinessProfile(profile || null);
      if (profile) {
        setBusinessProfileForm({
          organizationName: profile.organizationName || '',
          industry: profile.industry || '',
          businessDescription: profile.businessDescription || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch business profile:', error);
    } finally {
      setBusinessProfileLoading(false);
    }
  };

  const handleSaveBusinessProfile = async () => {
    setBusinessProfileSaving(true);
    try {
      const response = await api.updateBusinessProfile(businessProfileForm);
      setBusinessProfile(response.data || null);
      toast({
        title: 'Business profile saved',
        description: response.data?.isComplete
          ? 'Your business profile is complete!'
          : 'Business profile updated. Add organization name to complete it.',
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to save business profile';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setBusinessProfileSaving(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await api.getTwilioSettings();
      setSettings(response.data || null);
      if (response.data?.accountSid) {
        setAccountSid(response.data.accountSid);
      }
      if (response.data?.messagingServiceSid) {
        setMessagingServiceSid(response.data.messagingServiceSid);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPhoneNumbersAndAgents = async () => {
    setLoadingPhoneNumbers(true);
    try {
      const [numbersRes, agentsRes] = await Promise.all([
        api.getPhoneNumbers(),
        api.getAgents(),
      ]);
      setPhoneNumbers(numbersRes.data || []);
      setAgents(agentsRes.data || []);
      setHasPhoneNumbers((numbersRes.data || []).length > 0);
    } catch (error) {
      console.error('Failed to fetch phone numbers:', error);
    } finally {
      setLoadingPhoneNumbers(false);
    }
  };

  // Phone number and calendar agent assignments are handled in Agent settings (agent-centric approach)

  const handleDeletePhoneNumber = async (id: string) => {
    try {
      await api.deletePhoneNumber(id);
      toast({
        title: 'Phone number removed',
        description: 'The phone number has been removed.',
      });
      fetchPhoneNumbersAndAgents();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to remove phone number';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      throw error; // Re-throw to keep modal open on error
    }
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const fetchCalendarStatus = async () => {
    try {
      const response = await api.getCalendarStatus();
      setCalendarStatus(response.data || null);

      // If connected, fetch event types (pass provider directly since state hasn't updated yet)
      if (response.data?.connected) {
        fetchEventTypes(response.data.provider);
      }
    } catch (error) {
      console.error('Failed to fetch calendar status:', error);
    }
  };

  const fetchEventTypes = async (provider?: string) => {
    // Use passed provider or fall back to state
    const currentProvider = provider || calendarStatus?.provider;

    try {
      // Fetch based on provider
      if (currentProvider === 'calcom') {
        const response = await api.getCalcomEventTypes();
        setCalcomEventTypes(response.data || []);
      } else if (currentProvider === 'calendly') {
        const response = await api.getCalendarEventTypes();
        setEventTypes(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch event types:', error);
    }
  };

  const handleConnectGoogle = async () => {
    setCalendarLoading(true);
    try {
      // Get OAuth URL from backend
      const response = await api.getGoogleCalendarAuthUrl();

      if (response.data?.authUrl) {
        // Redirect to Google OAuth consent screen
        window.location.href = response.data.authUrl;
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to initiate Google OAuth';
      toast({
        title: 'Connection failed',
        description: message,
        variant: 'destructive',
      });
      setCalendarLoading(false);
    }
  };

  const handleConnectCalcom = async () => {
    if (!calcomApiKey) {
      toast({
        title: 'Missing API Key',
        description: 'Please enter your Cal.com API Key',
        variant: 'destructive',
      });
      return;
    }

    setCalendarLoading(true);
    try {
      const response = await api.connectCalcom(calcomApiKey);
      if (response.data?.connected) {
        toast({
          title: 'Cal.com connected!',
          description: `Connected as ${response.data.username || response.data.email}. Select an event type below.`,
        });
        setCalcomApiKey('');
        fetchCalendarStatus();
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to connect Cal.com';
      toast({
        title: 'Connection failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleConnectCalendly = async () => {
    if (!calendlyToken) {
      toast({
        title: 'Missing token',
        description: 'Please enter your Calendly Personal Access Token',
        variant: 'destructive',
      });
      return;
    }

    setCalendarLoading(true);
    try {
      const response = await api.connectCalendly(calendlyToken);
      if (response.data?.connected) {
        toast({
          title: 'Calendly connected!',
          description: `Connected as ${response.data.email}. Select an event type below.`,
        });
        setCalendlyToken('');
        fetchCalendarStatus();
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to connect Calendly';
      toast({
        title: 'Connection failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleSelectEventType = async (eventTypeUri: string) => {
    const eventType = eventTypes.find(et => et.uri === eventTypeUri);
    if (!eventType) return;

    setSavingEventType(true);
    try {
      await api.updateCalendarEventType(eventTypeUri, eventType.name || '');
      setSelectedEventType(eventTypeUri);
      toast({
        title: 'Event type saved',
        description: `AI agents will now use "${eventType.name}" for appointments.`,
      });
      fetchCalendarStatus();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to save event type';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSavingEventType(false);
    }
  };

  const handleSelectCalcomEventType = async (eventTypeId: number) => {
    const eventType = calcomEventTypes.find(et => et.id === eventTypeId);
    if (!eventType) return;

    setSavingEventType(true);
    try {
      await api.updateCalcomEventType(eventTypeId, eventType.slug, eventType.title);
      toast({
        title: 'Event type saved',
        description: `AI agents will now use "${eventType.title}" for appointments and can book directly!`,
      });
      fetchCalendarStatus();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to save event type';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSavingEventType(false);
    }
  };

  const handleRemoveCalendar = async (provider: string) => {
    try {
      await api.disconnectCalendar(provider);
      // Refresh status to update the list
      await fetchCalendarStatus();
      setEventTypes([]);
      setSelectedEventType('');
      toast({
        title: 'Calendar removed',
        description: `${provider === 'google' ? 'Google Calendar' : provider === 'calcom' ? 'Cal.com' : 'Calendly'} has been disconnected.`,
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to remove calendar';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      throw error; // Re-throw to keep modal open
    }
  };

  const handleSave = async () => {
    if (!accountSid || !authToken) {
      toast({
        title: 'Missing fields',
        description: 'Please enter both Account SID and Auth Token',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await api.updateTwilioSettings(accountSid, authToken, messagingServiceSid || undefined);
      toast({
        title: 'Settings saved',
        description: 'Your Twilio credentials have been saved and verified.',
      });
      setAuthToken('');
      setEditing(false);
      fetchSettings();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to save settings';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove your Twilio credentials?')) return;

    try {
      await api.deleteTwilioSettings();
      toast({
        title: 'Credentials removed',
        description: 'Your Twilio credentials have been removed.',
      });
      setAccountSid('');
      setAuthToken('');
      setSettings(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to remove credentials';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Settings className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600" />
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-600">Settings</h1>
        <span className="hidden sm:inline text-slate-400">•</span>
        <p className="text-muted-foreground text-sm sm:text-base w-full sm:w-auto">Configure your integrations and preferences</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b">
        <button
          onClick={() => setSettingsTab('integrations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${settingsTab === 'integrations'
            ? 'border-teal-600 text-teal-600'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          Integrations
        </button>
        <button
          onClick={() => setSettingsTab('organization')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${settingsTab === 'organization'
            ? 'border-teal-600 text-teal-600'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          Organization
        </button>
        <button
          onClick={() => setSettingsTab('preferences')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${settingsTab === 'preferences'
            ? 'border-teal-600 text-teal-600'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          Preferences
        </button>
      </div>

      {/* Integrations Tab */}
      {settingsTab === 'integrations' && (
        <div className="space-y-6">
          {/* Twilio Integration */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base sm:text-lg text-slate-600">Phone Number</CardTitle>
                  {/* Help Tooltip */}
                  <div className="relative group">
                    <HelpCircle className="h-4 w-4 text-teal-500 hover:text-teal-700 cursor-help transition-colors" />
                    <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-white border rounded-lg shadow-lg p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                      <span className="text-sm mb">You will need a Twilio number to place or receive calls.</span>
                      <h4 className="font-medium text-sm mb-2">How to get your Twilio credentials:</h4>
                      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Go to your Twilio Console</li>
                        <li>Find your <strong className="text-foreground">Account SID</strong> and <strong className="text-foreground">Auth Token</strong> on the dashboard</li>
                        <li>Copy and paste them below</li>
                        <li>Make sure you have at least one phone number</li>
                      </ol>
                      <a
                        href="https://console.twilio.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-3 text-sm text-teal-600 hover:underline"
                      >
                        Open Twilio Console <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-13 sm:ml-0">
                  {settings?.configured ? (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-slate-500">
                      <XCircle className="h-4 w-4" />
                      Not configured
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Twilio Tab - Always visible */}
              <div className="space-y-4">
                <div className="flex border-b">
                  <button
                    className="px-4 py-2 text-sm font-medium border-b-2 border-teal-600 text-teal-600"
                  >
                    Twilio
                  </button>
                </div>

                {/* Tab Content - Show info or form based on state */}
                {settings?.configured && !editing ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                      <div>
                        <Label className="text-muted-foreground text-xs sm:text-sm">Account SID</Label>
                        <p className="font-mono text-xs sm:text-sm bg-slate-100 p-2 rounded mt-1 break-all">
                          {settings.accountSid}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs sm:text-sm">Auth Token</Label>
                        <p className="font-mono text-xs sm:text-sm bg-slate-100 p-2 rounded mt-1">
                          {settings.authTokenMasked || '••••••••'}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <Label className="text-muted-foreground text-xs sm:text-sm">Messaging Service SID</Label>
                          <span className="text-xs text-muted-foreground">(Optional)</span>
                          <div className="relative group">
                            <HelpCircle className="h-3 w-3 text-teal-500 hover:text-teal-700 cursor-help transition-colors" />
                            <div className="absolute right-0 bottom-full mb-2 w-72 p-3 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                              <p className="font-medium text-sm mb-1">Required for US SMS delivery</p>
                              <p className="text-sm text-muted-foreground mb-2">US carriers require A2P 10DLC registration for business SMS.</p>
                              <a
                                href="https://www.twilio.com/docs/messaging/compliance/a2p-10dlc"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-teal-600 hover:underline"
                              >
                                Learn more <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                        <Input
                          id="messagingServiceSidConfigured"
                          value={messagingServiceSid}
                          onChange={(e) => setMessagingServiceSid(e.target.value)}
                          placeholder="MGxxx..."
                          className="font-mono text-xs sm:text-sm mt-1"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => { setEditing(true); }} size="sm" className="flex-1 sm:flex-none bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700 text-white">
                        Update Credentials
                      </Button>
                      <Button variant="destructive" onClick={handleRemove} size="sm" className="flex-1 sm:flex-none">
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="accountSid" className="text-muted-foreground text-xs sm:text-sm">Account SID</Label>
                        <Input
                          id="accountSid"
                          value={accountSid}
                          onChange={(e) => setAccountSid(e.target.value)}
                          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          className="font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="authToken" className="text-muted-foreground text-xs sm:text-sm">Auth Token</Label>
                        <div className="relative">
                          <Input
                            id="authToken"
                            type={showToken ? 'text' : 'password'}
                            value={authToken}
                            onChange={(e) => setAuthToken(e.target.value)}
                            placeholder="Your Twilio Auth Token"
                            className="font-mono text-sm pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowToken(!showToken)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Messaging Service SID - Optional */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="messagingServiceSid" className="text-muted-foreground text-xs sm:text-sm">Messaging Service SID</Label>
                        <span className="text-xs text-muted-foreground">(Optional)</span>
                        <div className="relative group">
                          <HelpCircle className="h-4 w-4 text-teal-500 hover:text-teal-700 cursor-help transition-colors" />
                          <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                            <p className="font-medium text-sm mb-1">Required for US SMS delivery</p>
                            <p className="text-sm text-muted-foreground mb-2">US carriers require A2P 10DLC registration for business SMS. Without it, messages may be blocked.</p>
                            <p className="text-sm text-muted-foreground mb-2"><strong className="text-foreground">To set up:</strong></p>
                            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                              <li>Register your brand in Twilio Trust Hub</li>
                              <li>Create an A2P Campaign</li>
                              <li>Create a Messaging Service & add your number</li>
                              <li>Paste the Service SID (MGxxx...) here</li>
                            </ol>
                            <a
                              href="https://www.twilio.com/docs/messaging/compliance/a2p-10dlc"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-3 text-sm text-teal-600 hover:underline"
                            >
                              Learn more <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                      <Input
                        id="messagingServiceSid"
                        value={messagingServiceSid}
                        onChange={(e) => setMessagingServiceSid(e.target.value)}
                        placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter your Twilio Messaging Service SID for reliable SMS delivery in the US.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save & Verify'
                        )}
                      </Button>
                      {editing && (
                        <Button variant="outline" onClick={() => {
                          setEditing(false);
                          setAuthToken('');
                        }}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Phone Numbers Section - Only show when configured */}
              {settings?.configured && (
                <div className="border-t pt-6 mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-medium text-slate-600">Phone Numbers</h3>
                        <p className="text-xs text-muted-foreground">Your Twilio phone numbers</p>
                      </div>
                    </div>

                    {loadingPhoneNumbers ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                      </div>
                    ) : phoneNumbers.length === 0 ? (
                      <div className="text-center py-8 border rounded-lg bg-slate-50">
                        <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                        <p className="font-medium text-slate-600 mb-1">No phone numbers added</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Purchase a number in Twilio Console, then refresh
                        </p>
                        <a
                          href="https://console.twilio.com/us1/develop/phone-numbers/manage/incoming"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-teal-600 hover:underline"
                        >
                          Open Twilio Console →
                        </a>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {phoneNumbers.map((number) => (
                          <div
                            key={number.id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border gap-4"
                          >
                            <div className="flex items-center gap-3 sm:gap-4">
                              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                                <Phone className="h-5 w-5 text-teal-600" />
                              </div>
                              <div>
                                <p className="font-mono font-medium text-sm text-slate-600">
                                  {formatPhoneNumber(number.phoneNumber)}
                                </p>
                                {number.agent && (
                                  <p className="text-xs text-muted-foreground">
                                    Assigned to {number.agent.name}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3 ml-13 sm:ml-0">
                              <DeleteButton
                                onDelete={() => handleDeletePhoneNumber(number.id)}
                                itemName={formatPhoneNumber(number.phoneNumber)}
                                title="Remove Phone Number"
                                description="This will remove the phone number from your account. If it's assigned to an agent, it will be unassigned."
                                confirmText="Remove"
                              />
                            </div>
                          </div>
                        ))}

                        {/* <p className="text-xs text-muted-foreground text-center pt-2">
                          Need more numbers?{' '}
                          <a
                            href="https://console.twilio.com/us1/develop/phone-numbers/manage/incoming"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-600 hover:underline"
                          >
                            Purchase in Twilio Console
                          </a>
                          {' '}then refresh.
                        </p> */}
                      </div>
                    )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calendar */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base sm:text-lg text-slate-600">Calendar</CardTitle>
                  {/* Help Tooltip */}
                  <div className="relative group">
                    <HelpCircle className="h-4 w-4 text-teal-500 hover:text-teal-700 cursor-help transition-colors" />
                    <div className="absolute left-0 top-full mt-2 z-50 w-80 bg-white border rounded-lg shadow-lg p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                      <h4 className="font-medium text-sm mb-2">Calendar Integration Options</h4>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        <div>
                          <p className="font-medium text-foreground">Cal.com</p>
                          <p>Full programmatic booking - AI can directly create appointments without any follow-up needed.</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Calendly</p>
                          <p>Availability checking only - AI can see open slots but cannot book directly (API limitation).</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-13 sm:ml-0">
                  {calendarStatus?.connected ? (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-slate-500">
                      <XCircle className="h-4 w-4" />
                      Not connected
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Calendar Tabs - Always visible */}
              <div className="space-y-4">
                {/* Tab selection */}
                <div className="flex border-b">
                  <button
                    onClick={() => setCalendarTab('google')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${calendarTab === 'google'
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-slate-500 hover:text-slate-600'
                      }`}
                  >
                    Google Calendar
                    {calendarStatus?.connectedProviders?.includes('google') && (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    )}
                  </button>
                  <button
                    onClick={() => setCalendarTab('calcom')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${calendarTab === 'calcom'
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-slate-500 hover:text-slate-600'
                      }`}
                  >
                    Cal.com
                    {calendarStatus?.connectedProviders?.includes('calcom') && (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    )}
                  </button>
                  <button
                    onClick={() => setCalendarTab('calendly')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${calendarTab === 'calendly'
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-slate-500 hover:text-slate-600'
                      }`}
                  >
                    Calendly
                    {calendarStatus?.connectedProviders?.includes('calendly') && (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    )}
                  </button>
                </div>

                {/* Tab Content - Shows info when connected to this provider, or connect form otherwise */}
                
                {/* Google Calendar Tab */}
                {calendarTab === 'google' && (
                  calendarStatus?.connectedProviders?.includes('google') && !calendarEditing ? (
                    <div className="space-y-4">
                      {/* Connection Info */}
                      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                        <div>
                          <Label className="text-muted-foreground text-xs sm:text-sm">Provider</Label>
                          <p className="text-sm bg-slate-100 p-2 rounded mt-1">Google Calendar</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs sm:text-sm">Connected Account</Label>
                          <p className="text-sm bg-slate-100 p-2 rounded mt-1 truncate">{calendarStatus.email || 'Connected'}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs sm:text-sm">Timezone</Label>
                          <p className="text-sm bg-slate-100 p-2 rounded mt-1">{calendarStatus.timezone || 'Not set'}</p>
                        </div>
                      </div>
                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => setCalendarEditing(true)} size="sm" className="flex-1 sm:flex-none bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700 text-white">
                          Update Credentials
                        </Button>
                        <Button variant="destructive" onClick={() => handleRemoveCalendar('google')} size="sm" className="flex-1 sm:flex-none">
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Connect your Google Calendar to enable AI agents to check availability and book appointments automatically.
                      </p>
                      <div className="flex gap-2">
                        <Button onClick={handleConnectGoogle} disabled={calendarLoading} className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
                          {calendarLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connecting...</> : <><Calendar className="h-4 w-4 mr-2" />Connect Google Calendar</>}
                        </Button>
                        {calendarEditing && <Button variant="outline" onClick={() => setCalendarEditing(false)}>Cancel</Button>}
                      </div>
                    </div>
                  )
                )}

                {/* Cal.com Tab */}
                {calendarTab === 'calcom' && (
                  calendarStatus?.connectedProviders?.includes('calcom') && !calendarEditing ? (
                    <div className="space-y-4">
                      {/* Connection Info */}
                      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                        <div>
                          <Label className="text-muted-foreground text-xs sm:text-sm">Provider</Label>
                          <p className="text-sm bg-slate-100 p-2 rounded mt-1">Cal.com</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs sm:text-sm">Connected Account</Label>
                          <p className="text-sm bg-slate-100 p-2 rounded mt-1 truncate">{calendarStatus.username || calendarStatus.email || 'Connected'}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs sm:text-sm">Timezone</Label>
                          <p className="text-sm bg-slate-100 p-2 rounded mt-1">{calendarStatus.timezone || 'Not set'}</p>
                        </div>
                      </div>
                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => setCalendarEditing(true)} size="sm" className="flex-1 sm:flex-none bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700 text-white">
                          Update Credentials
                        </Button>
                        <Button variant="destructive" onClick={() => handleRemoveCalendar('calcom')} size="sm" className="flex-1 sm:flex-none">
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="calcomApiKey" className="text-muted-foreground text-xs sm:text-sm">Cal.com API Key</Label>
                        <div className="relative">
                          <Input
                            id="calcomApiKey"
                            type={showCalcomApiKey ? 'text' : 'password'}
                            value={calcomApiKey}
                            onChange={(e) => setCalcomApiKey(e.target.value)}
                            placeholder="cal_live_..."
                            className="font-mono text-sm pr-10"
                          />
                          <button type="button" onClick={() => setShowCalcomApiKey(!showCalcomApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showCalcomApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Get your API key from{' '}
                          <a href="https://app.cal.com/settings/developer/api-keys" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Cal.com Developer Settings</a>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleConnectCalcom} disabled={calendarLoading || !calcomApiKey} className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
                          {calendarLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connecting...</> : <><Calendar className="h-4 w-4 mr-2" />Connect Cal.com</>}
                        </Button>
                        {calendarEditing && <Button variant="outline" onClick={() => { setCalendarEditing(false); setCalcomApiKey(''); }}>Cancel</Button>}
                      </div>
                    </div>
                  )
                )}

                {/* Calendly Tab */}
                {calendarTab === 'calendly' && (
                  calendarStatus?.connectedProviders?.includes('calendly') && !calendarEditing ? (
                    <div className="space-y-4">
                      {/* Connection Info */}
                      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                        <div>
                          <Label className="text-muted-foreground text-xs sm:text-sm">Provider</Label>
                          <p className="text-sm bg-slate-100 p-2 rounded mt-1">Calendly</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs sm:text-sm">Connected Account</Label>
                          <p className="text-sm bg-slate-100 p-2 rounded mt-1 truncate">{calendarStatus.email || 'Connected'}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs sm:text-sm">Timezone</Label>
                          <p className="text-sm bg-slate-100 p-2 rounded mt-1">{calendarStatus.timezone || 'Not set'}</p>
                        </div>
                      </div>
                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => setCalendarEditing(true)} size="sm" className="flex-1 sm:flex-none bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700 text-white">
                          Update Credentials
                        </Button>
                        <Button variant="destructive" onClick={() => handleRemoveCalendar('calendly')} size="sm" className="flex-1 sm:flex-none">
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="calendlyToken" className="text-muted-foreground text-xs sm:text-sm">Personal Access Token</Label>
                        <div className="relative">
                          <Input
                            id="calendlyToken"
                            type={showCalendlyToken ? 'text' : 'password'}
                            value={calendlyToken}
                            onChange={(e) => setCalendlyToken(e.target.value)}
                            placeholder="Your Calendly Personal Access Token"
                            className="font-mono text-sm pr-10"
                          />
                          <button type="button" onClick={() => setShowCalendlyToken(!showCalendlyToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showCalendlyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Get your token from{' '}
                          <a href="https://calendly.com/integrations/api_webhooks" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Calendly API Settings</a>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleConnectCalendly} disabled={calendarLoading || !calendlyToken} className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
                          {calendarLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connecting...</> : <><Calendar className="h-4 w-4 mr-2" />Connect Calendly</>}
                        </Button>
                        {calendarEditing && <Button variant="outline" onClick={() => { setCalendarEditing(false); setCalendlyToken(''); }}>Cancel</Button>}
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Calendars Section - Always show */}
              <div className="border-t pt-6 mt-6">
                {/* Calendars Section Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-slate-600">Calendars</h3>
                    <p className="text-xs text-muted-foreground">Connected calendar integrations</p>
                  </div>
                </div>

                {/* Connected Calendars List - Simplified (agent assignment moved to Agent settings) */}
                {calendarStatus?.calendars && calendarStatus.calendars.length > 0 ? (
                  <div className="space-y-3">
                    {calendarStatus.calendars.map((cal) => (
                      <div key={cal.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border gap-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                            <Calendar className="h-5 w-5 text-teal-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-slate-600">
                              {cal.provider === 'google' ? 'Google Calendar' :
                                cal.provider === 'calcom' ? 'Cal.com' : 'Calendly'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {cal.provider === 'calcom'
                                ? `${cal.username || cal.email || 'Connected'}`
                                : `${cal.email || 'Connected'}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 ml-13 sm:ml-0">
                          {/* Delete Button */}
                          <DeleteButton
                            onDelete={async () => {
                              await api.disconnectCalendar(cal.provider);
                              fetchCalendarStatus();
                              toast({ title: 'Calendar disconnected', description: `${cal.provider === 'google' ? 'Google Calendar' : cal.provider === 'calcom' ? 'Cal.com' : 'Calendly'} has been disconnected.` });
                            }}
                            itemName={cal.provider === 'google' ? 'Google Calendar' : cal.provider === 'calcom' ? 'Cal.com' : 'Calendly'}
                            title="Remove Calendar"
                            description="This will disconnect this calendar from AI agents. You can reconnect it later."
                            confirmText="Remove"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Empty State */
                  <div className="flex flex-col items-center justify-center py-8 border rounded-lg bg-slate-50">
                    <Calendar className="h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-sm text-muted-foreground">No calendars connected</p>
                    <p className="text-xs text-muted-foreground">Connect a calendar provider above to get started</p>
                  </div>
                )}
              </div>

              {/* Removed: old empty state moved into the section above */}
              {!calendarStatus?.connected && (
                <div className="border-t pt-6 mt-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-slate-600">Calendars</h3>
                      <p className="text-xs text-muted-foreground">Enable agents to book events and navigate your schedule</p>
                    </div>
                    <div className="flex flex-col items-center justify-center py-8 border rounded-lg bg-slate-50">
                      <Calendar className="h-8 w-8 text-slate-400 mb-2" />
                      <p className="text-sm text-muted-foreground">No calendar connected</p>
                      <p className="text-xs text-muted-foreground">Connect a calendar provider above to get started</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Next Steps - only show if Twilio is configured but no phone numbers added yet */}
          {settings?.configured && !hasPhoneNumbers && (
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-600">Next Steps</CardTitle>
                <CardDescription>
                  Your Twilio account is connected. Here's what to do next:
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <a
                    href="/dashboard/phone-numbers"
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <Phone className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">Add Phone Numbers</p>
                        <p className="text-sm text-muted-foreground">
                          Import your Twilio phone numbers to use with agents
                        </p>
                      </div>
                    </div>
                    <span className="text-muted-foreground">→</span>
                  </a>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Organization Tab */}
      {settingsTab === 'organization' && (
        <div className="space-y-6">
          {/* Business Profile Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base sm:text-lg text-slate-600">Organization Profile</CardTitle>
                  {/* Help Tooltip */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowBusinessProfileHelp(!showBusinessProfileHelp)}
                      className="text-teal-500 hover:text-teal-700 transition-colors"
                      aria-label="About business profile"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                    {showBusinessProfileHelp && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowBusinessProfileHelp(false)}
                        />
                        <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-50 w-72 bg-white border rounded-lg shadow-lg p-4">
                          <h4 className="font-medium text-sm mb-2">Why set up an Organization Profile?</h4>
                          <p className="text-sm text-muted-foreground">
                            This information helps your AI agents introduce themselves properly. When agents make or receive calls, they'll use your organization name and context to sound professional and authentic.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:ml-0">
                  {businessProfile?.isComplete ? (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Complete
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-slate-500">
                      <XCircle className="h-4 w-4" />
                      Incomplete
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {businessProfileLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="organizationName" className="text-muted-foreground">
                      Organization Name *
                    </Label>
                    <Input
                      id="organizationName"
                      placeholder="e.g., Acme Dental, Smith Law Firm"
                      value={businessProfileForm.organizationName}
                      onChange={(e) => setBusinessProfileForm(prev => ({ ...prev, organizationName: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="industry" className="text-muted-foreground">
                      Industry
                    </Label>
                    <Input
                      id="industry"
                      placeholder="e.g., Healthcare, Legal Services, Real Estate"
                      value={businessProfileForm.industry}
                      onChange={(e) => setBusinessProfileForm(prev => ({ ...prev, industry: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessDescription" className="text-muted-foreground">
                      Business Description
                    </Label>
                    <textarea
                      id="businessDescription"
                      className="w-full min-h-[100px] p-3 border rounded-md text-sm"
                      placeholder="Brief description of your business, services offered, and what makes you unique..."
                      value={businessProfileForm.businessDescription}
                      onChange={(e) => setBusinessProfileForm(prev => ({ ...prev, businessDescription: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">

                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleSaveBusinessProfile}
                      disabled={businessProfileSaving}
                      className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700"
                    >
                      {businessProfileSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Profile'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preferences Tab */}
      {settingsTab === 'preferences' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-slate-600">Preferences</CardTitle>
              <CardDescription>Configure your account preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Settings className="h-12 w-12 text-slate-300 mb-4" />
                <p className="text-muted-foreground">Preference settings coming soon</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

