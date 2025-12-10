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
import { ELEVENLABS_VOICES, AGENT_MODES, AgentMode, getSystemPromptForMode, BusinessContext } from '@/lib/constants';
import { VoiceSelector } from '@/components/VoiceSelector';
import { OutboundCallDialog } from '@/components/OutboundCallDialog';
import { User, Phone, ArrowLeft, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Bot, Calendar, CheckCircle, XCircle, ExternalLink, Sparkles, Wrench, ChevronDown, Settings, AlertCircle, Building2 } from 'lucide-react';

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
  avgDuration: number;
  mode: AgentMode;
  outboundGreeting?: string;
  callTimeout: number;
  retryAttempts: number;
  callWindowStart?: string;
  callWindowEnd?: string;
  calendarEnabled?: boolean;
  personaName?: string;
  callPurpose?: string;
  createdAt: string;
  updatedAt: string;
}

interface CalendarStatus {
  connected: boolean;
  configured: boolean;
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
  const [callPurpose, setCallPurpose] = useState('');
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

  // Handle click outside for phone dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (phoneDropdownRef.current && !phoneDropdownRef.current.contains(event.target as Node)) {
        setPhoneDropdownOpen(false);
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
        setCallPurpose(response.data.callPurpose || '');
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
        calendarEnabled,
        personaName: ELEVENLABS_VOICES.find(v => v.id === voiceId)?.name || undefined,
        callPurpose: callPurpose || undefined,
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
    if (!confirm('Are you sure you want to delete this agent?')) return;

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
          <Button variant="ghost" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Back + Name */}
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/dashboard/agents" className="flex-shrink-0">
              <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <Bot className="h-6 w-6 text-slate-600 flex-shrink-0" />
                <h1 className="text-xl sm:text-2xl font-bold text-slate-600 truncate max-w-[200px] sm:max-w-[250px]" title={agent.name}>
                  {agent.name}
                </h1>
              </div>
              <p className="text-muted-foreground text-xs">
                {AGENT_MODES[agent.mode]?.label || agent.mode} agent
              </p>
            </div>
          </div>

          {/* Center: Stats (desktop only - fills available space) */}
          <div className="hidden lg:flex items-stretch gap-3 flex-1 mx-6">
            <div className="flex flex-col justify-center px-4 py-2 bg-white rounded-lg border flex-1">
              <span className="text-xs text-muted-foreground">Total Calls</span>
              <span className="text-lg font-semibold text-slate-600">{agent.totalCalls || '—'}</span>
            </div>
            <div className="flex flex-col justify-center px-4 py-2 bg-white rounded-lg border flex-1">
              <span className="text-xs text-muted-foreground">Avg Duration</span>
              <span className="text-lg font-semibold text-slate-600">
                {agent.avgDuration ? `${Math.round(agent.avgDuration)}s` : '—'}
              </span>
            </div>
            <div className="flex flex-col justify-center px-4 py-2 bg-white rounded-lg border flex-1">
              <span className="text-xs text-muted-foreground">Status</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  agent.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {agent.isActive ? 'Active' : 'Inactive'}
                </span>
                {agent.mode && AGENT_MODES[agent.mode] && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center bg-teal-100">
                      {getModeIcon(agent.mode)}
                    </span>
                    {AGENT_MODES[agent.mode].label}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Action buttons */}
          <div className="flex gap-2 flex-shrink-0">
            {editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)} className="text-teal-600 border-teal-600 hover:bg-teal-50">
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <>
                {(agent.mode === 'OUTBOUND' || agent.mode === 'HYBRID') && (
                  <Button onClick={() => setShowCallDialog(true)} className="bg-teal-600 hover:bg-teal-700">
                    <Phone className="h-4 w-4 mr-2" />
                    Make Call
                  </Button>
                )}
                <Button variant="outline" onClick={() => setEditing(true)} className="text-teal-600 border-teal-600 hover:bg-teal-50">
                  Edit
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats - Mobile/Tablet only (stacked cards) */}
        <div className="grid gap-4 grid-cols-3 lg:hidden">
          <Card>
            <CardHeader className="p-3">
              <CardDescription className="text-xs">Total Calls</CardDescription>
              <CardTitle className="text-xl text-slate-600">{agent.totalCalls || '—'}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="p-3">
              <CardDescription className="text-xs">Avg Duration</CardDescription>
              <CardTitle className="text-xl text-slate-600">
                {agent.avgDuration ? `${Math.round(agent.avgDuration)}s` : '—'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="p-3">
              <CardDescription className="text-xs">Status</CardDescription>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  agent.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {agent.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-slate-600">Agent Configuration</CardTitle>
          <CardDescription>
            Voice and AI model settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {editing ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-muted-foreground">Agent Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Organization */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Organization</Label>
                {businessProfile?.organizationName ? (
                  <div className="p-4 border rounded-lg border-teal-500 bg-teal-50">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center bg-teal-100">
                        <Building2 className="h-3 w-3 text-teal-600" />
                      </span>
                      <h3 className="font-semibold text-sm text-muted-foreground">{businessProfile.organizationName}</h3>
                    </div>
                  </div>
                ) : (
                  <Link href="/dashboard/settings?tab=preferences" className="block">
                    <div className="p-4 border rounded-lg border-amber-300 bg-amber-50 hover:border-amber-400 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center bg-amber-100">
                          <AlertCircle className="h-3 w-3 text-amber-600" />
                        </span>
                        <h3 className="font-semibold text-sm text-amber-800">Not configured</h3>
                      </div>
                      <p className="text-xs text-amber-700">Click to set up your organization profile in Settings</p>
                    </div>
                  </Link>
                )}
              </div>

              {/* Phone Number Assignment */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Phone Number</Label>
                
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
                      <p className="text-sm text-slate-700">No phone numbers available</p>
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
                        className={`flex items-center gap-3 px-3 py-2.5 text-sm border rounded-md w-full justify-between transition-colors disabled:opacity-50 ${
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
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 text-left ${
                                  isAssignedToThis ? 'bg-teal-50' : ''
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
                                  {isAssignedToThis && (
                                    <span className="text-xs text-teal-600 block">
                                      Currently assigned to this agent
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Agent Mode</Label>
                <div className="grid grid-cols-3 gap-2">
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
                      <p className="text-xs text-muted-foreground">{modeData.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Call Purpose */}
              <div className="space-y-2">
                <Label htmlFor="callPurpose" className="text-muted-foreground">Call Purpose</Label>
                <Input
                  id="callPurpose"
                  value={callPurpose}
                  onChange={(e) => setCallPurpose(e.target.value)}
                  placeholder="e.g., Schedule appointments, Answer support questions"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="voice" className="text-muted-foreground">Voice</Label>
                <VoiceSelector
                  value={voiceId}
                  onChange={setVoiceId}
                />
              </div>

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
                <Label htmlFor="systemPrompt" className="text-muted-foreground">System Prompt</Label>
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
              {calendarStatus?.connected && (
                <div className="space-y-3">
                  <Label className="text-muted-foreground">Tool Access (optional)</Label>
                  
                  {/* Calendar Tool */}
                  <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={calendarEnabled}
                      onChange={(e) => setCalendarEnabled(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                    <Calendar className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-600">Calendar</span>
                        {calendarStatus?.provider && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">
                            {calendarStatus.provider === 'calcom' ? 'Cal.com' : 'Calendly'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        When enabled, this agent can check your availability and book appointments
                      </p>
                    </div>
                  </label>

                  {/* Future tools can be added here */}
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
                    <p className="text-sm text-muted-foreground">
                      {ELEVENLABS_VOICES.find(v => v.id === agent.voice)?.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Powered by ElevenLabs and GPT-4o
                    </p>
                  </div>
                </div>
                <div className="flex-1">
                  <Label className="text-muted-foreground">Tool Access</Label>
                  <div className="flex items-start gap-3 mt-2">
                    <Calendar className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-600">Calendar</span>
                        {agent.calendarEnabled && calendarStatus?.connected ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">
                            {calendarStatus.provider === 'calcom' ? 'Cal.com' : 'Calendly'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {agent.calendarEnabled && calendarStatus?.connected
                          ? `Using "${calendarStatus.eventTypeName}" for appointments`
                          : !calendarStatus?.connected 
                            ? 'Calendar not connected' 
                            : 'Calendar access not enabled for this agent'}
                      </p>
                    </div>
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
                <div className="md:col-span-2">
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
    </div>
  );
}

