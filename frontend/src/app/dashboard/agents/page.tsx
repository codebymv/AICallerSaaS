'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Plus, Bot, MoreVertical, Trash2, Edit, User, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/DeleteButton';
import { EmptyState } from '@/components/EmptyState';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES, AGENT_MODES } from '@/lib/constants';

const getModeIcon = (mode: string) => {
  switch (mode) {
    case 'INBOUND':
      return <ArrowDownLeft className="h-3.5 w-3.5 text-teal-600" />;
    case 'OUTBOUND':
      return <ArrowUpRight className="h-3.5 w-3.5 text-teal-600" />;
    case 'HYBRID':
      return <ArrowLeftRight className="h-3.5 w-3.5 text-teal-600" />;
    default:
      return null;
  }
};

export default function AgentsPage() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAgents = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const response = await api.getAgents();
      setAgents(response.data || []);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bot className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-600">Agents</h1>
            <p className="hidden sm:block text-muted-foreground text-sm">Manage your AI voice agents</p>
          </div>
        </div>
        {/* Mobile: icon-only buttons */}
        <div className="flex gap-2 sm:hidden">
          <Button
            onClick={() => fetchAgents(true)}
            disabled={refreshing}
            variant="outline"
            size="icon"
            className="text-teal-600 border-teal-600 hover:bg-teal-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Link href="/dashboard/agents/new">
            <Button size="icon" className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        {/* Desktop: full buttons */}
        <div className="hidden sm:flex gap-2">
          <Button
            onClick={() => fetchAgents(true)}
            disabled={refreshing}
            variant="outline"
            className="text-teal-600 border-teal-600 hover:bg-teal-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/dashboard/agents/new">
            <Button className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
              <Plus className="h-4 w-4 mr-2" />
              New Agent
            </Button>
          </Link>
        </div>
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Bot}
              title="No agents yet"
              description="Create your first AI voice agent to start handling calls automatically."
              action={{
                label: 'Create Your First Agent',
                onClick: () => window.location.href = '/dashboard/agents/new',
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card key={agent.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Link href={`/dashboard/agents/${agent.id}`} className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-teal-600 transition-all">
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
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/agents/${agent.id}`}>
                      <CardTitle className="text-lg text-slate-600 hover:text-teal-600 hover:underline decoration-slate-300 hover:decoration-teal-600 underline-offset-2 transition-colors cursor-pointer">
                        {agent.name}
                      </CardTitle>
                    </Link>
                    <CardDescription className="line-clamp-1">
                      {agent.callPurpose || 'No purpose set'}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Link href={`/dashboard/agents/${agent.id}?edit=true`}>
                    <Button variant="ghost" size="icon" title="Edit agent" className="text-teal-600 hover:text-teal-700">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <DeleteButton
                    onDelete={() => handleDelete(agent.id, agent.name)}
                    itemName={agent.name}
                    title="Delete Agent"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {agent.totalCalls || 0} calls
                  </span>
                  <div className="flex items-center gap-2">
                    {agent.mode && AGENT_MODES[agent.mode as keyof typeof AGENT_MODES] && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center bg-teal-100">
                          {getModeIcon(agent.mode)}
                        </span>
                        {AGENT_MODES[agent.mode as keyof typeof AGENT_MODES].label}
                      </span>
                    )}
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${agent.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                        }`}
                    >
                      {agent.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 sm:gap-4 text-xs text-muted-foreground flex-wrap">
                    <span>Voice: {ELEVENLABS_VOICES.find(v => v.id === agent.voice)?.name || agent.voiceProvider}</span>
                    <span>•</span>
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
