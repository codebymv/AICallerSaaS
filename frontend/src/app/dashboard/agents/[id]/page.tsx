'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

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
  createdAt: string;
  updatedAt: string;
}

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [greeting, setGreeting] = useState('');

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
          <Button variant="outline">Back to Agents</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link 
            href="/dashboard/agents" 
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            ← Back to Agents
          </Link>
          <h1 className="text-3xl font-bold">{agent.name}</h1>
          <p className="text-muted-foreground mt-1">
            {agent.template ? `Template: ${agent.template}` : 'Custom agent'}
          </p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
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
            <CardTitle className="text-3xl">{agent.totalCalls}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Duration</CardDescription>
            <CardTitle className="text-3xl">
              {agent.avgDuration ? `${Math.round(agent.avgDuration)}s` : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle className="text-3xl">
              <span className={agent.isActive ? 'text-green-600' : 'text-gray-400'}>
                {agent.isActive ? 'Active' : 'Inactive'}
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Configuration</CardTitle>
          <CardDescription>
            Voice and AI model settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {editing ? (
            <>
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
                <Label htmlFor="greeting">Greeting</Label>
                <Input
                  id="greeting"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder="Hello! How can I help you today?"
                />
              </div>
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
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Voice Provider</Label>
                <p className="font-medium">{agent.voiceProvider}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Voice ID</Label>
                <p className="font-medium font-mono text-sm">{agent.voice}</p>
              </div>
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
              <div className="md:col-span-2">
                <Label className="text-muted-foreground">Greeting</Label>
                <p className="font-medium">{agent.greeting || 'No greeting set'}</p>
              </div>
              <div className="md:col-span-2">
                <Label className="text-muted-foreground">System Prompt</Label>
                <p className="font-medium whitespace-pre-wrap bg-muted p-3 rounded-md text-sm mt-1">
                  {agent.systemPrompt}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

