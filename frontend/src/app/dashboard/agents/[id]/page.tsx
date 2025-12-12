'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES, AGENT_MODES, AgentMode, getSystemPromptForMode, BusinessContext, COMMUNICATION_CHANNELS, CommunicationChannel, supportsVoice, supportsMessaging, getModeDescription, MEDIA_TOOLS, CALL_PURPOSES, CallPurposeType } from '@/lib/constants';
import { VoiceSelector } from '@/components/VoiceSelector';
import { OutboundCallDialog } from '@/components/OutboundCallDialog';
import { OutboundMessageDialog } from '@/components/OutboundMessageDialog';
import { DeleteButton } from '@/components/DeleteButton';
import { User, Phone, ArrowLeft, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Bot, Calendar, CheckCircle, XCircle, ExternalLink, Sparkles, Wrench, ChevronDown, Settings, AlertCircle, Building2, MessageSquare, Layers, Image as ImageIcon, FileText, Video, HelpCircle, ClipboardList, Bell, Edit, X, Save, Loader2, Trash2 } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  description?: string;
  voice: string;
  voiceProvider: string;
  llmModel: string;
  systemPrompt: string;
  greeting?: string;
  template?: string;
  isActive: boolean;
  totalCalls: number;
  totalMessages: number;
  avgDuration: number;
  mode: AgentMode;
  communicationChannel: CommunicationChannel;
  outboundGreeting?: string;
  callTimeout: number;
  retryAttempts: number;
  callWindowStart?: string;
  callWindowEnd?: string;
  calendarEnabled?: boolean;
  // Calendar configuration (agent-centric)
  calendarIntegrationId?: string;
  calendarScopes?: string[];
  defaultEventTypeId?: string;
  defaultEventTypeName?: string;
  defaultEventDuration?: number;
  personaName?: string;
  callPurpose?: string;
  // Messaging fields
  messagingGreeting?: string;
  messagingSystemPrompt?: string;
  // Media tool flags
  imageToolEnabled?: boolean;
  documentToolEnabled?: boolean;
  videoToolEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CalendarStatus {
  connected: boolean;
  configured: boolean;
  calendars?: Array<{ id: string; provider: string; email?: string; username?: string }>;
  connectedProviders?: string[];
  provider?: string;
  email?: string;
  username?: string;
  eventTypeName?: string;
  timezone?: string;
}

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  twilioSid?: string;
  friendlyName?: string;
  isActive: boolean;
  agent?: { id: string; name: string } | null;
}

const formatPhoneNumber = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

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
      return <MessageSquare className={className} />;
    case 'CUSTOM':
      return <Edit className={className} />;
    default:
      return null;
  }
};

