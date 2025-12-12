'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Phone, PhoneCall, ArrowUpRight, ArrowDownLeft, Search, RefreshCw, ChevronDown, Bot, User, Loader2, Users, UserPlus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatDuration, formatDate, formatPhoneNumber } from '@/lib/utils';
import { ELEVENLABS_VOICES } from '@/lib/constants';
import { ContactModal } from '@/components/ContactModal';
import { OutboundCallDialog } from '@/components/OutboundCallDialog';
import { AgentSelector } from '@/components/AgentSelector';
import { EmptyState } from '@/components/EmptyState';

interface Agent {
  id: string;
  name: string;
  voice?: string;
}

// Helper to get avatar for a voice
const getVoiceAvatar = (voiceId?: string): string | null => {
  if (!voiceId) return null;
  const voiceLower = voiceId.toLowerCase();
  // Try matching by ID first, then by name
  const voice = ELEVENLABS_VOICES.find(v => v.id === voiceLower || v.name.toLowerCase() === voiceLower);
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
              className={`w-full px-3 py-2 text-sm hover:bg-slate-50 text-left ${option.value === value ? 'bg-blue-50' : ''
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


// Helper to get the relevant phone number for a call
const getCallPhone = (call: any) => call.direction === 'inbound' ? call.from : call.to;

export default function CallsPage() {
  const { toast } = useToast();
  const [calls, setCalls] = useState<any[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [contacts, setContacts] = useState<Record<string, any>>({});
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
  const [addContactModalOpen, setAddContactModalOpen] = useState(false);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>('');
  const [showCallDialog, setShowCallDialog] = useState(false);

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

      const newCalls = response.data || [];

      if (pageNum === 1) {
        setCalls(newCalls);
      } else {
        setCalls((prev) => [...prev, ...newCalls]);
      }
      setHasMore(response.meta?.hasMore || false);

      // Fetch contacts for phone numbers in these calls
      if (newCalls.length > 0) {
        const phoneNumbers = Array.from(new Set(newCalls.map(getCallPhone)));
        try {
          const contactsRes = await api.getContactsBatch(phoneNumbers);
          if (contactsRes.data) {
            setContacts(prev => ({ ...prev, ...contactsRes.data }));
          }
        } catch (e) {
          // Ignore contact fetch errors
        }
      }
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
      const phoneNumbers = Array.from(new Set(calls.map(getCallPhone)));
      const contactsRes = await api.getContactsBatch(phoneNumbers);
      if (contactsRes.data) {
        setContacts(contactsRes.data);
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

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCalls(nextPage);
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
          <PhoneCall className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-600">Call Logs</h1>
            <p className="hidden sm:block text-muted-foreground text-sm">View and manage your call history</p>
          </div>
        </div>
        {/* Mobile: icon-only buttons */}
        <div className="flex gap-2 sm:hidden">
          <Button
            onClick={() => fetchCalls(1)}
            disabled={loading}
            variant="outline"
            size="icon"
            className="text-teal-600 border-teal-600 hover:bg-teal-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="icon"
            onClick={() => setShowCallDialog(true)}
            className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700"
          >
            <Phone className="h-4 w-4" />
          </Button>
        </div>
        {/* Desktop: full buttons */}
        <div className="hidden sm:flex gap-2">
          <Button
            onClick={() => fetchCalls(1)}
            disabled={loading}
            variant="outline"
            className="text-teal-600 border-teal-600 hover:bg-teal-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setShowCallDialog(true)}
            className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700"
          >
            <Phone className="h-4 w-4 mr-2" />
            Make Call
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          {/* Desktop: single row, Mobile: grid layout */}
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {/* Search - fills remaining space on desktop */}
            <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[180px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone, agent, or date..."
                className="pl-10"
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              />
            </div>

            {/* Agent Selector - full width on mobile */}
            <div className="w-full sm:w-auto sm:min-w-[140px]">
              <AgentSelector
                agents={agents}
                selectedAgentId={filter.agentId}
                onSelect={(agentId) => setFilter({ ...filter, agentId })}
                size="sm"
                emptyLabel="all"
              />
            </div>

            {/* Duration Filter */}
            <div className="w-[calc(50%-4px)] sm:w-auto sm:min-w-[130px]">
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
            <div className="w-[calc(50%-4px)] sm:w-auto sm:min-w-[120px]">
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
            <div className="w-[calc(50%-4px)] sm:w-[130px]">
              <Input
                type="date"
                value={filter.startDate}
                onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
                className="w-full text-sm"
                title="Start date"
              />
            </div>
            <div className="w-[calc(50%-4px)] sm:w-[130px]">
              <Input
                type="date"
                value={filter.endDate}
                onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
                className="w-full text-sm"
                title="End date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calls List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : calls.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Phone}
              title={filter.status || filter.agentId ? 'No calls found' : 'No calls yet'}
              description={
                filter.status || filter.agentId
                  ? 'Try adjusting your filters to find what you are looking for.'
                  : 'Your call history will appear here once you start making or receiving calls.'
              }
              action={
                !filter.status && !filter.agentId
                  ? {
                      label: 'Make a Call',
                      onClick: () => setShowCallDialog(true),
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            {calls.map((call) => {
              const phone = getCallPhone(call);
              const contactName = getContactName(phone);
              return (
                <Card key={call.id} className="hover:bg-slate-50 transition-colors">
                  <CardContent className="p-4">
                    <Link href={`/dashboard/calls/${call.id}`} className="block">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-teal-100 flex-shrink-0">
                            {call.direction === 'inbound' ? (
                              <ArrowDownLeft className="h-5 w-5 text-teal-600" />
                            ) : (
                              <ArrowUpRight className="h-5 w-5 text-teal-600" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
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
                              </>
                            )}
                            <p className="text-xs text-muted-foreground">{call.agent?.name || call.agentName || 'Deleted Agent'}</p>
                          </div>
                        </div>
                        <CallStatusBadge status={call.status} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{call.duration ? formatDuration(call.duration) : '-'}</span>
                        <span>{formatDate(call.createdAt)}</span>
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left p-4 font-medium text-slate-600">Contact</th>
                      <th className="text-left p-4 font-medium text-slate-600">Agent</th>
                      <th className="text-left p-4 font-medium text-slate-600">Duration</th>
                      <th className="text-left p-4 font-medium text-slate-600">Status</th>
                      <th className="text-left p-4 font-medium text-slate-600">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map((call) => {
                      const phone = getCallPhone(call);
                      const contactName = getContactName(phone);
                      return (
                        <tr key={call.id} className="border-b hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <Link href={`/dashboard/calls/${call.id}`} className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-teal-100 flex-shrink-0">
                                {call.direction === 'inbound' ? (
                                  <ArrowDownLeft className="h-5 w-5 text-teal-600" />
                                ) : (
                                  <ArrowUpRight className="h-5 w-5 text-teal-600" />
                                )}
                              </div>
                              <div className="min-w-0">
                                {contactName ? (
                                  <>
                                    <p className="font-medium text-slate-600">{contactName}</p>
                                    <p className="font-mono text-xs text-muted-foreground">{formatPhoneNumber(phone)}</p>
                                  </>
                                ) : (
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
                                )}
                              </div>
                            </Link>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {(() => {
                                  const avatar = getVoiceAvatar(call.agent?.voice || call.agentVoice);
                                  return avatar ? (
                                    <Image
                                      src={avatar}
                                      alt={call.agent?.name || call.agentName || ''}
                                      width={32}
                                      height={32}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Bot className="h-4 w-4 text-muted-foreground" />
                                  );
                                })()}
                              </div>
                              <span className="text-sm text-slate-600">{call.agent?.name || call.agentName || 'Deleted Agent'}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-slate-600">
                              {call.duration ? formatDuration(call.duration) : '-'}
                            </span>
                          </td>
                          <td className="p-4">
                            <CallStatusBadge status={call.status} />
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatDate(call.createdAt)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
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

      {/* Outbound Call Dialog */}
      {showCallDialog && (
        <OutboundCallDialog
          onClose={() => setShowCallDialog(false)}
          onCallInitiated={() => {
            setShowCallDialog(false);
            fetchCalls(1);
          }}
        />
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

  const labels: Record<string, string> = {
    completed: 'Completed',
    'in-progress': 'In Progress',
    failed: 'Failed',
    ringing: 'Ringing',
    'no-answer': 'No Answer',
    busy: 'Busy',
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
      {labels[status] || status}
    </span>
  );
}
