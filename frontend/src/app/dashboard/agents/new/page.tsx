'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES, AGENT_MODES, AgentMode, CALL_PURPOSES, CallPurposeType, getSystemPromptForMode, BusinessContext, COMMUNICATION_CHANNELS, CommunicationChannel, supportsVoice, supportsMessaging, getModeDescription, MEDIA_TOOLS } from '@/lib/constants';
import { VoiceSelector } from '@/components/VoiceSelector';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ArrowLeft, Bot, Sparkles, Calendar, Wrench, Phone, AlertCircle, Building2, HelpCircle, ClipboardList, Bell, Edit, MessageCircle, Clock, ChevronDown, Settings, MessageSquare, Layers, Image as ImageIcon, FileText, Video } from 'lucide-react';

const getModeIcon = (mode: string) => {
  switch (mode) {
    case 'INBOUND':
      return <ArrowDownLeft className="h-4 w-4 text-teal-600" />;
    case 'OUTBOUND':
      return <ArrowUpRight className="h-4 w-4 text-teal-600" />;
    case 'HYBRID':
      return <ArrowLeftRight className="h-4 w-4 text-teal-600" />;
    default:
      return null;
  }
};

const getCallPurposeIcon = (purposeType: string) => {
  const className = 'h-3 w-3 text-teal-600';
  switch (purposeType) {
    case 'SCHEDULE_APPOINTMENTS':
      return <Calendar className={className} />;
    case 'ANSWER_SUPPORT':
      return <HelpCircle className={className} />;
    case 'COLLECT_INFO':
      return <ClipboardList className={className} />;
    case 'SEND_REMINDERS':
      return <Bell className={className} />;
    case 'GENERAL_INQUIRIES':
      return <MessageCircle className={className} />;
    case 'CUSTOM':
      return <Edit className={className} />;
    default:
      return null;
  }
};

const getChannelIcon = (channel: string) => {
  const className = 'h-4 w-4 text-teal-600';
  switch (channel) {
    case 'VOICE_ONLY':
      return <Phone className={className} />;
    case 'MESSAGING_ONLY':
      return <MessageSquare className={className} />;
    case 'OMNICHANNEL':
      return <Layers className={className} />;
    default:
      return null;
  }
};

// Phone number interface
interface PhoneNumber {
  id: string;
  phoneNumber: string;
  twilioSid?: string;
  friendlyName?: string;
  isActive: boolean;
  agent?: { id: string; name: string } | null;
}

// Format phone number for display
const formatPhoneNumber = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

// Templates are now separate from mode-specific prompts
const templates = [
  {
    id: 'mode-default',
    name: 'Mode-Optimized',
    description: 'Auto-generated prompt optimized for your selected mode',
    prompt: '', // Will be generated based on mode
    isDefault: true,
  },
  {
    id: 'custom',
    name: 'Custom Agent',
    description: 'Start from scratch with your own prompt',
    prompt: '',
  },
];

