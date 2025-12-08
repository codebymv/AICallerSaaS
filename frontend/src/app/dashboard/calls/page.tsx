'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Phone, PhoneCall, ArrowUpRight, ArrowDownLeft, Search, RefreshCw, ChevronDown, Bot, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { formatDuration, formatDate, formatPhoneNumber } from '@/lib/utils';
import { ELEVENLABS_VOICES } from '@/lib/constants';

interface Agent {
  id: string;
  name: string;
  voice?: string;
}

// Helper to get avatar for a voice
const getVoiceAvatar = (voiceId?: string): string | null => {
  if (!voiceId) return null;
  const voice = ELEVENLABS_VOICES.find(v => v.id === voiceId.toLowerCase());
  return voice?.avatar || null;
};

// Generic Dropdown Component
function Dropdown({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm border rounded-md bg-white hover:bg-slate-50 transition-colors justify-between"
      >
        <span className={value ? '' : 'text-muted-foreground'}>{selectedOption.label}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg py-1 max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-sm hover:bg-slate-50 text-left ${
                option.value === value ? 'bg-blue-50' : ''
              }`}
            >
              <span className={option.value ? '' : 'text-muted-foreground'}>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Agent Selector Component
function AgentSelector({
  agents,
  selectedAgentId,
  onSelect,
}: {
  agents: Agent[];
  selectedAgentId: string;
  onSelect: (agentId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const selectedAvatar = selectedAgent ? getVoiceAvatar(selectedAgent.voice) : null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm border rounded-md bg-white hover:bg-slate-50 transition-colors justify-between"
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedAgent ? (
            <>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {selectedAvatar ? (
                  <Image
                    src={selectedAvatar}
                    alt={selectedAgent.name}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Bot className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <span className="truncate">{selectedAgent.name}</span>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-muted-foreground">All Agents</span>
            </>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-white border rounded-md shadow-lg py-1 max-h-60 overflow-auto">
          <button
            type="button"
            onClick={() => {
              onSelect('');
              setIsOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 text-left ${
              !selectedAgentId ? 'bg-blue-50' : ''
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Bot className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-muted-foreground">All Agents</span>
          </button>
          {agents.map((agent) => {
            const avatar = getVoiceAvatar(agent.voice);
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  onSelect(agent.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 text-left ${
                  agent.id === selectedAgentId ? 'bg-blue-50' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {avatar ? (
                    <Image
                      src={avatar}
                      alt={agent.name}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <span className="truncate">{agent.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CallsPage() {
  const [calls, setCalls] = useState<any[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState({ 
    status: '', 
    search: '', 
    agentId: '',
    duration: '',
    startDate: '',
    endDate: ''
  });

  const fetchCalls = async (pageNum: number = 1) => {
    try {
      const response = await api.getCalls({
        page: pageNum,
        limit: 20,
        status: filter.status || undefined,
        agentId: filter.agentId || undefined,
        startDate: filter.startDate || undefined,
        endDate: filter.endDate || undefined,
      });
      
      if (pageNum === 1) {
        setCalls(response.data || []);
      } else {
        setCalls((prev) => [...prev, ...(response.data || [])]);
      }
      setHasMore(response.meta?.hasMore || false);
    } catch (error) {
      console.error('Failed to fetch calls:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const agentsRes = await api.getAgents();
      setAgents(agentsRes.data || []);
    };
    fetchData();
  }, []);

  useEffect(() => {
    fetchCalls(1);
  }, [filter.status, filter.agentId, filter.duration, filter.startDate, filter.endDate]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCalls(nextPage);
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
        <div className="flex items-center gap-3 flex-wrap">
          <PhoneCall className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-600">Calls</h1>
          <span className="hidden sm:inline text-slate-400">•</span>
          <p className="text-muted-foreground text-sm sm:text-base w-full sm:w-auto">View and manage your call history</p>
        </div>
        <Button onClick={() => fetchCalls(1)} disabled={loading} className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone, agent, or date..."
                className="pl-10"
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              />
            </div>

            {/* Agent Selector */}
            <div className="w-full sm:w-auto sm:min-w-[160px]">
              <AgentSelector
                agents={agents}
                selectedAgentId={filter.agentId}
                onSelect={(agentId) => setFilter({ ...filter, agentId })}
              />
            </div>

            {/* Duration Filter */}
            <div className="w-full sm:w-auto sm:min-w-[140px]">
              <Dropdown
                options={[
                  { value: '', label: 'All Durations' },
                  { value: '<60', label: '< 1 min' },
                  { value: '60-300', label: '1-5 min' },
                  { value: '300-600', label: '5-10 min' },
                  { value: '>600', label: '> 10 min' },
                ]}
                value={filter.duration}
                onChange={(value) => setFilter({ ...filter, duration: value })}
              />
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-auto sm:min-w-[140px]">
              <Dropdown
                options={[
                  { value: '', label: 'All Status' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'in-progress', label: 'In Progress' },
                  { value: 'failed', label: 'Failed' },
                  { value: 'no-answer', label: 'No Answer' },
                ]}
                value={filter.status}
                onChange={(value) => setFilter({ ...filter, status: value })}
              />
            </div>

            {/* Date Range */}
            <div className="w-full sm:w-auto sm:min-w-[150px]">
              <Input
                type="date"
                placeholder="From date"
                value={filter.startDate}
                onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
              />
            </div>

            <div className="w-full sm:w-auto sm:min-w-[150px]">
              <Input
                type="date"
                placeholder="To date"
                value={filter.endDate}
                onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calls List */}
      {calls.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Phone className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No calls yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              When you make or receive calls with your agents, they'll appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            {calls.map((call) => (
              <Link key={call.id} href={`/dashboard/calls/${call.id}`}>
                <Card className="hover:bg-slate-50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-teal-100">
                          {call.direction === 'inbound' ? (
                            <ArrowDownLeft className="h-4 w-4 text-teal-600" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-teal-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-mono text-sm font-medium">
                            {formatPhoneNumber(call.direction === 'inbound' ? call.from : call.to)}
                          </p>
                          <p className="text-xs text-muted-foreground">{call.agent?.name || 'Unknown'}</p>
                        </div>
                      </div>
                      <CallStatusBadge status={call.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{call.duration ? formatDuration(call.duration) : '-'}</span>
                      <span>{formatDate(call.createdAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Desktop Table View */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr className="text-sm text-muted-foreground">
                      <th className="text-left p-4 font-medium">Direction</th>
                      <th className="text-left p-4 font-medium">Phone</th>
                      <th className="text-left p-4 font-medium">Agent</th>
                      <th className="text-left p-4 font-medium">Duration</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-left p-4 font-medium">Date</th>
                      <th className="text-left p-4 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map((call) => (
                      <tr key={call.id} className="border-b hover:bg-slate-50">
                        <td className="p-4">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-teal-100">
                            {call.direction === 'inbound' ? (
                              <ArrowDownLeft className="h-4 w-4 text-teal-600" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-teal-600" />
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="font-mono text-sm">
                            {formatPhoneNumber(call.direction === 'inbound' ? call.from : call.to)}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm">{call.agent?.name || 'Unknown'}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm">
                            {call.duration ? formatDuration(call.duration) : '-'}
                          </span>
                        </td>
                        <td className="p-4">
                          <CallStatusBadge status={call.status} />
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-muted-foreground">
                            {formatDate(call.createdAt)}
                          </span>
                        </td>
                        <td className="p-4">
                          <Link href={`/dashboard/calls/${call.id}`}>
                            <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {hasMore && (
            <div className="text-center">
              <Button variant="outline" onClick={loadMore} className="text-teal-600 border-teal-600 hover:bg-teal-50">
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CallStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700',
    ringing: 'bg-yellow-100 text-yellow-700',
    'no-answer': 'bg-slate-100 text-slate-600',
    busy: 'bg-orange-100 text-orange-700',
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}
