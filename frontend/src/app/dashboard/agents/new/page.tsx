'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES } from '@/lib/constants';

const templates = [
  {
    id: 'custom',
    name: 'Custom Agent',
    description: 'Start from scratch with your own prompt',
    prompt: '',
  },
  {
    id: 'appointment',
    name: 'Appointment Booking',
    description: 'Schedule appointments and manage calendars',
    prompt: `You are a friendly appointment scheduling assistant. Your goal is to help callers book appointments.

Key behaviors:
- Greet the caller warmly
- Ask what service they need
- Offer available time slots
- Collect their name and contact info
- Confirm the appointment details

Keep responses brief and conversational. If you don't have calendar access, collect their preferred times and say someone will confirm.`,
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
  
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    template: string;
    systemPrompt: string;
    voiceId: string;
    greeting: string;
  }>({
    name: '',
    description: '',
    template: 'custom',
    systemPrompt: '',
    voiceId: ELEVENLABS_VOICES[0].id,
    greeting: '',
  });

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
      <div>
        <h1 className="text-3xl font-bold">Create New Agent</h1>
        <p className="text-muted-foreground">Build an AI voice agent step by step</p>
      </div>

      {/* Step 1: Choose Template */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a Template</CardTitle>
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
                  onClick={() => setFormData({ ...formData, template: template.id })}
                >
                  <h3 className="font-semibold">{template.name}</h3>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>Continue</Button>
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
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)} disabled={!formData.name.trim()}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Prompt & Voice */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Behavior & Voice</CardTitle>
            <CardDescription>Configure how your agent talks and responds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice">Voice</Label>
              <select
                id="voice"
                className="w-full p-2 border rounded-md"
                value={formData.voiceId}
                onChange={(e) => setFormData({ ...formData, voiceId: e.target.value })}
              >
                {ELEVENLABS_VOICES.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} - {voice.description}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Creating...' : 'Create Agent'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
