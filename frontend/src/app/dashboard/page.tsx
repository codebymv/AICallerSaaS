'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Phone, Bot, Clock, DollarSign, Plus, ArrowRight, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatDuration, formatCurrency, formatRelativeTime } from '@/lib/utils';
import { ELEVENLABS_VOICES } from '@/lib/constants';

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your AI calling activity</p>
        </div>
        <Link href="/dashboard/agents/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Agent
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <CardTitle>Your Agents</CardTitle>
              <CardDescription>AI voice agents you've created</CardDescription>
            </div>
            <Link href="/dashboard/agents">
              <Button variant="ghost" size="sm">
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
                  <Button size="sm">Create your first agent</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {agents.slice(0, 3).map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/dashboard/agents/${agent.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {ELEVENLABS_VOICES.find(v => v.id === agent.voice)?.avatar ? (
                          <Image
                            src={ELEVENLABS_VOICES.find(v => v.id === agent.voice)!.avatar!}
                            alt={ELEVENLABS_VOICES.find(v => v.id === agent.voice)?.name || 'Voice'}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {agent.totalCalls || 0} calls
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        agent.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {agent.isActive ? 'Active' : 'Inactive'}
                    </span>
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
              <CardTitle>Recent Calls</CardTitle>
              <CardDescription>Latest call activity</CardDescription>
            </div>
            <Link href="/dashboard/calls">
              <Button variant="ghost" size="sm">
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
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          call.direction === 'inbound'
                            ? 'bg-blue-100'
                            : 'bg-green-100'
                        }`}
                      >
                        <Phone
                          className={`h-5 w-5 ${
                            call.direction === 'inbound'
                              ? 'text-blue-600'
                              : 'text-green-600'
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-medium">{call.to}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatRelativeTime(call.createdAt)}
                        </p>
                      </div>
                    </div>
                    <CallStatusBadge status={call.status} />
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
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
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

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}
