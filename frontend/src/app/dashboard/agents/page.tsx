'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Plus, Bot, MoreVertical, Trash2, Edit, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES } from '@/lib/constants';

export default function AgentsPage() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = async () => {
    try {
      const response = await api.getAgents();
      setAgents(response.data || []);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      await api.deleteAgent(id);
      toast({ title: 'Agent deleted', description: `${name} has been deleted.` });
      fetchAgents();
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'Failed to delete agent.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Agents</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Manage your AI voice agents</p>
        </div>
        <Link href="/dashboard/agents/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-2" />
            New Agent
          </Button>
        </Link>
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Create your first AI voice agent to start handling calls automatically.
            </p>
            <Link href="/dashboard/agents/new">
              <Button className="bg-teal-600 hover:bg-teal-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Agent
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card key={agent.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {ELEVENLABS_VOICES.find(v => v.id === agent.voice)?.avatar ? (
                      <Image
                        src={ELEVENLABS_VOICES.find(v => v.id === agent.voice)!.avatar!}
                        alt={ELEVENLABS_VOICES.find(v => v.id === agent.voice)?.name || 'Voice'}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-6 w-6 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <CardDescription className="line-clamp-1">
                      {agent.description || 'No description'}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Link href={`/dashboard/agents/${agent.id}?edit=true`}>
                    <Button variant="ghost" size="icon" title="Edit agent" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(agent.id, agent.name)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {agent.totalCalls || 0} calls
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      agent.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {agent.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-muted-foreground">
                    <span>Voice: {ELEVENLABS_VOICES.find(v => v.id === agent.voice)?.name || agent.voiceProvider}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>Created: {new Date(agent.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