export default function NewAgentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<{ 
    calendars?: Array<{ id: string; provider: string; email?: string; username?: string }>;
    connectedProviders?: string[];
    provider?: string; 
    eventTypeName?: string 
  } | null>(null);
  
  // Event types state for calendar configuration
  const [eventTypes, setEventTypes] = useState<Array<{ id: string; name: string; duration: number }>>([]);
  const [loadingEventTypes, setLoadingEventTypes] = useState(false);
  
  // Phone number state
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>('');
  const [phoneNumbersLoading, setPhoneNumbersLoading] = useState(true);
  const [twilioConfigured, setTwilioConfigured] = useState(false);
  const [phoneDropdownOpen, setPhoneDropdownOpen] = useState(false);
  const phoneDropdownRef = useRef<HTMLDivElement>(null);
  const [organizationDropdownOpen, setOrganizationDropdownOpen] = useState(false);
  const organizationDropdownRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState<{
   name: string;
    template: string;
   systemPrompt: string;
   voiceId: string;
   voiceSettings: { stability: number; similarity_boost: number; style: number } | null;
   greeting: string;
   mode: AgentMode;
   communicationChannel: CommunicationChannel;
   outboundGreeting: string;
   callTimeout: number;
   retryAttempts: number;
   callWindowStart: string;
   callWindowEnd: string;
   calendarEnabled: boolean;
   // Calendar configuration (agent-centric)
   calendarIntegrationId: string;
   calendarScopes: string[];
   defaultEventTypeId: string;
   defaultEventTypeName: string;
   defaultEventDuration: number;
   callPurposeType: CallPurposeType;
   callPurpose: string;
   // Messaging-specific fields
   messagingGreeting: string;
   // Media tool access
   imageToolEnabled: boolean;
   documentToolEnabled: boolean;
   videoToolEnabled: boolean;
}>({
    name: '',
    template: 'mode-default',
    systemPrompt: getSystemPromptForMode('INBOUND', false), // Default to inbound mode prompt
    voiceId: ELEVENLABS_VOICES[0].id,
    voiceSettings: null, // Will be loaded from voice defaults
    greeting: '',
    mode: 'INBOUND',
    communicationChannel: 'VOICE_ONLY',
    outboundGreeting: '',
    callTimeout: 600,
    retryAttempts: 0,
    callWindowStart: '',
    callWindowEnd: '',
    calendarEnabled: false,
    // Calendar configuration defaults (all scopes enabled by default)
    calendarIntegrationId: '',
    calendarScopes: ['read_calendar', 'create_events', 'reschedule_events'],
    defaultEventTypeId: '',
    defaultEventTypeName: '',
    defaultEventDuration: 30,
    callPurposeType: 'SCHEDULE_APPOINTMENTS',
    callPurpose: CALL_PURPOSES.SCHEDULE_APPOINTMENTS.value,
    // Messaging defaults
    messagingGreeting: '',
    imageToolEnabled: false,
    documentToolEnabled: false,
    videoToolEnabled: false,
  });

  // Load voice defaults from localStorage on mount
  useEffect(() => {
    const savedVoiceDefaults = localStorage.getItem('voiceDefaults');
    if (savedVoiceDefaults) {
      try {
        const defaults = JSON.parse(savedVoiceDefaults);
        if (defaults.voice || defaults.settings) {
          setFormData(prev => ({
            ...prev,
            voiceId: defaults.voice || prev.voiceId,
            voiceSettings: defaults.settings || null,
          }));
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Business profile state
  const [businessProfile, setBusinessProfile] = useState<{
    organizationName: string | null;
    industry: string | null;
    businessDescription: string | null;
    isComplete: boolean;
  } | null>(null);

  // Check calendar status and fetch phone numbers on load
  useEffect(() => {
    const checkCalendar = async () => {
      try {
        const response = await api.getCalendarStatus();
        const calendars = response.data?.calendars || [];
        setCalendarConnected(calendars.length > 0);
        setCalendarStatus(response.data || null);
        
        // Set default calendar integration if calendars are connected
        if (calendars.length > 0) {
          setFormData(prev => ({
            ...prev,
            calendarIntegrationId: calendars[0].id, // Default to first calendar
            systemPrompt: prev.template === 'mode-default' 
              ? getSystemPromptForMode(prev.mode, true) 
              : prev.systemPrompt
          }));
        }
      } catch {
        // Ignore errors
      }
    };
    
    const fetchPhoneNumbers = async () => {
      setPhoneNumbersLoading(true);
      try {
        // First check if Twilio is configured
        const twilioRes = await api.getTwilioSettings();
        setTwilioConfigured(twilioRes.data?.configured || false);
        
        if (twilioRes.data?.configured) {
          const numbersRes = await api.getPhoneNumbers();
          const numbers = numbersRes.data || [];
          setPhoneNumbers(numbers);
          
          // Auto-select first available number (prefer unassigned)
          if (numbers.length > 0) {
            const unassigned = numbers.find((p: any) => !p.agent);
            setSelectedPhoneNumberId(unassigned?.id || numbers[0].id);
          }
        }
      } catch {
        // Ignore errors
      } finally {
        setPhoneNumbersLoading(false);
      }
    };
    
    checkCalendar();
    fetchPhoneNumbers();
    fetchBusinessProfile();
  }, []);

  // Fetch event types when a calendar is selected
  const fetchEventTypes = async (calendarId: string) => {
    if (!calendarId || !calendarStatus?.calendars) return;
    
    const calendar = calendarStatus.calendars.find(c => c.id === calendarId);
    if (!calendar) return;
    
    setLoadingEventTypes(true);
    try {
      let types: Array<{ id: string; name: string; duration: number }> = [];
      
      if (calendar.provider === 'calcom') {
        const response = await api.getCalcomEventTypes();
        types = (response.data || []).map((et: any) => ({
          id: String(et.id),
          name: et.title,
          duration: et.duration,
        }));
      } else if (calendar.provider === 'calendly') {
        const response = await api.getCalendarEventTypes();
        types = (response.data || []).map((et: any) => ({
          id: et.uri,
          name: et.name,
          duration: et.duration,
        }));
      }
      // Google Calendar doesn't have event types - uses duration instead
      
      setEventTypes(types);
      
      // Auto-select first event type if available
      if (types.length > 0 && !formData.defaultEventTypeId) {
        setFormData(prev => ({
          ...prev,
          defaultEventTypeId: types[0].id,
          defaultEventTypeName: types[0].name,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch event types:', error);
    } finally {
      setLoadingEventTypes(false);
    }
  };

  // Fetch event types when calendar selection changes
  useEffect(() => {
    if (formData.calendarIntegrationId && formData.calendarEnabled) {
      fetchEventTypes(formData.calendarIntegrationId);
    }
  }, [formData.calendarIntegrationId, formData.calendarEnabled]);

  // Handle clicks outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (phoneDropdownRef.current && !phoneDropdownRef.current.contains(event.target as Node)) {
        setPhoneDropdownOpen(false);
      }
      if (organizationDropdownRef.current && !organizationDropdownRef.current.contains(event.target as Node)) {
        setOrganizationDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch business profile
  const fetchBusinessProfile = async () => {
    try {
      const response = await api.getBusinessProfile();
      setBusinessProfile(response.data || null);
    } catch {
      // Ignore errors
    }
  };

  // Build business context for system prompt
  const buildBusinessContext = (): BusinessContext | undefined => {
    const voiceName = ELEVENLABS_VOICES.find(v => v.id === formData.voiceId)?.name;
    if (!businessProfile?.organizationName && !voiceName && !formData.callPurpose) {
      return undefined;
    }
    return {
      organizationName: businessProfile?.organizationName || undefined,
      industry: businessProfile?.industry || undefined,
      businessDescription: businessProfile?.businessDescription || undefined,
      personaName: voiceName || undefined,
      callPurpose: formData.callPurpose || undefined,
    };
  };

  // Update system prompt when mode changes (for mode-default template)
  const handleModeChange = (newMode: AgentMode) => {
    setFormData(prev => {
      const updates: Partial<typeof prev> = { mode: newMode };
      
      // If using mode-default template, update the system prompt with business context
      if (prev.template === 'mode-default') {
        updates.systemPrompt = getSystemPromptForMode(newMode, calendarConnected, buildBusinessContext(), prev.communicationChannel);
      }
      
      return { ...prev, ...updates };
    });
  };

  // Update system prompt when communication channel changes
  const handleChannelChange = (newChannel: CommunicationChannel) => {
    setFormData(prev => {
      const updates: Partial<typeof prev> = { communicationChannel: newChannel };
      
      // If using mode-default template, update the system prompt for the new channel
      if (prev.template === 'mode-default') {
        updates.systemPrompt = getSystemPromptForMode(prev.mode, calendarConnected, buildBusinessContext(), newChannel);
      }
      
      return { ...prev, ...updates };
    });
  };

  // Update system prompt when template changes
  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    setFormData(prev => {
      const updates: Partial<typeof prev> = { template: templateId };
      
      if (templateId === 'mode-default') {
        updates.systemPrompt = getSystemPromptForMode(prev.mode, calendarConnected, buildBusinessContext(), prev.communicationChannel);
      } else if (template) {
        updates.systemPrompt = template.prompt;
      }
      
      return { ...prev, ...updates };
    });
  };

  const selectedTemplate = templates.find((t) => t.id === formData.template);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Name required', description: 'Please enter a name for your agent.', variant: 'destructive' });
      return;
    }
    
    const prompt = formData.systemPrompt || selectedTemplate?.prompt;
    if (!prompt?.trim()) {
      toast({ title: 'Prompt required', description: 'Please enter a system prompt.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Determine if we should include voice settings based on channel
      const includeVoice = supportsVoice(formData.communicationChannel);
      
      const response = await api.createAgent({
        name: formData.name,
        systemPrompt: prompt,
        // Only include voice settings if channel supports voice
        voiceId: includeVoice ? formData.voiceId : undefined,
        voiceSettings: includeVoice ? (formData.voiceSettings || undefined) : undefined,
        greeting: includeVoice ? formData.greeting : undefined,
        template: formData.template !== 'custom' ? formData.template : undefined,
        mode: formData.mode,
        communicationChannel: formData.communicationChannel,
        outboundGreeting: includeVoice ? (formData.outboundGreeting || undefined) : undefined,
        callTimeout: formData.callTimeout,
        retryAttempts: formData.retryAttempts,
        callWindowStart: formData.callWindowStart || undefined,
        callWindowEnd: formData.callWindowEnd || undefined,
        // Calendar configuration (agent-centric)
        calendarEnabled: formData.calendarEnabled,
        calendarIntegrationId: formData.calendarEnabled ? formData.calendarIntegrationId || undefined : undefined,
        calendarScopes: formData.calendarEnabled ? formData.calendarScopes : undefined,
        defaultEventTypeId: formData.calendarEnabled ? formData.defaultEventTypeId || undefined : undefined,
        defaultEventTypeName: formData.calendarEnabled ? formData.defaultEventTypeName || undefined : undefined,
        defaultEventDuration: formData.calendarEnabled ? formData.defaultEventDuration : undefined,
        personaName: includeVoice ? (ELEVENLABS_VOICES.find(v => v.id === formData.voiceId)?.name || undefined) : undefined,
        callPurpose: formData.callPurpose || undefined,
        // Messaging-specific fields
        messagingGreeting: supportsMessaging(formData.communicationChannel) ? (formData.messagingGreeting || undefined) : undefined,
        // Media tool access
        imageToolEnabled: supportsMessaging(formData.communicationChannel) ? formData.imageToolEnabled : false,
        documentToolEnabled: supportsMessaging(formData.communicationChannel) ? formData.documentToolEnabled : false,
        videoToolEnabled: supportsMessaging(formData.communicationChannel) ? formData.videoToolEnabled : false,
      });

      const agentId = response.data.id;

      // If a phone number was selected, assign it to this agent
      if (selectedPhoneNumberId) {
        try {
          await api.updatePhoneNumber(selectedPhoneNumberId, { agentId });
        } catch (phoneError) {
          // Agent was created but phone assignment failed - still redirect but notify
          console.error('Failed to assign phone number:', phoneError);
          toast({ 
            title: 'Agent created with warning', 
            description: `${formData.name} was created but phone number assignment failed. You can assign it in Settings.`,
          });
          router.push(`/dashboard/agents/${agentId}`);
          return;
        }
      }

      toast({ title: 'Agent created!', description: `${formData.name} is ready to use.` });
      router.push(`/dashboard/agents/${agentId}`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to create agent';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Bot className="h-8 w-8 text-slate-600" />
        <h1 className="text-3xl font-bold text-slate-600">Create New Agent</h1>
        <span className="hidden sm:inline text-slate-400">•</span>
        <p className="text-muted-foreground w-full sm:w-auto">Build an AI voice agent step by step</p>
      </div>

      {/* Step 1: Choose Template */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-600">Choose a Template</CardTitle>
            {/* <CardDescription>Start with a pre-built template or create from scratch</CardDescription> */}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <button
                  key={template.id}
                  className={`p-4 border rounded-lg text-left hover:border-teal-400 transition-colors ${
                    formData.template === template.id ? 'border-teal-500 bg-teal-50' : ''
                  }`}
                  onClick={() => handleTemplateChange(template.id)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <h3 className="font-semibold text-slate-600">{template.name}</h3>
                    {'isDefault' in template && template.isDefault && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-teal-100 text-teal-700 w-fit">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                </button>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/agents')} className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => setStep(2)} className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Basic Info */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-600">Basic Information</CardTitle>
            <CardDescription>Set up your agent's identity and behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-muted-foreground">Agent Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Sales Assistant"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Organization Selection */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Organization *</Label>
              {businessProfile?.organizationName ? (
                <div className="relative" ref={organizationDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setOrganizationDropdownOpen(!organizationDropdownOpen)}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm border rounded-md w-full justify-between transition-colors border-teal-500 bg-teal-50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-4 w-4 text-teal-600" />
                      </div>
                      <span className="font-medium text-slate-600">{businessProfile.organizationName}</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${organizationDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {organizationDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg py-1">
                      <div className="px-3 py-2 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-teal-600" />
                          <span className="font-medium">{businessProfile.organizationName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            From Organization Profile
                        </p>
                        <Link
                          href="/dashboard/settings?tab=preferences"
                          className="inline-flex items-center gap-1 mt-2 text-xs text-teal-600 hover:underline"
                          onClick={() => setOrganizationDropdownOpen(false)}
                        >
                          <Settings className="h-3 w-3" />
                          Update in Settings
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link href="/dashboard/settings?tab=preferences" className="block">
                  <div className="flex items-center gap-3 px-3 py-2.5 text-sm border rounded-md w-full border-amber-300 bg-amber-50 hover:border-amber-400 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <span className="font-medium text-amber-800">Not configured</span>
                      <p className="text-xs text-amber-700 mt-0.5">Click to set up your organization profile in Settings</p>
                    </div>
                  </div>
                </Link>
              )}
            </div>

            {/* Phone Number Selection */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Phone Number *</Label>
              
              {phoneNumbersLoading ? (
                <div className="text-sm text-muted-foreground">Loading phone numbers...</div>
              ) : !twilioConfigured ? (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-amber-800">Twilio not configured</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Configure your Twilio credentials in Settings to enable phone number assignment.
                    </p>
                    <Link 
                      href="/dashboard/settings" 
                      className="inline-flex items-center gap-1 mt-2 text-xs text-teal-600 hover:underline"
                    >
                      <Settings className="h-3 w-3" />
                      Go to Settings
                    </Link>
                  </div>
                </div>
              ) : phoneNumbers.length === 0 ? (
                <div className="flex items-start gap-2 p-3 bg-slate-100 border border-slate-200 rounded-md">
                  <Phone className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">No phone numbers available</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Import phone numbers from your Twilio account to assign to this agent.
                    </p>
                    <Link 
                      href="/dashboard/settings" 
                      className="inline-flex items-center gap-1 mt-2 text-xs text-teal-600 hover:underline"
                    >
                      <Settings className="h-3 w-3" />
                      Manage Phone Numbers
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {/* Phone Number Dropdown */}
                  <div className="relative" ref={phoneDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setPhoneDropdownOpen(!phoneDropdownOpen)}
                      className={`flex items-center gap-3 px-3 py-2.5 text-sm border rounded-md w-full justify-between transition-colors ${
                        selectedPhoneNumberId ? 'border-teal-500 bg-teal-50' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {selectedPhoneNumberId ? (
                          <>
                            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                              <Phone className="h-4 w-4 text-teal-600" />
                            </div>
                            <span className="font-medium text-slate-600">
                              {formatPhoneNumber(phoneNumbers.find(p => p.id === selectedPhoneNumberId)?.phoneNumber || '')}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span className="text-muted-foreground">Select a phone number</span>
                          </>
                        )}
                      </div>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${phoneDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {phoneDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg py-1 max-h-60 overflow-auto">
                        {/* Available numbers */}
                        {phoneNumbers.map((phone) => {
                          const isAssignedToOther = phone.agent && phone.agent.id;
                          const isSelected = phone.id === selectedPhoneNumberId;
                          return (
                            <button
                              key={phone.id}
                              type="button"
                              onClick={() => {
                                setSelectedPhoneNumberId(phone.id);
                                setPhoneDropdownOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 text-left ${
                                isSelected ? 'bg-teal-50' : ''
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                isAssignedToOther ? 'bg-amber-100' : 'bg-teal-100'
                              }`}>
                                <Phone className={`h-4 w-4 ${isAssignedToOther ? 'text-amber-600' : 'text-teal-600'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium block truncate">
                                  {formatPhoneNumber(phone.phoneNumber)}
                                </span>
                                {isAssignedToOther && (
                                  <span className="text-xs text-amber-600 block">
                                    Currently assigned to: {phone.agent?.name}
                                  </span>
                                )}
                                {isSelected && (
                                  <span className="text-xs text-teal-600 block">
                                    Selected
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                        
                        {/* Settings link */}
                        <div className="border-t mt-1 pt-1">
                          <Link
                            href="/dashboard/settings"
                            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                            onClick={() => setPhoneDropdownOpen(false)}
                          >
                            <Settings className="h-4 w-4 text-teal-600" />
                            <span className="text-xs text-teal-600 hover:underline">Manage Phone Numbers</span>
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Communication Channel - Select first so Agent Mode descriptions update */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Communication Channel *</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {Object.entries(COMMUNICATION_CHANNELS).map(([key, channel]) => {
                  const isSelected = formData.communicationChannel === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`p-3 border rounded-lg text-left hover:border-teal-500 transition-colors ${
                        isSelected ? 'border-teal-500 bg-teal-50' : ''
                      }`}
                      onClick={() => handleChannelChange(key as CommunicationChannel)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center bg-teal-100">
                          {getChannelIcon(key)}
                        </span>
                        <h3 className="font-semibold text-xs text-slate-600">{channel.label}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground">{channel.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Agent Mode - Descriptions update based on selected channel */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Agent Mode *</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {Object.entries(AGENT_MODES).map(([key, mode]) => (
                  <button
                    key={key}
                    type="button"
                    className={`p-3 border rounded-lg text-left hover:border-teal-500 transition-colors ${
                      formData.mode === key ? 'border-teal-500 bg-teal-50' : ''
                    }`}
                    onClick={() => handleModeChange(key as AgentMode)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center bg-teal-100">
                        {getModeIcon(key)}
                      </span>
                      <h3 className="font-semibold text-xs text-slate-600">{mode.label}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">{getModeDescription(key as AgentMode, formData.communicationChannel)}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Call Purpose */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Call Purpose *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(CALL_PURPOSES).map(([key, purpose]) => {
                  const isSelected = formData.callPurposeType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        const newPurpose = key === 'CUSTOM' ? '' : purpose.value;
                        setFormData(prev => ({ 
                          ...prev, 
                          callPurposeType: key as CallPurposeType,
                          callPurpose: newPurpose 
                        }));
                        // Update system prompt if using mode-default template
                        if (formData.template === 'mode-default' && key !== 'CUSTOM') {
                          setTimeout(() => {
                            setFormData(prev => ({
                              ...prev,
                              systemPrompt: getSystemPromptForMode(prev.mode, calendarConnected, {
                                ...buildBusinessContext(),
                                callPurpose: newPurpose,
                              })
                            }));
                          }, 0);
                        }
                      }}
                      className={`p-3 border rounded-lg text-left hover:border-teal-400 transition-colors ${
                        isSelected ? 'border-teal-500 bg-teal-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center bg-teal-100">
                          {getCallPurposeIcon(key)}
                        </span>
                        <h3 className="font-semibold text-xs text-slate-600">{purpose.label}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground">{purpose.description}</p>
                    </button>
                  );
                })}
              </div>
              
              {/* Custom input field - shows when Custom is selected */}
              {formData.callPurposeType === 'CUSTOM' && (
                <Input
                  id="callPurpose"
                  placeholder="Enter your custom call purpose..."
                  value={formData.callPurpose}
                  onChange={(e) => {
                    setFormData({ ...formData, callPurpose: e.target.value });
                    // Update system prompt if using mode-default template
                    if (formData.template === 'mode-default') {
                      setTimeout(() => {
                        setFormData(prev => ({
                          ...prev,
                          systemPrompt: getSystemPromptForMode(prev.mode, calendarConnected, {
                            ...buildBusinessContext(),
                            callPurpose: e.target.value,
                          })
                        }));
                      }, 0);
                    }
                  }}
                  className="mt-3"
                />
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!formData.name.trim()} className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Prompt & Voice */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-600">
              {formData.communicationChannel === 'MESSAGING_ONLY' ? 'Behavior & Messaging' : 'Behavior & Voice'}
            </CardTitle>
            <CardDescription>
              {formData.communicationChannel === 'MESSAGING_ONLY' 
                ? 'Configure how your agent responds via text' 
                : 'Configure how your agent talks and responds'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Voice selector - only show for voice-capable channels */}
            {supportsVoice(formData.communicationChannel) && (
              <div className="space-y-2">
                <Label htmlFor="voice" className="text-muted-foreground">Voice *</Label>
                <VoiceSelector
                  value={formData.voiceId}
                  onChange={(voiceId) => setFormData({ ...formData, voiceId })}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="prompt" className="text-muted-foreground">System Prompt *</Label>
              <textarea
                id="prompt"
                className="w-full min-h-[200px] p-3 border rounded-md text-sm"
                placeholder={formData.communicationChannel === 'MESSAGING_ONLY' 
                  ? "Describe how your agent should respond to text messages..."
                  : "Describe how your agent should behave..."}
                value={formData.systemPrompt || selectedTemplate?.prompt || ''}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
              />
            </div>
            
            {/* Voice greetings - only for voice-capable channels */}
            {supportsVoice(formData.communicationChannel) && (formData.mode === 'INBOUND' || formData.mode === 'HYBRID') && (
              <div className="space-y-2">
                <Label htmlFor="greeting" className="text-muted-foreground">Inbound Greeting (optional)</Label>
                <Input
                  id="greeting"
                  placeholder={`e.g., Hi, this is ${ELEVENLABS_VOICES.find(v => v.id === formData.voiceId)?.name || 'your assistant'}. How can I help you today?`}
                  value={formData.greeting}
                  onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
                />
              </div>
            )}
            {supportsVoice(formData.communicationChannel) && (formData.mode === 'OUTBOUND' || formData.mode === 'HYBRID') && (
              <div className="space-y-2">
                <Label htmlFor="outboundGreeting" className="text-muted-foreground">Outbound Greeting (optional)</Label>
                <Input
                  id="outboundGreeting"
                  placeholder={`e.g., Hi, this is ${ELEVENLABS_VOICES.find(v => v.id === formData.voiceId)?.name || 'your assistant'} calling from ${businessProfile?.organizationName || '[company]'}...`}
                  value={formData.outboundGreeting}
                  onChange={(e) => setFormData({ ...formData, outboundGreeting: e.target.value })}
                />
              </div>
            )}
            
            {/* Messaging settings - only for messaging-capable channels */}
            {supportsMessaging(formData.communicationChannel) && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="messagingGreeting" className="text-muted-foreground">
                    SMS Greeting (optional)
                  </Label>
                  <Input
                    id="messagingGreeting"
                    placeholder={`e.g., Hi! This is ${businessProfile?.organizationName || '[Company]'}. How can I help you today?`}
                    value={formData.messagingGreeting}
                    onChange={(e) => setFormData({ ...formData, messagingGreeting: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* Activity Window (optional) */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">
                {formData.communicationChannel === 'MESSAGING_ONLY' 
                  ? 'Message Window (optional)' 
                  : formData.communicationChannel === 'OMNICHANNEL' 
                    ? 'Communications Window (optional)' 
                    : 'Call Window (optional)'}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">From</span>
                  <Input
                    id="callWindowStart"
                    type="time"
                    placeholder="Start time"
                    value={formData.callWindowStart}
                    onChange={(e) => setFormData({ ...formData, callWindowStart: e.target.value })}
                    className="flex-1 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:saturate-100 [&::-webkit-calendar-picker-indicator]:invert-[.5] [&::-webkit-calendar-picker-indicator]:sepia-[1] [&::-webkit-calendar-picker-indicator]:saturate-[10] [&::-webkit-calendar-picker-indicator]:hue-rotate-[130deg]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">To</span>
                  <Input
                    id="callWindowEnd"
                    type="time"
                    placeholder="End time"
                    value={formData.callWindowEnd}
                    onChange={(e) => setFormData({ ...formData, callWindowEnd: e.target.value })}
                    className="flex-1 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:saturate-100 [&::-webkit-calendar-picker-indicator]:invert-[.5] [&::-webkit-calendar-picker-indicator]:sepia-[1] [&::-webkit-calendar-picker-indicator]:saturate-[10] [&::-webkit-calendar-picker-indicator]:hue-rotate-[130deg]"
                  />
                </div>
              </div>
            </div>

            {/* Tool Access */}
            {(calendarConnected || supportsMessaging(formData.communicationChannel)) && (
              <div className="space-y-3">
                <Label className="text-muted-foreground">Tool Access (optional)</Label>
                
                {/* Calendar Tool */}
                {calendarConnected && (
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.calendarEnabled}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            calendarEnabled: enabled,
                            // Update system prompt if using mode-default template
                            systemPrompt: prev.template === 'mode-default' 
                              ? getSystemPromptForMode(prev.mode, enabled) 
                              : prev.systemPrompt
                          }));
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-teal-600 focus:ring-teal-500"
                      />
                      <Calendar className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-600">Calendar Tool</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Check availability and book appointments
                        </p>
                      </div>
                    </label>
                    
                    {/* Expanded Calendar Configuration - only when enabled */}
                    {formData.calendarEnabled && (
                      <div className="ml-7 pl-4 border-l-2 border-teal-200 space-y-4">
                        {/* Calendar Selector */}
                        {calendarStatus?.calendars && calendarStatus.calendars.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs">Calendar</Label>
                            <select
                              className="w-full px-3 py-2 text-sm border rounded-md bg-white"
                              value={formData.calendarIntegrationId}
                              onChange={(e) => {
                                const calId = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  calendarIntegrationId: calId,
                                  // Reset event type when calendar changes
                                  defaultEventTypeId: '',
                                  defaultEventTypeName: '',
                                }));
                              }}
                            >
                              {calendarStatus.calendars.map((cal) => (
                                <option key={cal.id} value={cal.id}>
                                  {cal.provider === 'google' ? 'Google Calendar' :
                                   cal.provider === 'calcom' ? 'Cal.com' : 'Calendly'} - {cal.email || cal.username || 'Connected'}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        
                        {/* Scopes Checkboxes */}
                        <div className="space-y-2">
                          <Label className="text-muted-foreground text-xs">Permissions</Label>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={formData.calendarScopes.includes('read_calendar')}
                                onChange={(e) => {
                                  setFormData(prev => ({
                                    ...prev,
                                    calendarScopes: e.target.checked
                                      ? [...prev.calendarScopes, 'read_calendar']
                                      : prev.calendarScopes.filter(s => s !== 'read_calendar')
                                  }));
                                }}
                                className="h-4 w-4 rounded border-gray-300 accent-teal-600"
                              />
                              <span className="text-slate-600">Read Calendar</span>
                              <span className="text-xs text-muted-foreground">(check availability)</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={formData.calendarScopes.includes('create_events')}
                                onChange={(e) => {
                                  setFormData(prev => ({
                                    ...prev,
                                    calendarScopes: e.target.checked
                                      ? [...prev.calendarScopes, 'create_events']
                                      : prev.calendarScopes.filter(s => s !== 'create_events')
                                  }));
                                }}
                                className="h-4 w-4 rounded border-gray-300 accent-teal-600"
                              />
                              <span className="text-slate-600">Create Events</span>
                              <span className="text-xs text-muted-foreground">(book appointments)</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={formData.calendarScopes.includes('reschedule_events')}
                                onChange={(e) => {
                                  setFormData(prev => ({
                                    ...prev,
                                    calendarScopes: e.target.checked
                                      ? [...prev.calendarScopes, 'reschedule_events']
                                      : prev.calendarScopes.filter(s => s !== 'reschedule_events')
                                  }));
                                }}
                                className="h-4 w-4 rounded border-gray-300 accent-teal-600"
                              />
                              <span className="text-slate-600">Reschedule Events</span>
                              <span className="text-xs text-muted-foreground">(modify bookings)</span>
                            </label>
                          </div>
                        </div>
                        
                        {/* Event Type Selector - for Cal.com/Calendly */}
                        {(() => {
                          const selectedCal = calendarStatus?.calendars?.find(c => c.id === formData.calendarIntegrationId);
                          if (selectedCal?.provider === 'google') {
                            // Duration selector for Google Calendar
                            return (
                              <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs">Default Duration</Label>
                                <select
                                  className="w-full px-3 py-2 text-sm border rounded-md bg-white"
                                  value={formData.defaultEventDuration}
                                  onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    defaultEventDuration: parseInt(e.target.value)
                                  }))}
                                >
                                  <option value={15}>15 minutes</option>
                                  <option value={30}>30 minutes</option>
                                  <option value={45}>45 minutes</option>
                                  <option value={60}>60 minutes</option>
                                  <option value={90}>90 minutes</option>
                                </select>
                              </div>
                            );
                          } else if (eventTypes.length > 0) {
                            // Event type selector for Cal.com/Calendly
                            return (
                              <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs">Default Event Type</Label>
                                <select
                                  className="w-full px-3 py-2 text-sm border rounded-md bg-white"
                                  value={formData.defaultEventTypeId}
                                  onChange={(e) => {
                                    const eventType = eventTypes.find(et => et.id === e.target.value);
                                    setFormData(prev => ({
                                      ...prev,
                                      defaultEventTypeId: e.target.value,
                                      defaultEventTypeName: eventType?.name || '',
                                    }));
                                  }}
                                  disabled={loadingEventTypes}
                                >
                                  {loadingEventTypes ? (
                                    <option>Loading...</option>
                                  ) : (
                                    eventTypes.map((et) => (
                                      <option key={et.id} value={et.id}>
                                        {et.name} ({et.duration} min)
                                      </option>
                                    ))
                                  )}
                                </select>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Media Tools - only for messaging-capable channels */}
                {supportsMessaging(formData.communicationChannel) && (
                  <>
                    {/* Images Tool */}
                    <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.imageToolEnabled}
                        onChange={(e) => setFormData({ ...formData, imageToolEnabled: e.target.checked })}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-teal-600 focus:ring-teal-500"
                      />
                      <ImageIcon className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="font-medium text-sm text-slate-600">Images</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Send photos, screenshots, and graphics via MMS
                        </p>
                      </div>
                    </label>

                    {/* Documents Tool */}
                    <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.documentToolEnabled}
                        onChange={(e) => setFormData({ ...formData, documentToolEnabled: e.target.checked })}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-teal-600 focus:ring-teal-500"
                      />
                      <FileText className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="font-medium text-sm text-slate-600">Documents</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Send PDFs, contracts, and forms via MMS
                        </p>
                      </div>
                    </label>

                    {/* Videos Tool */}
                    <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.videoToolEnabled}
                        onChange={(e) => setFormData({ ...formData, videoToolEnabled: e.target.checked })}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-teal-600 focus:ring-teal-500"
                      />
                      <Video className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="font-medium text-sm text-slate-600">Videos</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Share video content and tutorials via MMS
                        </p>
                      </div>
                    </label>
                  </>
                )}
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={loading} className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
                {loading ? 'Creating...' : 'Create Agent'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
