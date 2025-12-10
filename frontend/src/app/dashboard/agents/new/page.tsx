'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES, AGENT_MODES, AgentMode, CALL_PURPOSES, CallPurposeType, getSystemPromptForMode, BusinessContext } from '@/lib/constants';
import { VoiceSelector } from '@/components/VoiceSelector';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ArrowLeft, Bot, Sparkles, Calendar, Wrench, Phone, AlertCircle, Building2, HelpCircle, ClipboardList, Bell, Edit, MessageCircle, Clock, ChevronDown, Settings } from 'lucide-react';

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

const getCallPurposeIcon = (purposeType: string, isSelected: boolean) => {
  const className = `h-3 w-3 ${isSelected ? 'text-teal-600' : 'text-slate-500'}`;
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
  const [calendarStatus, setCalendarStatus] = useState<{ provider?: string; eventTypeName?: string } | null>(null);
  
  // Phone number state
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>('');
  const [phoneNumbersLoading, setPhoneNumbersLoading] = useState(true);
  const [twilioConfigured, setTwilioConfigured] = useState(false);
  const [phoneDropdownOpen, setPhoneDropdownOpen] = useState(false);
  const phoneDropdownRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState<{
   name: string;
    template: string;
   systemPrompt: string;
   voiceId: string;
   greeting: string;
   mode: AgentMode;
   outboundGreeting: string;
   callTimeout: number;
   retryAttempts: number;
   callWindowStart: string;
   callWindowEnd: string;
   calendarEnabled: boolean;
   callPurposeType: CallPurposeType;
   callPurpose: string;
 }>({
    name: '',
    template: 'mode-default',
    systemPrompt: getSystemPromptForMode('INBOUND', false), // Default to inbound mode prompt
    voiceId: ELEVENLABS_VOICES[0].id,
    greeting: '',
    mode: 'INBOUND',
    outboundGreeting: '',
    callTimeout: 600,
    retryAttempts: 0,
    callWindowStart: '',
    callWindowEnd: '',
    calendarEnabled: false,
    callPurposeType: 'SCHEDULE_APPOINTMENTS',
    callPurpose: CALL_PURPOSES.SCHEDULE_APPOINTMENTS.value,
  });

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
        setCalendarConnected(response.data?.connected || false);
        setCalendarStatus(response.data || null);
        // Update system prompt with calendar awareness if connected
        if (response.data?.connected && formData.template === 'mode-default') {
          setFormData(prev => ({
            ...prev,
            systemPrompt: getSystemPromptForMode(prev.mode, true)
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
        updates.systemPrompt = getSystemPromptForMode(newMode, calendarConnected, buildBusinessContext());
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
        updates.systemPrompt = getSystemPromptForMode(prev.mode, calendarConnected, buildBusinessContext());
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
      const response = await api.createAgent({
        name: formData.name,
        systemPrompt: prompt,
        voiceId: formData.voiceId,
        greeting: formData.greeting,
        template: formData.template !== 'custom' ? formData.template : undefined,
        mode: formData.mode,
        outboundGreeting: formData.outboundGreeting || undefined,
        callTimeout: formData.callTimeout,
        retryAttempts: formData.retryAttempts,
        callWindowStart: formData.callWindowStart || undefined,
        callWindowEnd: formData.callWindowEnd || undefined,
        calendarEnabled: formData.calendarEnabled,
        personaName: ELEVENLABS_VOICES.find(v => v.id === formData.voiceId)?.name || undefined,
        callPurpose: formData.callPurpose || undefined,
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
            <CardDescription>Start with a pre-built template or create from scratch</CardDescription>
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
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} className="bg-teal-600 hover:bg-teal-700">Continue</Button>
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

            {/* Organization */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Organization *</Label>
              {businessProfile?.organizationName ? (
                  <div className="p-4 border rounded-lg border-teal-500 bg-teal-50">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center bg-teal-100">
                        <Building2 className="h-3 w-3 text-teal-600" />
                      </span>
                      <h3 className="font-semibold text-sm text-muted-foreground">{businessProfile.organizationName}</h3>
                      {businessProfile.industry && (
                        <span className="text-xs text-muted-foreground ml-auto">{businessProfile.industry}</span>
                      )}
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
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Agent Mode */}
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
                    <p className="text-xs text-muted-foreground">{mode.description}</p>
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
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center ${isSelected ? 'bg-teal-100' : 'bg-slate-100'}`}>
                          {getCallPurposeIcon(key, isSelected)}
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
              <Button onClick={() => setStep(3)} disabled={!formData.name.trim()} className="bg-teal-600 hover:bg-teal-700">Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Prompt & Voice */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-600">Behavior & Voice</CardTitle>
            <CardDescription>Configure how your agent talks and responds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="voice" className="text-muted-foreground">Voice *</Label>
              <VoiceSelector
                value={formData.voiceId}
                onChange={(voiceId) => setFormData({ ...formData, voiceId })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prompt" className="text-muted-foreground">System Prompt *</Label>
              <textarea
                id="prompt"
                className="w-full min-h-[200px] p-3 border rounded-md text-sm"
                placeholder="Describe how your agent should behave..."
                value={formData.systemPrompt || selectedTemplate?.prompt || ''}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
              />
            </div>
            {(formData.mode === 'INBOUND' || formData.mode === 'HYBRID') && (
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
            {(formData.mode === 'OUTBOUND' || formData.mode === 'HYBRID') && (
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

            {/* Call Window (optional) */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Call Window (optional)</Label>
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
            {calendarConnected && (
              <div className="space-y-3">
                <Label className="text-muted-foreground">Tool Access (optional)</Label>
                
                {/* Calendar Tool */}
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

            <div className="flex justify-between pt-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={loading} className="bg-teal-600 hover:bg-teal-700">
                {loading ? 'Creating...' : 'Create Agent'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
