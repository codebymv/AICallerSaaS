'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { Settings, Phone, CheckCircle, XCircle, Loader2, ExternalLink, Eye, EyeOff, HelpCircle, Calendar, RefreshCw, Bot, ChevronDown, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

// Custom Agent Selector with avatars
function AgentSelector({
  agents,
  selectedAgentId,
  onSelect,
  disabled,
}: {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelect: (agentId: string) => void;
  disabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const selectedAvatar = selectedAgent ? getVoiceAvatar(selectedAgent.voice) : null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-3 px-3 py-2.5 text-sm border rounded-md bg-white disabled:opacity-50 min-w-[180px] justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {selectedAgent ? (
            <>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {selectedAvatar ? (
                  <Image
                    src={selectedAvatar}
                    alt={selectedAgent.name}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Bot className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <span className="truncate font-medium">{selectedAgent.name}</span>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Bot className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-muted-foreground">No agent</span>
            </>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] bg-white border rounded-md shadow-lg py-1 max-h-60 overflow-auto right-0 sm:right-auto">
          <button
            type="button"
            onClick={() => {
              onSelect('');
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Bot className="h-5 w-5 text-muted-foreground" />
            </div>
            <span className="text-muted-foreground">No agent</span>
          </button>
          {agents.map((agent) => {
            const avatar = getVoiceAvatar(agent.voice);
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  onSelect(agent.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 text-left ${
                  agent.id === selectedAgentId ? 'bg-blue-50' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {avatar ? (
                    <Image
                      src={avatar}
                      alt={agent.name}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Bot className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <span className="truncate font-medium">{agent.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
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
  const [calendarEditing, setCalendarEditing] = useState(false);
  
  // Cal.com state
  const [calcomApiKey, setCalcomApiKey] = useState('');
  const [showCalcomApiKey, setShowCalcomApiKey] = useState(false);
  const [calcomEventTypes, setCalcomEventTypes] = useState<CalComEventType[]>([]);
  const [calendarTab, setCalendarTab] = useState<'calcom' | 'calendly'>('calcom');

  // Settings page tab state
  const [settingsTab, setSettingsTab] = useState<'integrations' | 'preferences'>('integrations');

  // Phone numbers state
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingPhoneNumbers, setLoadingPhoneNumbers] = useState(false);
  const [updatingNumber, setUpdatingNumber] = useState<string | null>(null);

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

  useEffect(() => {
    fetchSettings();
    fetchPhoneNumbersAndAgents();
    fetchCalendarStatus();
    fetchBusinessProfile();
  }, []);

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

  const handleAssignAgent = async (numberId: string, agentId: string) => {
    setUpdatingNumber(numberId);
    
    // Optimistic update
    const selectedAgentObj = agents.find(a => a.id === agentId);
    setPhoneNumbers(prev => prev.map(num => 
      num.id === numberId 
        ? { ...num, agent: agentId ? selectedAgentObj : null }
        : num
    ));
    
    try {
      await api.updatePhoneNumber(numberId, { agentId: agentId || null });
      toast({
        title: 'Agent assigned',
        description: 'Phone number updated successfully.',
      });
      await fetchPhoneNumbersAndAgents();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to assign agent';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      await fetchPhoneNumbersAndAgents();
    } finally {
      setUpdatingNumber(null);
    }
  };

  const handleDeletePhoneNumber = async (id: string) => {
    if (!confirm('Are you sure you want to remove this phone number?')) return;

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
    if (!confirm('Are you sure you want to remove your calendar integration?')) return;

    try {
      await api.disconnectCalendar();
      setCalendarStatus(null);
      setEventTypes([]);
      setSelectedEventType('');
      toast({
        title: 'Calendar removed',
        description: 'Your calendar integration has been removed.',
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to remove calendar';
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
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            settingsTab === 'integrations'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Integrations
        </button>
        <button
          onClick={() => setSettingsTab('preferences')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            settingsTab === 'preferences'
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
              <CardTitle className="text-base sm:text-lg text-slate-600">Twilio</CardTitle>
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
          {/* Credentials Form */}
          {settings?.configured && !editing ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
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
              
              {/* Messaging Service SID - Editable inline */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="messagingServiceSidConfigured" className="text-muted-foreground text-xs sm:text-sm">Messaging Service SID</Label>
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
                  id="messagingServiceSidConfigured"
                  value={messagingServiceSid}
                  onChange={(e) => setMessagingServiceSid(e.target.value)}
                  placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="font-mono text-xs sm:text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your Twilio Messaging Service SID for reliable SMS delivery in the US.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { setEditing(true); }} size="sm" className="flex-1 sm:flex-none bg-teal-600 hover:bg-teal-700 text-white">
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

              {/* Phone Numbers Section */}
              <div className="border-t pt-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-slate-600">Phone Numbers</h3>
                    <p className="text-xs text-muted-foreground">Assign agents to your Twilio phone numbers</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchPhoneNumbersAndAgents} 
                    disabled={loadingPhoneNumbers}
                    className="text-teal-600 border-teal-600"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingPhoneNumbers ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
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
                          <p className="font-mono font-medium text-sm text-slate-600">
                            {formatPhoneNumber(number.phoneNumber)}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2 sm:gap-3 ml-13 sm:ml-0">
                          <AgentSelector
                            agents={agents}
                            selectedAgentId={number.agent?.id || null}
                            onSelect={(agentId) => handleAssignAgent(number.id, agentId)}
                            disabled={updatingNumber === number.id || agents.length === 0}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePhoneNumber(number.id)}
                            className="flex-shrink-0"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    <p className="text-xs text-muted-foreground text-center pt-2">
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
                    </p>
                  </div>
                )}
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
                      <p className="font-medium text-foreground">Cal.com (Recommended)</p>
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
          {calendarStatus?.connected && !calendarEditing ? (
            <div className="space-y-4">
              {/* Connection Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground text-xs sm:text-sm">Connected Account</Label>
                  <p className="text-sm bg-slate-100 p-2 rounded mt-1">
                    {calendarStatus.provider === 'calcom' 
                      ? `${calendarStatus.username || calendarStatus.email || 'User'} (Cal.com)`
                      : `${calendarStatus.email || 'User'} (Calendly)`}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs sm:text-sm">Timezone</Label>
                  <p className="text-sm bg-slate-100 p-2 rounded mt-1">
                    {calendarStatus.timezone || 'Not set'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={() => setCalendarEditing(true)} 
                  size="sm" 
                  className="flex-1 sm:flex-none bg-teal-600 hover:bg-teal-700 text-white"
                >
                  Update Credentials
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => fetchEventTypes(calendarStatus?.provider)} 
                  size="sm" 
                  className="flex-1 sm:flex-none text-teal-600 border-teal-600"
                >
                  Test Connection
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDisconnectCalendar} 
                  size="sm" 
                  className="flex-1 sm:flex-none"
                >
                  Remove
                </Button>
              </div>

              {/* Event Types Section */}
              <div className="border-t pt-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-slate-600">Event Types</h3>
                    <p className="text-xs text-muted-foreground">Select an event type for AI agents to book</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => fetchEventTypes(calendarStatus?.provider)}
                    className="text-teal-600 border-teal-600"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                {/* Cal.com Event Types */}
                {calendarStatus.provider === 'calcom' && (
                  <>
                    {calcomEventTypes.length > 0 ? (
                      <div className="space-y-3">
                        {calcomEventTypes.map((et) => (
                          <div
                            key={et.id}
                            onClick={() => handleSelectCalcomEventType(et.id)}
                            className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                              calendarStatus.eventTypeName === et.title
                                ? 'border-teal-500 bg-teal-50'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            } ${savingEventType ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                                <Calendar className="h-5 w-5 text-teal-600" />
                              </div>
                              <div>
                                <p className="font-medium text-sm text-slate-600">{et.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {et.duration ? `${et.duration} minutes` : ''}
                                  {et.duration && et.description && ' • '}
                                  {et.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8 border rounded-lg bg-slate-50">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading event types...
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Calendly Event Types */}
                {calendarStatus.provider === 'calendly' && (
                  <>
                    {eventTypes.length > 0 ? (
                      <div className="space-y-3">
                        {eventTypes.map((et) => (
                          <div
                            key={et.uri}
                            onClick={() => handleSelectEventType(et.uri!)}
                            className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                              calendarStatus.eventTypeName === et.name
                                ? 'border-teal-500 bg-teal-50'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            } ${savingEventType ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                                <Calendar className="h-5 w-5 text-teal-600" />
                              </div>
                              <div>
                                <p className="font-medium text-sm text-slate-600">{et.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {et.duration} minutes
                                  {et.description && ` • ${et.description}`}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8 border rounded-lg bg-slate-50">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading event types...
                        </div>
                      </div>
                    )}
                  </>
                )}
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
                      : 'border-transparent text-slate-500 hover:text-slate-600'
                  }`}
                >
                  Cal.com (Recommended)
                </button>
                <button
                  onClick={() => setCalendarTab('calendly')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    calendarTab === 'calendly'
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-slate-500 hover:text-slate-600'
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
      )}

      {/* Preferences Tab */}
      {settingsTab === 'preferences' && (
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
                      className="bg-teal-600 hover:bg-teal-700"
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
    </div>
  );
}