// Helper function to determine callPurposeType from callPurpose string
const getCallPurposeTypeFromString = (purpose: string): CallPurposeType => {
  if (!purpose) return 'CUSTOM';
  
  for (const [key, purposeData] of Object.entries(CALL_PURPOSES)) {
    if (purposeData.value && purpose.trim() === purposeData.value.trim()) {
      return key as CallPurposeType;
    }
  }
  
  return 'CUSTOM';
};

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(searchParams.get('edit') === 'true');
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [greeting, setGreeting] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [mode, setMode] = useState<AgentMode>('INBOUND');
  const [outboundGreeting, setOutboundGreeting] = useState('');
  const [callWindowStart, setCallWindowStart] = useState('');
  const [callWindowEnd, setCallWindowEnd] = useState('');
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  // Calendar configuration (agent-centric)
  const [calendarIntegrationId, setCalendarIntegrationId] = useState('');
  const [calendarScopes, setCalendarScopes] = useState<string[]>(['read_calendar', 'create_events', 'reschedule_events']);
  const [defaultEventTypeId, setDefaultEventTypeId] = useState('');
  const [defaultEventTypeName, setDefaultEventTypeName] = useState('');
  const [defaultEventDuration, setDefaultEventDuration] = useState(30);
  const [eventTypes, setEventTypes] = useState<Array<{ id: string; name: string; duration: number }>>([]);
  const [loadingEventTypes, setLoadingEventTypes] = useState(false);
  const [callPurpose, setCallPurpose] = useState('');
  const [callPurposeType, setCallPurposeType] = useState<CallPurposeType>('CUSTOM');

  // Communication channel and media tools state
  const [communicationChannel, setCommunicationChannel] = useState<CommunicationChannel>('VOICE_ONLY');
  const [imageToolEnabled, setImageToolEnabled] = useState(false);
  const [documentToolEnabled, setDocumentToolEnabled] = useState(false);
  const [videoToolEnabled, setVideoToolEnabled] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<{
    organizationName: string | null;
    industry: string | null;
    businessDescription: string | null;
    isComplete: boolean;
  } | null>(null);

  // Phone number state
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState<PhoneNumber | null>(null);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>('');
  const [phoneNumbersLoading, setPhoneNumbersLoading] = useState(true);
  const [twilioConfigured, setTwilioConfigured] = useState(false);
  const [phoneDropdownOpen, setPhoneDropdownOpen] = useState(false);
  const [savingPhoneNumber, setSavingPhoneNumber] = useState(false);
  const phoneDropdownRef = useRef<HTMLDivElement>(null);
  const [organizationDropdownOpen, setOrganizationDropdownOpen] = useState(false);
  const organizationDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAgent();
    fetchCalendarStatus();
    fetchPhoneNumbers();
    fetchBusinessProfile();
  }, [params.id]);

  // Fetch business profile
  const fetchBusinessProfile = async () => {
    try {
      const response = await api.getBusinessProfile();
      setBusinessProfile(response.data || null);
    } catch {
      // Ignore errors
    }
  };

  // Handle click outside for dropdowns
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCalendarStatus = async () => {
    try {
      const response = await api.getCalendarStatus();
      setCalendarStatus(response.data || null);
    } catch (error) {
      console.error('Failed to fetch calendar status:', error);
    }
  };

  // Fetch event types for a specific calendar
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
    } catch (error) {
      console.error('Failed to fetch event types:', error);
    } finally {
      setLoadingEventTypes(false);
    }
  };

  // Fetch event types when calendar selection changes
  useEffect(() => {
    if (calendarIntegrationId && calendarEnabled && calendarStatus?.calendars) {
      fetchEventTypes(calendarIntegrationId);
    }
  }, [calendarIntegrationId, calendarEnabled, calendarStatus?.calendars]);

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

        // Find the phone number assigned to this agent
        const assigned = numbers.find((p: PhoneNumber) => p.agent?.id === params.id);
        setAssignedPhoneNumber(assigned || null);
        setSelectedPhoneNumberId(assigned?.id || '');
      }
    } catch {
      // Ignore errors
    } finally {
      setPhoneNumbersLoading(false);
    }
  };

  const handlePhoneNumberChange = async (newPhoneNumberId: string) => {
    setSavingPhoneNumber(true);
    setPhoneDropdownOpen(false);

    try {
      // If there was a previously assigned number, unassign it
      if (assignedPhoneNumber && assignedPhoneNumber.id !== newPhoneNumberId) {
        await api.updatePhoneNumber(assignedPhoneNumber.id, { agentId: null });
      }

      // Assign the new number (if one was selected)
      if (newPhoneNumberId) {
        await api.updatePhoneNumber(newPhoneNumberId, { agentId: params.id as string });
      }

      setSelectedPhoneNumberId(newPhoneNumberId);
      await fetchPhoneNumbers(); // Refresh to get updated assignments

      toast({
        title: newPhoneNumberId ? 'Phone number assigned' : 'Phone number unassigned',
        description: newPhoneNumberId
          ? 'The phone number has been assigned to this agent.'
          : 'The phone number has been removed from this agent.',
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to update phone number';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      // Revert selection on error
      setSelectedPhoneNumberId(assignedPhoneNumber?.id || '');
    } finally {
      setSavingPhoneNumber(false);
    }
  };

  const fetchAgent = async () => {
    try {
      const response = await api.getAgent(params.id as string);
      if (response.data) {
        setAgent(response.data);
        setName(response.data.name);
        setSystemPrompt(response.data.systemPrompt);
        setGreeting(response.data.greeting || '');
        setVoiceId(response.data.voice || ELEVENLABS_VOICES[0].id);
        setMode(response.data.mode || 'INBOUND');
        setOutboundGreeting(response.data.outboundGreeting || '');
        setCallWindowStart(response.data.callWindowStart || '');
        setCallWindowEnd(response.data.callWindowEnd || '');
        setCalendarEnabled(response.data.calendarEnabled || false);
        // Calendar configuration (agent-centric)
        setCalendarIntegrationId(response.data.calendarIntegrationId || '');
        setCalendarScopes(response.data.calendarScopes || ['read_calendar', 'create_events', 'reschedule_events']);
        setDefaultEventTypeId(response.data.defaultEventTypeId || '');
        setDefaultEventTypeName(response.data.defaultEventTypeName || '');
        setDefaultEventDuration(response.data.defaultEventDuration || 30);
        const loadedCallPurpose = response.data.callPurpose || '';
        setCallPurpose(loadedCallPurpose);
        setCallPurposeType(getCallPurposeTypeFromString(loadedCallPurpose));
        setCommunicationChannel(response.data.communicationChannel || 'VOICE_ONLY');
        setImageToolEnabled(response.data.imageToolEnabled || false);
        setDocumentToolEnabled(response.data.documentToolEnabled || false);
        setVideoToolEnabled(response.data.videoToolEnabled || false);
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load agent';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      router.push('/dashboard/agents');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateAgent(params.id as string, {
        name,
        systemPrompt,
        greeting,
        voiceId,
        mode,
        outboundGreeting: outboundGreeting || undefined,
        callWindowStart: callWindowStart || undefined,
        callWindowEnd: callWindowEnd || undefined,
        // Calendar configuration (agent-centric)
        calendarEnabled,
        calendarIntegrationId: calendarEnabled ? calendarIntegrationId || undefined : undefined,
        calendarScopes: calendarEnabled ? calendarScopes : undefined,
        defaultEventTypeId: calendarEnabled ? defaultEventTypeId || undefined : undefined,
        defaultEventTypeName: calendarEnabled ? defaultEventTypeName || undefined : undefined,
        defaultEventDuration: calendarEnabled ? defaultEventDuration : undefined,
        personaName: ELEVENLABS_VOICES.find(v => v.id === voiceId)?.name || undefined,
        callPurpose: callPurpose || undefined,
        communicationChannel,
        imageToolEnabled,
        documentToolEnabled,
        videoToolEnabled,
      });
      toast({
        title: 'Agent updated',
        description: 'Your changes have been saved.',
      });
      setEditing(false);
      fetchAgent();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to update agent';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteAgent(params.id as string);
      toast({
        title: 'Agent deleted',
        description: 'The agent has been removed.',
      });
      router.push('/dashboard/agents');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to delete agent';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      throw error; // Re-throw to keep modal open on error
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading agent...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-muted-foreground">Agent not found</div>
        <Link href="/dashboard/agents">
          {/* Mobile: icon-only */}
          <Button variant="ghost" size="icon" className="sm:hidden text-teal-600 hover:text-teal-700 hover:bg-teal-50">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {/* Desktop: icon + text */}
          <Button variant="ghost" className="hidden sm:flex text-teal-600 hover:text-teal-700 hover:bg-teal-50">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Agents
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Compact layout on desktop */}
      <div className="flex flex-col gap-4">
        {/* Top row: Back, Name, Stats (desktop), Actions */}
        <div className="flex lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Back + Name */}
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <Link href="/dashboard/agents" className="flex-shrink-0">
              {/* Mobile: icon-only */}
              <Button variant="ghost" size="icon" className="sm:hidden text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {/* Desktop: icon + text */}
              <Button variant="ghost" size="sm" className="hidden sm:flex text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <Bot className="h-6 w-6 text-slate-600 flex-shrink-0" />
                <h1 className="text-xl sm:text-2xl font-bold text-slate-600 truncate max-w-[120px] sm:max-w-none" title={agent.name}>
                  {agent.name}
                </h1>
              </div>
              <p className="text-muted-foreground text-xs mt-1">
                {AGENT_MODES[agent.mode]?.label || agent.mode} agent
              </p>
            </div>
          </div>

          {/* Right: Action buttons - Mobile/Tablet (Edit & Delete in 2x2 grid) */}
          <div className="flex gap-2 flex-shrink-0 lg:hidden">
            {editing ? (
              <>
                <Button variant="outline" size="icon" onClick={() => setEditing(false)} className="sm:hidden text-teal-600 border-teal-600 hover:bg-teal-50">
                  <X className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)} className="hidden sm:flex text-teal-600 border-teal-600 hover:bg-teal-50">
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button size="icon" onClick={handleSave} disabled={saving} className="sm:hidden bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
                <Button onClick={handleSave} disabled={saving} className="hidden sm:flex bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                {/* Edit button */}
                <Button variant="outline" size="icon" onClick={() => setEditing(true)} className="sm:hidden text-teal-600 border-teal-600 hover:bg-teal-50">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => setEditing(true)} className="hidden sm:flex text-teal-600 border-teal-600 hover:bg-teal-50">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                {/* Delete button */}
                <DeleteButton
                  variant="full"
                  onDelete={handleDelete}
                  itemName={agent.name}
                  title="Delete Agent"
                />
              </>
            )}
          </div>

          {/* Center: Stats (desktop only - fills available space) */}
          <div className="hidden lg:flex items-stretch gap-3 flex-1 mx-6">
            {/* Communication stats - adapts based on channel */}
            {agent.communicationChannel === 'VOICE_ONLY' ? (
              <div className="flex flex-col justify-center px-4 py-2 bg-white rounded-lg border flex-1">
                <span className="text-xs text-muted-foreground">Total Calls</span>
                <span className="text-lg font-semibold text-slate-600">{agent.totalCalls || '—'}</span>
              </div>
            ) : agent.communicationChannel === 'MESSAGING_ONLY' ? (
              <div className="flex flex-col justify-center px-4 py-2 bg-white rounded-lg border flex-1">
                <span className="text-xs text-muted-foreground">Total Messages</span>
                <span className="text-lg font-semibold text-slate-600">{agent.totalMessages || '—'}</span>
              </div>
            ) : (
              <div className="flex flex-col justify-center px-4 py-2 bg-white rounded-lg border flex-1">
                <span className="text-xs text-muted-foreground">Total Communications</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-slate-600">
                    {(agent.totalCalls || 0) + (agent.totalMessages || 0) || '—'}
                  </span>
                  {((agent.totalCalls || 0) + (agent.totalMessages || 0) > 0) && (
                    <span className="text-xs text-muted-foreground">
                      ({agent.totalCalls || 0} calls, {agent.totalMessages || 0} msgs)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Avg Duration - only show for voice-capable agents */}
            {(agent.communicationChannel === 'VOICE_ONLY' || agent.communicationChannel === 'OMNICHANNEL') && (
              <div className="flex flex-col justify-center px-4 py-2 bg-white rounded-lg border flex-1">
                <span className="text-xs text-muted-foreground">Avg Duration</span>
                <span className="text-lg font-semibold text-slate-600">
                  {agent.avgDuration ? `${Math.round(agent.avgDuration)}s` : '—'}
                </span>
              </div>
            )}
          </div>

          {/* Right: Action buttons - Desktop only (below stats) */}
          <div className="hidden lg:flex gap-2 flex-shrink-0">
            {editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)} className="text-teal-600 border-teal-600 hover:bg-teal-50">
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                {/* Make Call button - only for outbound/hybrid agents with voice capability */}
                {(agent.mode === 'OUTBOUND' || agent.mode === 'HYBRID') &&
                  (!agent.communicationChannel || agent.communicationChannel === 'VOICE_ONLY' || agent.communicationChannel === 'OMNICHANNEL') && (
                    <Button onClick={() => setShowCallDialog(true)} className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
                      <Phone className="h-4 w-4 mr-2" />
                      Make Call
                    </Button>
                  )}
                {/* Send Message button - only for outbound/hybrid agents with messaging capability */}
                {(agent.mode === 'OUTBOUND' || agent.mode === 'HYBRID') &&
                  (agent.communicationChannel === 'MESSAGING_ONLY' || agent.communicationChannel === 'OMNICHANNEL') && (
                    <Button onClick={() => setShowMessageDialog(true)} className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Send Message
                    </Button>
                  )}
                <Button variant="outline" onClick={() => setEditing(true)} className="text-teal-600 border-teal-600 hover:bg-teal-50">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <DeleteButton
                  variant="full"
                  onDelete={handleDelete}
                  itemName={agent.name}
                  title="Delete Agent"
                />
              </>
            )}
          </div>
        </div>

        {/* Make Call / Send Message buttons - Mobile/Tablet only (above stats) */}
        {!editing && (
          <div className="flex gap-2 lg:hidden">
            {/* Make Call button */}
            {(agent.mode === 'OUTBOUND' || agent.mode === 'HYBRID') &&
              (!agent.communicationChannel || agent.communicationChannel === 'VOICE_ONLY' || agent.communicationChannel === 'OMNICHANNEL') && (
                <Button onClick={() => setShowCallDialog(true)} className="flex-1 bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
                  <Phone className="h-4 w-4 mr-2" />
                  Make Call
                </Button>
              )}
            {/* Send Message button */}
            {(agent.mode === 'OUTBOUND' || agent.mode === 'HYBRID') &&
              (agent.communicationChannel === 'MESSAGING_ONLY' || agent.communicationChannel === 'OMNICHANNEL') && (
                <Button onClick={() => setShowMessageDialog(true)} className="flex-1 bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              )}
          </div>
        )}

        {/* Stats - Mobile/Tablet only (stacked cards) */}
        <div className="grid grid-cols-2 gap-4 lg:hidden">
          {/* Communication stats card */}
          {agent.communicationChannel === 'VOICE_ONLY' ? (
            <Card>
              <CardHeader className="p-3">
                <CardDescription className="text-xs">Total Calls</CardDescription>
                <CardTitle className="text-xl text-slate-600">{agent.totalCalls || '—'}</CardTitle>
              </CardHeader>
            </Card>
          ) : agent.communicationChannel === 'MESSAGING_ONLY' ? (
            <Card>
              <CardHeader className="p-3">
                <CardDescription className="text-xs">Total Messages</CardDescription>
                <CardTitle className="text-xl text-slate-600">{agent.totalMessages || '—'}</CardTitle>
              </CardHeader>
            </Card>
          ) : (
            <Card>
              <CardHeader className="p-3">
                <CardDescription className="text-xs">Communications</CardDescription>
                <CardTitle className="text-xl text-slate-600">
                  {(agent.totalCalls || 0) + (agent.totalMessages || 0) || '—'}
                </CardTitle>
                {((agent.totalCalls || 0) + (agent.totalMessages || 0) > 0) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {agent.totalCalls || 0} calls · {agent.totalMessages || 0} msgs
                  </p>
                )}
              </CardHeader>
            </Card>
          )}

          {/* Avg Duration - only for voice-capable */}
          {(agent.communicationChannel === 'VOICE_ONLY' || agent.communicationChannel === 'OMNICHANNEL') && (
            <Card>
              <CardHeader className="p-3">
                <CardDescription className="text-xs">Avg Duration</CardDescription>
                <CardTitle className="text-xl text-slate-600">
                  {agent.avgDuration ? `${Math.round(agent.avgDuration)}s` : '—'}
                </CardTitle>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-slate-600">Agent Configuration</CardTitle>
              <CardDescription>
                Voice and AI model settings
              </CardDescription>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${agent.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
              }`}>
              {agent.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {editing ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-muted-foreground">Agent Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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

              {/* Phone Number Assignment */}
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
                        disabled={savingPhoneNumber}
                        className={`flex items-center gap-3 px-3 py-2.5 text-sm border rounded-md w-full justify-between transition-colors disabled:opacity-50 ${selectedPhoneNumberId ? 'border-teal-500 bg-teal-50' : 'bg-white hover:bg-slate-50'
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
                              <span className="text-muted-foreground">No phone number assigned</span>
                            </>
                          )}
                        </div>
                        {savingPhoneNumber ? (
                          <span className="text-xs text-muted-foreground">Saving...</span>
                        ) : (
                          <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${phoneDropdownOpen ? 'rotate-180' : ''}`} />
                        )}
                      </button>

                      {phoneDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg py-1 max-h-60 overflow-auto">
                          {/* No assignment option */}
                          <button
                            type="button"
                            onClick={() => handlePhoneNumberChange('')}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span className="text-muted-foreground">No phone number</span>
                          </button>

                          {/* Available numbers */}
                          {phoneNumbers.map((phone) => {
                            const isAssignedToOther = phone.agent && phone.agent.id && phone.agent.id !== params.id;
                            const isAssignedToThis = phone.agent?.id === params.id;
                            return (
                              <button
                                key={phone.id}
                                type="button"
                                onClick={() => handlePhoneNumberChange(phone.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 text-left ${isAssignedToThis ? 'bg-teal-50' : ''
                                  }`}
                              >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isAssignedToOther ? 'bg-amber-100' : 'bg-teal-100'
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
                                  {isAssignedToThis && (
                                    <span className="text-xs text-teal-600 block">
                                      Currently assigned to this agent
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

              {/* Communication Channel */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Communication Channel *</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {Object.entries(COMMUNICATION_CHANNELS).map(([key, channel]) => {
                    const isSelected = communicationChannel === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`p-3 border rounded-lg text-left hover:border-teal-500 transition-colors ${isSelected ? 'border-teal-500 bg-teal-50' : ''
                          }`}
                        onClick={() => setCommunicationChannel(key as CommunicationChannel)}
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

              <div className="space-y-2">
                <Label className="text-muted-foreground">Agent Mode *</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {Object.entries(AGENT_MODES).map(([key, modeData]) => (
                    <button
                      key={key}
                      type="button"
                      className={`p-3 border rounded-lg text-left hover:border-teal-500 transition-colors ${
                        mode === key ? 'border-teal-500 bg-teal-50' : ''
                      }`}
                      onClick={() => setMode(key as AgentMode)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center bg-teal-100">
                          {getModeIcon(key)}
                        </span>
                        <h3 className="font-semibold text-xs text-slate-600">{modeData.label}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground">{getModeDescription(key as AgentMode, communicationChannel)}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Call Purpose */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Call Purpose *</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(CALL_PURPOSES).map(([key, purpose]) => {
                    const isSelected = callPurposeType === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const newPurpose = key === 'CUSTOM' ? '' : purpose.value;
                          setCallPurposeType(key as CallPurposeType);
                          setCallPurpose(newPurpose);
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
                {callPurposeType === 'CUSTOM' && (
                  <Input
                    id="callPurpose"
                    placeholder="Enter your custom call purpose..."
                    value={callPurpose}
                    onChange={(e) => setCallPurpose(e.target.value)}
                  />
                )}
              </div>

              {/* Voice selector - only show for voice-capable channels */}
              {supportsVoice(communicationChannel) && (
                <div className="space-y-2">
                  <Label htmlFor="voice" className="text-muted-foreground">Voice *</Label>
                  <VoiceSelector
                    value={voiceId}
                    onChange={setVoiceId}
                  />
                </div>
              )}

              {(mode === 'INBOUND' || mode === 'HYBRID') && (
                <div className="space-y-2">
                  <Label htmlFor="greeting" className="text-muted-foreground">Inbound Greeting (optional)</Label>
                  <Input
                    id="greeting"
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                    placeholder={`e.g., Hi, this is ${ELEVENLABS_VOICES.find(v => v.id === voiceId)?.name || 'your assistant'}. How can I help you today?`}
                  />
                </div>
              )}
              {(mode === 'OUTBOUND' || mode === 'HYBRID') && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="outboundGreeting" className="text-muted-foreground">Outbound Greeting (optional)</Label>
                    <Input
                      id="outboundGreeting"
                      value={outboundGreeting}
                      onChange={(e) => setOutboundGreeting(e.target.value)}
                      placeholder={`e.g., Hi, this is ${ELEVENLABS_VOICES.find(v => v.id === voiceId)?.name || 'your assistant'} calling from ${businessProfile?.organizationName || '[company]'}...`}
                    />
                  </div>
                </>
              )}

              {/* Call Window */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Call Window (optional)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">From</span>
                    <Input
                      type="time"
                      value={callWindowStart}
                      onChange={(e) => setCallWindowStart(e.target.value)}
                      placeholder="Start time"
                      className="flex-1 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:saturate-100 [&::-webkit-calendar-picker-indicator]:invert-[.5] [&::-webkit-calendar-picker-indicator]:sepia-[1] [&::-webkit-calendar-picker-indicator]:saturate-[10] [&::-webkit-calendar-picker-indicator]:hue-rotate-[130deg]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">To</span>
                    <Input
                      type="time"
                      value={callWindowEnd}
                      onChange={(e) => setCallWindowEnd(e.target.value)}
                      placeholder="End time"
                      className="flex-1 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:saturate-100 [&::-webkit-calendar-picker-indicator]:invert-[.5] [&::-webkit-calendar-picker-indicator]:sepia-[1] [&::-webkit-calendar-picker-indicator]:saturate-[10] [&::-webkit-calendar-picker-indicator]:hue-rotate-[130deg]"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="systemPrompt" className="text-muted-foreground">System Prompt *</Label>
                <textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full min-h-[200px] px-3 py-2 border rounded-md bg-background"
                />
                {/* <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const hasCalendar = !!(calendarStatus?.connected && calendarEnabled);
                    const newPrompt = getSystemPromptForMode(mode, hasCalendar);
                    setSystemPrompt(newPrompt);
                    toast({
                      title: 'Prompt generated',
                      description: `Mode-optimized prompt for ${AGENT_MODES[mode].label} mode${hasCalendar ? ' with calendar' : ''}`,
                    });
                  }}
                  className="text-teal-600 border-teal-600"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Mode-Optimized Prompt
                </Button> */}
              </div>

              {/* Tool Access */}
              {((calendarStatus?.calendars && calendarStatus.calendars.length > 0) || supportsMessaging(communicationChannel)) && (
                <div className="space-y-3">
                  <Label className="text-muted-foreground">Tool Access (optional)</Label>

                  {/* Calendar Tool */}
                  {calendarStatus?.calendars && calendarStatus.calendars.length > 0 && (
                    <div className="space-y-3">
                      <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={calendarEnabled}
                          onChange={(e) => setCalendarEnabled(e.target.checked)}
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
                      {calendarEnabled && (
                        <div className="ml-7 pl-4 border-l-2 border-teal-200 space-y-4">
                          {/* Calendar Selector */}
                          <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs">Calendar</Label>
                            <select
                              className="w-full px-3 py-2 text-sm border rounded-md bg-white"
                              value={calendarIntegrationId}
                              onChange={(e) => {
                                const calId = e.target.value;
                                setCalendarIntegrationId(calId);
                                // Reset event type when calendar changes
                                setDefaultEventTypeId('');
                                setDefaultEventTypeName('');
                              }}
                            >
                              <option value="">Select a calendar</option>
                              {calendarStatus.calendars.map((cal) => (
                                <option key={cal.id} value={cal.id}>
                                  {cal.provider === 'google' ? 'Google Calendar' :
                                   cal.provider === 'calcom' ? 'Cal.com' : 'Calendly'} - {cal.email || cal.username || 'Connected'}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Scopes Checkboxes */}
                          <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs">Permissions</Label>
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={calendarScopes.includes('read_calendar')}
                                  onChange={(e) => {
                                    setCalendarScopes(prev => e.target.checked
                                      ? [...prev, 'read_calendar']
                                      : prev.filter(s => s !== 'read_calendar')
                                    );
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 accent-teal-600"
                                />
                                <span className="text-slate-600">Read Calendar</span>
                                <span className="text-xs text-muted-foreground">(check availability)</span>
                              </label>
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={calendarScopes.includes('create_events')}
                                  onChange={(e) => {
                                    setCalendarScopes(prev => e.target.checked
                                      ? [...prev, 'create_events']
                                      : prev.filter(s => s !== 'create_events')
                                    );
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 accent-teal-600"
                                />
                                <span className="text-slate-600">Create Events</span>
                                <span className="text-xs text-muted-foreground">(book appointments)</span>
                              </label>
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={calendarScopes.includes('reschedule_events')}
                                  onChange={(e) => {
                                    setCalendarScopes(prev => e.target.checked
                                      ? [...prev, 'reschedule_events']
                                      : prev.filter(s => s !== 'reschedule_events')
                                    );
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 accent-teal-600"
                                />
                                <span className="text-slate-600">Reschedule Events</span>
                                <span className="text-xs text-muted-foreground">(modify bookings)</span>
                              </label>
                            </div>
                          </div>
                          
                          {/* Event Type or Duration Selector */}
                          {(() => {
                            const selectedCal = calendarStatus?.calendars?.find(c => c.id === calendarIntegrationId);
                            if (selectedCal?.provider === 'google') {
                              // Duration selector for Google Calendar
                              return (
                                <div className="space-y-2">
                                  <Label className="text-muted-foreground text-xs">Default Duration</Label>
                                  <select
                                    className="w-full px-3 py-2 text-sm border rounded-md bg-white"
                                    value={defaultEventDuration}
                                    onChange={(e) => setDefaultEventDuration(parseInt(e.target.value))}
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
                                    value={defaultEventTypeId}
                                    onChange={(e) => {
                                      const eventType = eventTypes.find(et => et.id === e.target.value);
                                      setDefaultEventTypeId(e.target.value);
                                      setDefaultEventTypeName(eventType?.name || '');
                                    }}
                                    disabled={loadingEventTypes}
                                  >
                                    <option value="">Select event type</option>
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
                  {supportsMessaging(communicationChannel) && (
                    <>
                      {/* Images Tool */}
                      <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={imageToolEnabled}
                          onChange={(e) => setImageToolEnabled(e.target.checked)}
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
                          checked={documentToolEnabled}
                          onChange={(e) => setDocumentToolEnabled(e.target.checked)}
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
                          checked={videoToolEnabled}
                          onChange={(e) => setVideoToolEnabled(e.target.checked)}
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
            </>
          ) : (
            <div className="space-y-6">
              {/* Voice Avatar & Tool Access Section */}
              <div className="flex items-start gap-6 pb-6 border-b">
                <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {ELEVENLABS_VOICES.find(v => v.id === agent.voice)?.avatar ? (
                    <Image
                      src={ELEVENLABS_VOICES.find(v => v.id === agent.voice)!.avatar!}
                      alt={ELEVENLABS_VOICES.find(v => v.id === agent.voice)?.name || 'Voice'}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-slate-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div>
                    <Label className="text-muted-foreground">Voice</Label>
                    <p className="font-medium text-lg text-slate-600">
                      {ELEVENLABS_VOICES.find(v => v.id === agent.voice)?.name || agent.voice}
                    </p>
                    <p className="hidden sm:block text-sm text-muted-foreground">
                      {ELEVENLABS_VOICES.find(v => v.id === agent.voice)?.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Powered by ElevenLabs and GPT-4o Mini
                    </p>
                  </div>
                </div>
                <div className="flex-1">
                  <Label className="text-muted-foreground">Tool Access</Label>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                    {/* Calendar Tool */}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-teal-600 flex-shrink-0" />
                      <span className="hidden sm:inline font-medium text-sm text-slate-600">Calendar</span>
                      {agent.calendarEnabled && calendarStatus?.connected ? (
                        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">
                          {calendarStatus.provider === 'calcom' ? 'Cal.com' : 'Calendly'}
                        </span>
                      ) : (
                        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                          Off
                        </span>
                      )}
                    </div>

                    {/* Media Tools - only show if messaging channel */}
                    {(agent.communicationChannel === 'MESSAGING_ONLY' || agent.communicationChannel === 'OMNICHANNEL') && (
                      <>
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-teal-600 flex-shrink-0" />
                          <span className="hidden sm:inline font-medium text-sm text-slate-600">Images</span>
                          <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${agent.imageToolEnabled ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                            {agent.imageToolEnabled ? 'MMS' : 'Off'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-teal-600 flex-shrink-0" />
                          <span className="hidden sm:inline font-medium text-sm text-slate-600">Documents</span>
                          <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${agent.documentToolEnabled ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                            {agent.documentToolEnabled ? 'MMS' : 'Off'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4 text-teal-600 flex-shrink-0" />
                          <span className="hidden sm:inline font-medium text-sm text-slate-600">Videos</span>
                          <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${agent.videoToolEnabled ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                            {agent.videoToolEnabled ? 'MMS' : 'Off'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Other Info */}
              <div className="grid gap-4 md:grid-cols-3">
                {/* Business Context - Organization */}
                <div>
                  <Label className="text-muted-foreground">Organization</Label>
                  {businessProfile?.organizationName ? (
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center bg-teal-100">
                          <Building2 className="h-3 w-3 text-teal-600" />
                        </span>
                        <span className="font-medium text-slate-600">{businessProfile.organizationName}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <p className="text-sm text-muted-foreground">Not configured</p>
                      <Link
                        href="/dashboard/settings?tab=preferences"
                        className="inline-flex items-center gap-1 text-xs text-teal-600 hover:underline mt-1"
                      >
                        <Settings className="h-3 w-3" />
                        Set up in Settings
                      </Link>
                    </div>
                  )}
                </div>

                {/* Assigned Phone Number */}
                <div>
                  <Label className="text-muted-foreground">Phone Number</Label>
                  {phoneNumbersLoading ? (
                    <p className="text-sm text-muted-foreground mt-1">Loading...</p>
                  ) : assignedPhoneNumber ? (
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center bg-teal-100">
                          <Phone className="h-3 w-3 text-teal-600" />
                        </span>
                        <span className="font-medium text-slate-600">{formatPhoneNumber(assignedPhoneNumber.phoneNumber)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <p className="text-sm text-muted-foreground">No phone number assigned</p>
                      <Link
                        href="/dashboard/settings"
                        className="inline-flex items-center gap-1 text-xs text-teal-600 hover:underline mt-1"
                      >
                        <Settings className="h-3 w-3" />
                        Assign in Settings
                      </Link>
                    </div>
                  )}
                </div>

                {agent.mode && AGENT_MODES[agent.mode] && (
                  <div>
                    <Label className="text-muted-foreground">Mode</Label>
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center bg-teal-100">
                          {getModeIcon(agent.mode)}
                        </span>
                        <span className="font-medium text-slate-600">{AGENT_MODES[agent.mode].label}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Call Purpose */}
                {agent.callPurpose && (
                  <div>
                    <Label className="text-muted-foreground">Call Purpose</Label>
                    <p className="font-medium text-slate-600 mt-1">{agent.callPurpose}</p>
                  </div>
                )}

                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="font-medium text-slate-600">
                    {new Date(agent.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {(agent.mode === 'OUTBOUND' || agent.mode === 'HYBRID') && agent.callWindowStart && agent.callWindowEnd && (
                  <div>
                    <Label className="text-muted-foreground">Call Window</Label>
                    <p className="font-medium text-slate-600">{agent.callWindowStart} - {agent.callWindowEnd}</p>
                  </div>
                )}
                {agent.greeting && (
                  <div className="md:col-span-2">
                    <Label className="text-muted-foreground">Greeting</Label>
                    <p className="font-medium text-slate-600">{agent.greeting}</p>
                  </div>
                )}
                {(agent.mode === 'OUTBOUND' || agent.mode === 'HYBRID') && agent.outboundGreeting && (
                  <div className="md:col-span-2">
                    <Label className="text-muted-foreground">Outbound Greeting</Label>
                    <p className="font-medium text-slate-600">{agent.outboundGreeting}</p>
                  </div>
                )}

                {/* Divider before System Prompt */}
                <div className="md:col-span-2 border-t pt-4 mt-2">
                  <Label className="text-muted-foreground">System Prompt</Label>
                  <p className="font-medium text-slate-600 whitespace-pre-wrap bg-muted p-3 rounded-md text-sm mt-1">
                    {agent.systemPrompt}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outbound Call Dialog */}
      {showCallDialog && agent && (
        <OutboundCallDialog
          agentId={agent.id}
          agentName={agent.name}
          callWindow={
            agent.callWindowStart && agent.callWindowEnd
              ? { start: agent.callWindowStart, end: agent.callWindowEnd }
              : undefined
          }
          onClose={() => setShowCallDialog(false)}
          onCallInitiated={(callData) => {
            console.log('Call initiated:', callData);
            // Optionally redirect to call details page
            // router.push(`/dashboard/calls/${callData.callId}`);
          }}
        />
      )}

      {/* Outbound Message Dialog */}
      {showMessageDialog && agent && (
        <OutboundMessageDialog
          agentId={agent.id}
          agentName={agent.name}
          imageToolEnabled={agent.imageToolEnabled || false}
          documentToolEnabled={agent.documentToolEnabled || false}
          videoToolEnabled={agent.videoToolEnabled || false}
          onClose={() => setShowMessageDialog(false)}
          onMessageSent={(messageData) => {
            console.log('Message sent:', messageData);
            // Could show message history or notification
          }}
        />
      )}
    </div>
  );
}

