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
import { ELEVENLABS_VOICES, AGENT_MODES, AgentMode, getSystemPromptForMode } from '@/lib/constants';
import { VoiceSelector } from '@/components/VoiceSelector';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Bot, Sparkles, Calendar, Wrench, Phone, ChevronDown, Settings, AlertCircle } from 'lucide-react';

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
  
  // Phone number state
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>('');
  const [phoneNumbersLoading, setPhoneNumbersLoading] = useState(true);
  const [twilioConfigured, setTwilioConfigured] = useState(false);
  const [phoneDropdownOpen, setPhoneDropdownOpen] = useState(false);
  const phoneDropdownRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
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
 }>({
    name: '',
    description: '',
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
  });

  // Check calendar status and fetch phone numbers on load
  useEffect(() => {
    const checkCalendar = async () => {
      try {
        const response = await api.getCalendarStatus();
        setCalendarConnected(response.data?.connected || false);
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
          setPhoneNumbers(numbersRes.data || []);
        }
      } catch {
        // Ignore errors
      } finally {
        setPhoneNumbersLoading(false);
      }
    };
    
    checkCalendar();
    fetchPhoneNumbers();
  }, []);
  
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

  // Update system prompt when mode changes (for mode-default template)
  const handleModeChange = (newMode: AgentMode) => {
    setFormData(prev => {
      const updates: Partial<typeof prev> = { mode: newMode };
      
      // If using mode-default template, update the system prompt
      if (prev.template === 'mode-default') {
        updates.systemPrompt = getSystemPromptForMode(newMode, calendarConnected);
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
        updates.systemPrompt = getSystemPromptForMode(prev.mode, calendarConnected);
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
        description: formData.description,
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
            <CardDescription>Give your agent a name, description, and more</CardDescription>
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
            <div className="space-y-2">
              <Label htmlFor="description" className="text-muted-foreground">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of what this agent does"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Agent Mode *</Label>
              {/* <p className="text-xs text-muted-foreground mb-2">
                {formData.template === 'mode-default' && 'System prompt will update automatically based on mode'}
              </p> */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(AGENT_MODES).map(([key, mode]) => (
                  <button
                    key={key}
                    type="button"
                    className={`p-4 border rounded-lg text-left hover:border-teal-400 transition-colors ${
                      formData.mode === key ? 'border-teal-500 bg-teal-50' : ''
                    }`}
                    onClick={() => handleModeChange(key as AgentMode)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center bg-teal-100">
                        {getModeIcon(key)}
                      </span>
                      <h3 className="font-semibold text-sm text-slate-600">{mode.label}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">{mode.description}</p>
                  </button>
                ))}
              </div>
            </div>
            {(formData.mode === 'OUTBOUND' || formData.mode === 'HYBRID') && (
              <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                <h3 className="font-semibold text-sm text-slate-600">Outbound Call Settings</h3>
                <div className="space-y-2">
                  <Label htmlFor="callWindowStart" className="text-muted-foreground">Call Window (optional)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      id="callWindowStart"
                      type="time"
                      placeholder="Start time"
                      value={formData.callWindowStart}
                      onChange={(e) => setFormData({ ...formData, callWindowStart: e.target.value })}
                    />
                    <Input
                      id="callWindowEnd"
                      type="time"
                      placeholder="End time"
                      value={formData.callWindowEnd}
                      onChange={(e) => setFormData({ ...formData, callWindowEnd: e.target.value })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Restrict when outbound calls can be made (e.g., 09:00-17:00)</p>
                </div>
              </div>
            )}

            {/* Phone Number Selection */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Phone Number *</Label>
              
              {phoneNumbersLoading ? (
                <div className="text-sm text-muted-foreground py-2">Loading phone numbers...</div>
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
                <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <AlertCircle className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
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
                <div className="relative" ref={phoneDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setPhoneDropdownOpen(!phoneDropdownOpen)}
                    className="flex items-center gap-3 px-3 py-2 text-sm border rounded-md bg-background w-full justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {selectedPhoneNumberId ? (
                        (() => {
                          const selectedPhone = phoneNumbers.find(p => p.id === selectedPhoneNumberId);
                          const formattedNumber = formatPhoneNumber(selectedPhone?.phoneNumber || '');
                          const friendlyName = selectedPhone?.friendlyName;
                          // Only show friendly name if it's different from the phone number
                          const showFriendlyName = friendlyName && 
                            friendlyName !== selectedPhone?.phoneNumber && 
                            friendlyName !== formattedNumber;
                          return (
                            <span className="text-slate-600">
                              {formattedNumber}
                              {showFriendlyName && (
                                <span className="text-muted-foreground ml-2">
                                  ({friendlyName})
                                </span>
                              )}
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-muted-foreground">Select a phone number</span>
                      )}
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${phoneDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {phoneDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg py-1 max-h-60 overflow-auto">
                      {/* Available numbers */}
                      {phoneNumbers.map((phone) => {
                        const isAssignedToOther = phone.agent && phone.agent.id;
                        const formattedNumber = formatPhoneNumber(phone.phoneNumber);
                        // Only show friendly name if it's different from the phone number
                        const showFriendlyName = phone.friendlyName && 
                          phone.friendlyName !== phone.phoneNumber && 
                          phone.friendlyName !== formattedNumber;
                        return (
                          <button
                            key={phone.id}
                            type="button"
                            onClick={() => {
                              setSelectedPhoneNumberId(phone.id);
                              setPhoneDropdownOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 text-left ${
                              phone.id === selectedPhoneNumberId ? 'bg-teal-50' : ''
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <span className="text-slate-600 block truncate">
                                {formattedNumber}
                              </span>
                              {showFriendlyName && (
                                <span className="text-xs text-muted-foreground block truncate">
                                  {phone.friendlyName}
                                </span>
                              )}
                              {isAssignedToOther && (
                                <span className="text-xs text-amber-600 block">
                                  Currently assigned to: {phone.agent?.name}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="text-teal-600 border-teal-600 hover:bg-teal-50">Back</Button>
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
              <Label htmlFor="voice" className="text-muted-foreground">Voice</Label>
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
            <div className="space-y-2">
              <Label htmlFor="greeting" className="text-muted-foreground">Inbound Greeting (optional)</Label>
              <Input
                id="greeting"
                placeholder="e.g., Hello! Thanks for calling. How can I help you today?"
                value={formData.greeting}
                onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
              />
              {/* <p className="text-xs text-muted-foreground">
                {formData.mode === 'INBOUND' ? 'Greeting for inbound calls' : 'Default greeting for inbound calls'}
              </p> */}
            </div>
            {(formData.mode === 'OUTBOUND' || formData.mode === 'HYBRID') && (
              <div className="space-y-2">
                <Label htmlFor="outboundGreeting" className="text-muted-foreground">Outbound Greeting (optional)</Label>
                <Input
                  id="outboundGreeting"
                  placeholder="e.g., Hi, this is calling from [company]..."
                  value={formData.outboundGreeting}
                  onChange={(e) => setFormData({ ...formData, outboundGreeting: e.target.value })}
                />
                {/* <p className="text-xs text-muted-foreground">Different greeting when making outbound calls</p> */}
              </div>
            )}

            {/* Tool Access */}
            {calendarConnected && (
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-teal-600" />
                  <Label className="text-muted-foreground">Tool Access</Label>
                </div>
                
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
                    <span className="font-medium text-sm text-slate-600">Calendar</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      When enabled, this agent can check your availability and book appointments
                    </p>
                  </div>
                </label>

                {/* Future tools can be added here */}
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)} className="text-teal-600 border-teal-600 hover:bg-teal-50">Back</Button>
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
