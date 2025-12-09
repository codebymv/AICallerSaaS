'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES, AGENT_MODES, AgentMode, getSystemPromptForMode } from '@/lib/constants';
import { VoiceSelector } from '@/components/VoiceSelector';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Bot, Sparkles } from 'lucide-react';

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
  {
    id: 'support',
    name: 'Customer Support',
    description: 'Handle customer inquiries and issues',
    prompt: `You are a helpful customer support agent. Your goal is to assist callers with their questions and issues.

Key behaviors:
- Listen carefully to the customer's issue
- Ask clarifying questions if needed
- Provide clear, helpful solutions
- If you can't resolve the issue, offer to transfer or create a ticket
- Always be empathetic and professional

Keep responses concise and focused on solving the customer's problem.`,
  },
  {
    id: 'survey',
    name: 'Survey Agent',
    description: 'Conduct phone surveys and collect feedback',
    prompt: `You are a professional survey agent. Your goal is to collect feedback from callers.

Key behaviors:
- Introduce yourself and explain the survey purpose
- Ask questions one at a time
- Accept and acknowledge all responses without judgment
- Thank them for their time

Keep the survey conversational and don't rush. If they want to skip a question, that's okay.`,
  },
];

export default function NewAgentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  
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
  });

  // Check calendar status on load
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
    checkCalendar();
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
      });

      toast({ title: 'Agent created!', description: `${formData.name} is ready to use.` });
      router.push(`/dashboard/agents/${response.data.id}`);
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
                  className={`p-4 border rounded-lg text-left hover:border-primary transition-colors ${
                    formData.template === template.id ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => handleTemplateChange(template.id)}
                >
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{template.name}</h3>
                    {'isDefault' in template && template.isDefault && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-teal-100 text-teal-700">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
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
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Give your agent a name and description</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Sales Assistant"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of what this agent does"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Agent Mode *</Label>
              <p className="text-xs text-muted-foreground mb-2">
                {formData.template === 'mode-default' && 'System prompt will update automatically based on mode'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(AGENT_MODES).map(([key, mode]) => (
                  <button
                    key={key}
                    type="button"
                    className={`p-4 border rounded-lg text-left hover:border-primary transition-colors ${
                      formData.mode === key ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => handleModeChange(key as AgentMode)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center bg-teal-100">
                        {getModeIcon(key)}
                      </span>
                      <h3 className="font-semibold text-sm">{mode.label}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">{mode.description}</p>
                  </button>
                ))}
              </div>
            </div>
            {(formData.mode === 'OUTBOUND' || formData.mode === 'HYBRID') && (
              <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                <h3 className="font-semibold text-sm">Outbound Call Settings</h3>
                <div className="space-y-2">
                  <Label htmlFor="callWindowStart">Call Window (optional)</Label>
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
              <Label htmlFor="voice">Voice</Label>
              <VoiceSelector
                value={formData.voiceId}
                onChange={(voiceId) => setFormData({ ...formData, voiceId })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prompt">System Prompt *</Label>
              <textarea
                id="prompt"
                className="w-full min-h-[200px] p-3 border rounded-md text-sm"
                placeholder="Describe how your agent should behave..."
                value={formData.systemPrompt || selectedTemplate?.prompt || ''}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="greeting">Greeting (optional)</Label>
              <Input
                id="greeting"
                placeholder="e.g., Hello! Thanks for calling. How can I help you today?"
                value={formData.greeting}
                onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {formData.mode === 'INBOUND' ? 'Greeting for inbound calls' : 'Default greeting for inbound calls'}
              </p>
            </div>
            {(formData.mode === 'OUTBOUND' || formData.mode === 'HYBRID') && (
              <div className="space-y-2">
                <Label htmlFor="outboundGreeting">Outbound Greeting (optional)</Label>
                <Input
                  id="outboundGreeting"
                  placeholder="e.g., Hi, this is calling from [company]..."
                  value={formData.outboundGreeting}
                  onChange={(e) => setFormData({ ...formData, outboundGreeting: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Different greeting when making outbound calls</p>
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
