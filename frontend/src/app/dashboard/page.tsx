'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Phone, Bot, Clock, DollarSign, Plus, ArrowRight, User, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, BarChart3, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatDuration, formatCurrency, formatRelativeTime, formatPhoneNumber } from '@/lib/utils';
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

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, agentsRes, callsRes] = await Promise.all([
          api.getCallAnalytics(),
          api.getAgents(),
          api.getCalls({ limit: 5 }),
        ]);
        setStats(statsRes.data);
        setAgents(agentsRes.data || []);
        setRecentCalls(callsRes.data || []);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <BarChart3 className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-600">Dashboard</h1>
          <span className="hidden sm:inline text-slate-400">•</span>
          <p className="text-muted-foreground text-sm sm:text-base w-full sm:w-auto">Overview of your agent activity</p>
        </div>
        <Link href="/dashboard/agents/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-2" />
            New Agent
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Calls"
          value={stats?.totalCalls || 0}
          icon={<Phone className="h-5 w-5" />}
          description="All time"
        />
        <StatCard
          title="Active Agents"
          value={agents.length}
          icon={<Bot className="h-5 w-5" />}
          description="Configured"
        />
        <StatCard
          title="Total Duration"
          value={formatDuration(stats?.totalDuration || 0)}
          icon={<Clock className="h-5 w-5" />}
          description="Minutes used"
        />
        <StatCard
          title="Total Cost"
          value={formatCurrency(stats?.totalCost || 0)}
          icon={<DollarSign className="h-5 w-5" />}
          description="This period"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agents Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-slate-600">Your Agents</CardTitle>
            </div>
            <Link href="/dashboard/agents">
              <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No agents yet</p>
                <Link href="/dashboard/agents/new">
                  <Button size="sm" className="bg-teal-600 hover:bg-teal-700">Create your first agent</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {agents.slice(0, 3).map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/dashboard/agents/${agent.id}`}
                    className="flex items-center p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex flex-col gap-3 w-full">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {ELEVENLABS_VOICES.find(v => v.id === agent.voice)?.avatar ? (
                              <Image
                                src={ELEVENLABS_VOICES.find(v => v.id === agent.voice)!.avatar!}
                                alt={ELEVENLABS_VOICES.find(v => v.id === agent.voice)?.name || 'Voice'}
                                width={40}
                                height={40}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-slate-600">{agent.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {agent.totalCalls || 0} calls
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              agent.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {agent.isActive ? 'Active' : 'Inactive'}
                          </span>
                          {agent.mode && AGENT_MODES[agent.mode as keyof typeof AGENT_MODES] && (
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center bg-teal-100">
                                {getModeIcon(agent.mode)}
                              </span>
                              {AGENT_MODES[agent.mode as keyof typeof AGENT_MODES].label}
                            </span>
                          )}
                        </div>
                      </div>
                      {agent.callPurpose && (
                        <div className="text-xs text-muted-foreground">
                          {agent.callPurpose}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Calls Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-slate-600">Recent Calls</CardTitle>
            </div>
            <Link href="/dashboard/calls">
              <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentCalls.length === 0 ? (
              <div className="text-center py-8">
                <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No calls yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentCalls.map((call) => (
                  <Link
                    key={call.id}
                    href={`/dashboard/calls/${call.id}`}
                    className="flex items-center p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex flex-col gap-3 w-full">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-teal-100 flex-shrink-0">
                            {call.direction === 'inbound' ? (
                              <ArrowDownLeft className="h-4 w-4 text-teal-600" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-teal-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-mono text-sm font-medium text-slate-600">
                              {formatPhoneNumber(call.direction === 'inbound' ? call.from : call.to)}
                            </p>
                            <p className="text-xs text-muted-foreground">{call.agent?.name || call.agentName || 'Deleted Agent'}</p>
                          </div>
                        </div>
                        <CallStatusBadge status={call.status} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{call.duration ? formatDuration(call.duration) : '-'}</span>
                        <span>{formatRelativeTime(call.createdAt)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6 pb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{title}</p>
            <p className="text-lg sm:text-2xl font-bold text-slate-600 truncate">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">{description}</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 flex-shrink-0">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CallStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700',
    ringing: 'bg-yellow-100 text-yellow-700',
  };

  // Capitalize first letter
  const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
      {displayStatus}
    </span>
  );
}
