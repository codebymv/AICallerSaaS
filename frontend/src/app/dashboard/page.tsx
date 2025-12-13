'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Phone, Bot, Clock, DollarSign, Plus, ArrowRight, User, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, LayoutDashboard, Loader2, UserPlus, MessageSquare, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatDuration, formatCurrency, formatRelativeTime, formatPhoneNumber } from '@/lib/utils';
import { ELEVENLABS_VOICES, AGENT_MODES } from '@/lib/constants';
import { ContactModal } from '@/components/ContactModal';
import { Sparkline } from '@/components/Sparkline';

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

// Helper to get the relevant phone number for a call
const getCallPhone = (call: any) => call.direction === 'inbound' ? call.from : call.to;

export default function DashboardPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<any>(null);
  const [billing, setBilling] = useState<any | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [contacts, setContacts] = useState<Record<string, any>>({});
  const [timeSeries, setTimeSeries] = useState<{ date: string; calls: number; messages: number; duration: number; cost: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addContactModalOpen, setAddContactModalOpen] = useState(false);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>('');

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [statsRes, agentsRes, callsRes, timeSeriesRes, billingRes] = await Promise.all([
        api.getCallAnalytics(),
        api.getAgents(),
        api.getCalls({ limit: 5 }),
        api.getCallTimeSeries(30),
        api.getBillingStatus(),
      ]);
      setStats(statsRes.data);
      setAgents(agentsRes.data || []);
      const calls = callsRes.data || [];
      setRecentCalls(calls);
      setTimeSeries(timeSeriesRes.data || []);
      setBilling(billingRes.data);

      // Fetch contacts for phone numbers in recent calls
      if (calls.length > 0) {
        const phoneNumbers = Array.from(new Set(calls.map(getCallPhone)));
        try {
          const contactsRes = await api.getContactsBatch(phoneNumbers);
          if (contactsRes.data) {
            setContacts(contactsRes.data);
          }
        } catch (e) {
          // Ignore contact fetch errors
        }
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper to get contact name for a phone number
  const getContactName = (phone: string) => {
    const normalized = phone.replace(/\D/g, '');
    return contacts[phone]?.name || contacts[normalized]?.name || contacts[`+${normalized}`]?.name || contacts[`+1${normalized}`]?.name || null;
  };

  const handleAddContact = (phone: string) => {
    setSelectedPhoneNumber(phone);
    setAddContactModalOpen(true);
  };

  const handleSaveContact = async (data: { name: string; phoneNumber: string; notes?: string }) => {
    try {
      await api.createContact(data);
      toast({
        title: 'Contact added',
        description: 'The contact has been saved',
      });
      setAddContactModalOpen(false);
      // Refresh contacts
      const phoneNumbers = Array.from(new Set(recentCalls.map(getCallPhone)));
      try {
        const contactsRes = await api.getContactsBatch(phoneNumbers);
        if (contactsRes.data) {
          setContacts(contactsRes.data);
        }
      } catch (e) {
        // Ignore
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save contact',
        variant: 'destructive',
      });
      throw error;
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
          <LayoutDashboard className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-600">Dashboard</h1>
            <p className="hidden sm:block text-muted-foreground text-sm">Overview of your agent activity</p>
          </div>
        </div>
        {/* Mobile: icon-only buttons */}
        <div className="flex gap-2 sm:hidden">
          <Button
            onClick={() => fetchData(true)}
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
            onClick={() => fetchData(true)}
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Calls"
          value={stats?.totalCalls || 0}
          icon={<Phone className="h-5 w-5" />}
          description="Voice communications"
          chartData={timeSeries.map(d => ({ date: d.date, value: d.calls }))}
        />
        <StatCard
          title="Total Messages"
          value={stats?.totalMessages || 0}
          icon={<MessageSquare className="h-5 w-5" />}
          description="SMS/MMS sent"
          chartData={timeSeries.map(d => ({ date: d.date, value: d.messages }))}
        />
        <StatCard
          title="Total Duration"
          value={formatDuration(stats?.totalDuration || 0)}
          icon={<Clock className="h-5 w-5" />}
          description="Call minutes"
          chartData={timeSeries.map(d => ({ date: d.date, value: d.duration }))}
        />
        <StatCard
          title="Usage Credits"
          value={
            billing
              ? `${billing.minutesUsed * 10} / ${billing.minutesLimit * 10}`
              : '—'
          }
          icon={<Clock className="h-5 w-5" />}
          description="Included credits usage"
          progress={billing ? (billing.minutesUsed / (billing.minutesLimit || 1)) * 100 : 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agents Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-slate-600">Your Agents</CardTitle>
              <span className="text-sm text-muted-foreground">({agents.length})</span>
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
                  <Button size="sm" className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">Create your first agent</Button>
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
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
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
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-600 truncate">{agent.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {agent.totalCalls || 0} calls
                            {agent.callPurpose && (
                              <>
                                <span className="mx-1.5">•</span>
                                {agent.callPurpose}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${agent.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                            }`}
                        >
                          {agent.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {agent.mode && AGENT_MODES[agent.mode as keyof typeof AGENT_MODES] && (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center bg-teal-100">
                              {getModeIcon(agent.mode)}
                            </span>
                            {AGENT_MODES[agent.mode as keyof typeof AGENT_MODES].label}
                          </span>
                        )}
                      </div>
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
                {recentCalls.map((call) => {
                  const phone = getCallPhone(call);
                  const contactName = getContactName(phone);
                  return (
                    <div
                      key={call.id}
                      className="flex items-center p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                    >
                      <Link href={`/dashboard/calls/${call.id}`} className="flex flex-col gap-3 w-full">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-teal-100 flex-shrink-0">
                              {call.direction === 'inbound' ? (
                                <ArrowDownLeft className="h-4 w-4 text-teal-600" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4 text-teal-600" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              {/* Mobile view */}
                              <div className="sm:hidden">
                                {contactName ? (
                                  <>
                                    <p className="text-sm font-medium text-slate-600">{contactName}</p>
                                    <p className="font-mono text-xs text-muted-foreground">{formatPhoneNumber(phone)}</p>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <p className="font-mono text-sm font-medium text-slate-600">{formatPhoneNumber(phone)}</p>
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleAddContact(phone);
                                        }}
                                        className="text-slate-400 hover:text-teal-600 transition-colors"
                                        title="Add to contacts"
                                      >
                                        <UserPlus className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{call.agent?.name || call.agentName || 'Deleted Agent'}</p>
                                  </>
                                )}
                              </div>
                              {/* Desktop view */}
                              <div className="hidden sm:block">
                                <p className="text-xs text-muted-foreground mb-1">
                                  {call.direction === 'inbound' ? 'Inbound Call' : 'Outbound Call'}
                                </p>
                                {contactName ? (
                                  <div>
                                    <p className="text-sm font-medium text-slate-600">{contactName}</p>
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="font-mono text-muted-foreground">{formatPhoneNumber(call.from)}</span>
                                      <span className="text-muted-foreground">→</span>
                                      <span className="font-mono text-muted-foreground">{formatPhoneNumber(call.to)}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="font-mono font-medium text-slate-600">{formatPhoneNumber(call.from)}</span>
                                      <span className="text-muted-foreground">→</span>
                                      <span className="font-mono font-medium text-slate-600">{formatPhoneNumber(call.to)}</span>
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleAddContact(phone);
                                        }}
                                        className="text-slate-400 hover:text-teal-600 transition-colors"
                                        title="Add to contacts"
                                      >
                                        <UserPlus className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{call.agent?.name || call.agentName || 'Deleted Agent'}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <CallStatusBadge status={call.status} />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{call.duration ? formatDuration(call.duration) : '-'}</span>
                          <span>{formatRelativeTime(call.createdAt)}</span>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contact Modal */}
      <ContactModal
        open={addContactModalOpen}
        onClose={() => {
          setAddContactModalOpen(false);
          setSelectedPhoneNumber('');
        }}
        onSave={handleSaveContact}
        initialPhoneNumber={selectedPhoneNumber}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
  chartData,
  progress,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  chartData?: { date: string; value: number }[];
  progress?: number;
}) {
  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-[70px] sm:min-w-[90px] shrink-0">
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{title}</p>
            <p className="text-lg sm:text-2xl font-bold text-slate-600 truncate">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">{description}</p>
          </div>
          {chartData && chartData.length > 0 ? (
            <div className="flex-1 h-10 sm:h-12 min-w-[60px] max-w-[180px] xl:max-w-[220px]">
              <Sparkline data={chartData} />
            </div>
          ) : progress !== undefined ? (
            <div className="flex-1 min-w-[60px] max-w-[180px] xl:max-w-[220px] flex items-center justify-end">
              <Progress value={progress} className="h-2 w-full" indicatorClassName="bg-gradient-to-b from-[#0fa693] to-teal-600" />
            </div>
          ) : (
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 flex-shrink-0">
              {icon}
            </div>
          )}
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
