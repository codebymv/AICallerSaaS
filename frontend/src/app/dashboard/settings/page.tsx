'use client';

import { useEffect, useState } from 'react';
import { Settings, Phone, CheckCircle, XCircle, Loader2, ExternalLink, Eye, EyeOff, HelpCircle, Calendar, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface TwilioSettings {
  configured: boolean;
  accountSid: string | null;
  authTokenSet: boolean;
  authTokenMasked: string | null;
}

interface CalendarStatus {
  connected: boolean;
  configured: boolean;
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

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<TwilioSettings | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [hasPhoneNumbers, setHasPhoneNumbers] = useState(false);
  
  // Form state
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
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
  const [calendarEditing, setCalendarEditing] = useState(false);
  const [showCalendarHelp, setShowCalendarHelp] = useState(false);
  
  // Cal.com state
  const [calcomApiKey, setCalcomApiKey] = useState('');
  const [showCalcomApiKey, setShowCalcomApiKey] = useState(false);
  const [calcomEventTypes, setCalcomEventTypes] = useState<CalComEventType[]>([]);
  const [calendarTab, setCalendarTab] = useState<'calcom' | 'calendly'>('calcom');

  useEffect(() => {
    fetchSettings();
    fetchPhoneNumbers();
    fetchCalendarStatus();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.getTwilioSettings();
      setSettings(response.data || null);
      if (response.data?.accountSid) {
        setAccountSid(response.data.accountSid);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPhoneNumbers = async () => {
    try {
      const response = await api.getPhoneNumbers();
      setHasPhoneNumbers((response.data || []).length > 0);
    } catch (error) {
      console.error('Failed to fetch phone numbers:', error);
    }
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
        setCalendarEditing(false);
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
        setCalendarEditing(false);
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

  const handleDisconnectCalendar = async () => {
    if (!confirm('Are you sure you want to disconnect your calendar?')) return;

    try {
      await api.disconnectCalendar();
      setCalendarStatus(null);
      setEventTypes([]);
      setSelectedEventType('');
      toast({
        title: 'Calendar disconnected',
        description: 'Your Calendly account has been disconnected.',
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to disconnect calendar';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
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
      await api.updateTwilioSettings(accountSid, authToken);
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

  const handleTest = async () => {
    setTesting(true);
    try {
      const response = await api.testTwilioConnection();
      toast({
        title: 'Connection successful!',
        description: `Connected to: ${response.data?.accountName} (${response.data?.accountStatus})`,
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Connection test failed';
      toast({
        title: 'Connection failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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

      {/* Twilio Integration */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg text-slate-600">Twilio Integration</CardTitle>
              {/* Help Tooltip */}
              <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowHelp(!showHelp)}
                      className="text-teal-500 hover:text-teal-700 transition-colors"
                      aria-label="How to get Twilio credentials"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                    {showHelp && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setShowHelp(false)}
                        />
                        <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-50 w-72 bg-white border rounded-lg shadow-lg p-4">
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
                      </>
                    )}
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
          {/* Credentials Form */}
          {settings?.configured && !editing ? (
            <div className="space-y-4">
              <div className="grid gap-4">
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
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setEditing(true)} size="sm" className="flex-1 sm:flex-none bg-teal-600 hover:bg-teal-700 text-white">
                  Update Credentials
                </Button>
                <Button variant="outline" onClick={handleTest} disabled={testing} size="sm" className="flex-1 sm:flex-none text-teal-600 border-teal-600">
                  {testing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Connection'
                  )}
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
                  <Label htmlFor="accountSid">Account SID</Label>
                  <Input
                    id="accountSid"
                    value={accountSid}
                    onChange={(e) => setAccountSid(e.target.value)}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authToken">Auth Token</Label>
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
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
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
        </CardContent>
      </Card>

      {/* Calendar Integration */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg text-slate-600">Calendar Integration</CardTitle>
              {/* Help Tooltip */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCalendarHelp(!showCalendarHelp)}
                  className="text-teal-500 hover:text-teal-700 transition-colors"
                  aria-label="Calendar integration help"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
                {showCalendarHelp && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowCalendarHelp(false)}
                    />
                    <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-50 w-80 bg-white border rounded-lg shadow-lg p-4">
                      <h4 className="font-medium text-sm mb-2">Calendar Integration Options</h4>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        <div>
                          <p className="font-medium text-foreground">Cal.com (Recommended)</p>
                          <p>Full programmatic booking - AI can directly create appointments without any follow-up needed.</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Calendly</p>
                          <p>Availability checking only - AI can see open slots but cannot book directly (API limitation).</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-13 sm:ml-0">
              {calendarStatus?.connected ? (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  {calendarStatus.provider === 'calcom' ? 'Cal.com' : 'Calendly'} Connected
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
          {calendarStatus?.connected && !calendarEditing ? (
            <div className="space-y-4">
              {/* Connection Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground text-xs sm:text-sm">Connected Account</Label>
                  <p className="text-sm bg-slate-100 p-2 rounded mt-1">
                    {calendarStatus.provider === 'calcom' 
                      ? (calendarStatus.username || calendarStatus.email || 'Cal.com User')
                      : (calendarStatus.email || 'Calendly User')}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs sm:text-sm">Timezone</Label>
                  <p className="text-sm bg-slate-100 p-2 rounded mt-1">
                    {calendarStatus.timezone || 'Not set'}
                  </p>
                </div>
              </div>

              {/* Provider badge */}
              {calendarStatus.provider === 'calcom' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    ✨ <strong>Direct Booking Enabled</strong> - AI agents can book appointments automatically without any follow-up needed.
                  </p>
                </div>
              )}

              {/* Event Type Selection for Cal.com */}
              {calendarStatus.provider === 'calcom' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Event Type for AI Booking</Label>
                  {calcomEventTypes.length > 0 ? (
                    <div className="space-y-2">
                      {calcomEventTypes.map((et) => (
                        <button
                          key={et.id}
                          onClick={() => handleSelectCalcomEventType(et.id)}
                          disabled={savingEventType}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            calendarStatus.eventTypeName === et.title
                              ? 'border-teal-500 bg-teal-50'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{et.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {et.duration} minutes
                                {et.description && ` • ${et.description}`}
                              </p>
                            </div>
                            {calendarStatus.eventTypeName === et.title && (
                              <CheckCircle className="h-5 w-5 text-teal-600" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading event types...
                    </div>
                  )}
                </div>
              )}

              {/* Event Type Selection for Calendly */}
              {calendarStatus.provider === 'calendly' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Event Type for AI Booking</Label>
                  {eventTypes.length > 0 ? (
                    <div className="space-y-2">
                      {eventTypes.map((et) => (
                        <button
                          key={et.uri}
                          onClick={() => handleSelectEventType(et.uri!)}
                          disabled={savingEventType}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            calendarStatus.eventTypeName === et.name
                              ? 'border-teal-500 bg-teal-50'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{et.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {et.duration} minutes
                                {et.description && ` • ${et.description}`}
                              </p>
                            </div>
                            {calendarStatus.eventTypeName === et.name && (
                              <CheckCircle className="h-5 w-5 text-teal-600" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading event types...
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => setCalendarEditing(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  Update Credentials
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchEventTypes(calendarStatus?.provider)}
                  className="text-teal-600 border-teal-600"
                >
                  Refresh Event Types
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDisconnectCalendar}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tab selection */}
              <div className="flex border-b">
                <button
                  onClick={() => setCalendarTab('calcom')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    calendarTab === 'calcom'
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Cal.com (Recommended)
                </button>
                <button
                  onClick={() => setCalendarTab('calendly')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    calendarTab === 'calendly'
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Calendly
                </button>
              </div>

              {/* Cal.com Tab */}
              {calendarTab === 'calcom' && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-sm mb-2 text-green-800">Why Cal.com?</h4>
                    <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
                      <li><strong>Direct booking</strong> - AI can create appointments automatically</li>
                      <li>Check real-time availability</li>
                      <li>Confirmation emails sent instantly</li>
                      <li>No follow-up or manual confirmation needed</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="calcomApiKey">Cal.com API Key</Label>
                    <div className="relative">
                      <Input
                        id="calcomApiKey"
                        type={showCalcomApiKey ? 'text' : 'password'}
                        value={calcomApiKey}
                        onChange={(e) => setCalcomApiKey(e.target.value)}
                        placeholder="cal_live_..."
                        className="font-mono text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCalcomApiKey(!showCalcomApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showCalcomApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{' '}
                      <a 
                        href="https://app.cal.com/settings/developer/api-keys" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-teal-600 hover:underline"
                      >
                        Cal.com Developer Settings
                      </a>
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleConnectCalcom}
                      disabled={calendarLoading || !calcomApiKey}
                      className="bg-teal-600 hover:bg-teal-700"
                    >
                      {calendarLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Calendar className="h-4 w-4 mr-2" />
                          Connect Cal.com
                        </>
                      )}
                    </Button>
                    {calendarEditing && (
                      <Button variant="outline" onClick={() => {
                        setCalendarEditing(false);
                        setCalcomApiKey('');
                      }}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Calendly Tab */}
              {calendarTab === 'calendly' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 className="font-medium text-sm mb-2 text-amber-800">Calendly Limitation</h4>
                    <p className="text-sm text-amber-700">
                      Calendly's API doesn't support direct booking. AI agents can check availability but appointments require manual follow-up.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="calendlyToken">Personal Access Token</Label>
                    <div className="relative">
                      <Input
                        id="calendlyToken"
                        type={showCalendlyToken ? 'text' : 'password'}
                        value={calendlyToken}
                        onChange={(e) => setCalendlyToken(e.target.value)}
                        placeholder="Your Calendly Personal Access Token"
                        className="font-mono text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCalendlyToken(!showCalendlyToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showCalendlyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Get your token from{' '}
                      <a 
                        href="https://calendly.com/integrations/api_webhooks" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-teal-600 hover:underline"
                      >
                        Calendly API Settings
                      </a>
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleConnectCalendly}
                      disabled={calendarLoading || !calendlyToken}
                      className="bg-teal-600 hover:bg-teal-700"
                    >
                      {calendarLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Calendar className="h-4 w-4 mr-2" />
                          Connect Calendly
                        </>
                      )}
                    </Button>
                    {calendarEditing && (
                      <Button variant="outline" onClick={() => {
                        setCalendarEditing(false);
                        setCalendlyToken('');
                      }}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}
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
  );
}

