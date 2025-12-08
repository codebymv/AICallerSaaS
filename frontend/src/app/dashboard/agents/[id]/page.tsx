'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES, AGENT_MODES, AgentMode } from '@/lib/constants';
import { VoiceSelector } from '@/components/VoiceSelector';
import { OutboundCallDialog } from '@/components/OutboundCallDialog';
import { User, Phone, ArrowLeft, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Bot } from 'lucide-react';

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
  createdAt: string;
  updatedAt: string;
}

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
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [greeting, setGreeting] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [mode, setMode] = useState<AgentMode>('INBOUND');
  const [outboundGreeting, setOutboundGreeting] = useState('');
  const [callWindowStart, setCallWindowStart] = useState('');
  const [callWindowEnd, setCallWindowEnd] = useState('');

  useEffect(() => {
    fetchAgent();
  }, [params.id]);

  const fetchAgent = async () => {
    try {
      const response = await api.getAgent(params.id as string);
      if (response.data) {
        setAgent(response.data);
        setName(response.data.name);
        setDescription(response.data.description || '');
        setSystemPrompt(response.data.systemPrompt);
        setGreeting(response.data.greeting || '');
        setVoiceId(response.data.voice || ELEVENLABS_VOICES[0].id);
        setMode(response.data.mode || 'INBOUND');
        setOutboundGreeting(response.data.outboundGreeting || '');
        setCallWindowStart(response.data.callWindowStart || '');
        setCallWindowEnd(response.data.callWindowEnd || '');
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
        description,
        systemPrompt,
        greeting,
        voiceId,
        mode,
        outboundGreeting: outboundGreeting || undefined,
        callWindowStart: callWindowStart || undefined,
        callWindowEnd: callWindowEnd || undefined,
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/dashboard/agents">
            <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Agents
            </Button>
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <Bot className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600" />
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-600">{agent.name}</h1>
            <span className="hidden sm:inline text-slate-400">•</span>
            <p className="text-muted-foreground text-sm w-full sm:w-auto">
              {AGENT_MODES[agent.mode]?.label || agent.mode} agent
            </p>
          </div>
        </div>
        <div className="flex gap-2">
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
                <Button onClick={() => setShowCallDialog(true)} className="bg-green-600 hover:bg-green-700">
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

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Calls</CardDescription>
            <CardTitle className="text-3xl text-slate-600">{agent.totalCalls}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Duration</CardDescription>
            <CardTitle className="text-3xl text-slate-600">
              {agent.avgDuration ? `${Math.round(agent.avgDuration)}s` : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle className="text-3xl">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-base font-medium ${
                  agent.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {agent.isActive ? 'Active' : 'Inactive'}
                </span>
                {agent.mode && AGENT_MODES[agent.mode] && (
                  <span className="flex items-center gap-1.5 text-base font-medium text-muted-foreground">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center bg-teal-100">
                      {getModeIcon(agent.mode)}
                    </span>
                    {AGENT_MODES[agent.mode].label}
                  </span>
                )}
              </div>
            </CardTitle>
          </CardHeader>
        </Card>
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
                <Label htmlFor="voice">Voice</Label>
                <VoiceSelector
                  value={voiceId}
                  onChange={setVoiceId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div className="space-y-2">
                <Label>Agent Mode</Label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(AGENT_MODES).map(([key, modeData]) => (
                    <button
                      key={key}
                      type="button"
                      className={`p-3 border rounded-lg text-left hover:border-primary transition-colors ${
                        mode === key ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => setMode(key as AgentMode)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center bg-teal-100">
                          {getModeIcon(key)}
                        </span>
                        <h3 className="font-semibold text-xs">{modeData.label}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground">{modeData.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="greeting">Greeting</Label>
                <Input
                  id="greeting"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder="Hello! How can I help you today?"
                />
              </div>
              {(mode === 'OUTBOUND' || mode === 'HYBRID') && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="outboundGreeting">Outbound Greeting</Label>
                    <Input
                      id="outboundGreeting"
                      value={outboundGreeting}
                      onChange={(e) => setOutboundGreeting(e.target.value)}
                      placeholder="Hi, this is calling from [company]..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Call Window</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="time"
                        value={callWindowStart}
                        onChange={(e) => setCallWindowStart(e.target.value)}
                        placeholder="Start time"
                      />
                      <Input
                        type="time"
                        value={callWindowEnd}
                        onChange={(e) => setCallWindowEnd(e.target.value)}
                        placeholder="End time"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Restrict when outbound calls can be made</p>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full min-h-[200px] px-3 py-2 border rounded-md bg-background"
                />
              </div>
            </>
          ) : (
            <div className="space-y-6">
              {/* Voice Avatar Section */}
              <div className="flex items-center gap-6 pb-6 border-b">
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
                  <div className="mb-4">
                    <Label className="text-muted-foreground">Voice</Label>
                    <p className="font-medium text-lg">
                      {ELEVENLABS_VOICES.find(v => v.id === agent.voice)?.name || agent.voice}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {ELEVENLABS_VOICES.find(v => v.id === agent.voice)?.description}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Voice Provider</Label>
                    <p className="font-medium">{agent.voiceProvider}</p>
                  </div>
                </div>
              </div>

              {/* Other Info */}
              <div className="grid gap-4 md:grid-cols-2">
                {agent.mode && AGENT_MODES[agent.mode] && (
                  <div>
                    <Label className="text-muted-foreground">Mode</Label>
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center bg-teal-100">
                          {getModeIcon(agent.mode)}
                        </span>
                        <span className="font-medium">{AGENT_MODES[agent.mode].label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{AGENT_MODES[agent.mode].description}</p>
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">LLM Model</Label>
                  <p className="font-medium">{agent.llmModel}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="font-medium">
                    {new Date(agent.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {(agent.mode === 'OUTBOUND' || agent.mode === 'HYBRID') && agent.callWindowStart && agent.callWindowEnd && (
                  <div>
                    <Label className="text-muted-foreground">Call Window</Label>
                    <p className="font-medium">{agent.callWindowStart} - {agent.callWindowEnd}</p>
                  </div>
                )}
                <div className="md:col-span-2">
                  <Label className="text-muted-foreground">Greeting</Label>
                  <p className="font-medium">{agent.greeting || 'No greeting set'}</p>
                </div>
                {(agent.mode === 'OUTBOUND' || agent.mode === 'HYBRID') && agent.outboundGreeting && (
                  <div className="md:col-span-2">
                    <Label className="text-muted-foreground">Outbound Greeting</Label>
                    <p className="font-medium">{agent.outboundGreeting}</p>
                  </div>
                )}
                <div className="md:col-span-2">
                  <Label className="text-muted-foreground">System Prompt</Label>
                  <p className="font-medium whitespace-pre-wrap bg-muted p-3 rounded-md text-sm mt-1">
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

