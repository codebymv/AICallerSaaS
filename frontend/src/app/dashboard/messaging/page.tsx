'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MessageSquare, Bot, Search, RefreshCw, ChevronDown, Loader2, Users, UserPlus, ArrowUpRight, ArrowDownLeft, Image as ImageIcon, FileText, Video } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatDate, formatPhoneNumber, formatRelativeTime } from '@/lib/utils';
import { ELEVENLABS_VOICES } from '@/lib/constants';
import { ContactModal } from '@/components/ContactModal';
import { OutboundMessageDialog } from '@/components/OutboundMessageDialog';
import { AgentSelector } from '@/components/AgentSelector';
import { EmptyState } from '@/components/EmptyState';

interface Agent {
  id: string;
  name: string;
  voice?: string;
}

interface Conversation {
  id: string;
  externalNumber: string;
  twilioNumber: string;
  lastMessageAt: string;
  messageCount: number;
  agent: Agent | null;
  agentName?: string; // Denormalized for when agent is deleted
  agentVoice?: string;
  lastMessage: {
    id: string;
    body: string | null;
    direction: string;
    status: string;
    createdAt: string;
    numMedia: number;
  } | null;
  createdAt: string;
  updatedAt: string;
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

// Helper to truncate message preview
const truncateMessage = (text: string | null, maxLength: number = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Helper to get status badge color
const getStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'DELIVERED':
      return 'bg-green-100 text-green-700';
    case 'SENT':
      return 'bg-blue-100 text-blue-700';
    case 'QUEUED':
    case 'SENDING':
      return 'bg-yellow-100 text-yellow-700';
    case 'FAILED':
    case 'UNDELIVERED':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

export default function MessagingPage() {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [contacts, setContacts] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState({
    search: '',
    agentId: '',
    status: '',
    messageCount: '',
    startDate: '',
    endDate: '',
  });
  const [addContactModalOpen, setAddContactModalOpen] = useState(false);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>('');
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [selectedAgentForMessage, setSelectedAgentForMessage] = useState<any>(null);

  const fetchConversations = async (pageNum: number = 1) => {
    try {
      const response = await api.getConversations({
        page: pageNum,
        limit: 20,
        agentId: filter.agentId || undefined,
        search: filter.search || undefined,
        status: filter.status || undefined,
        messageCount: filter.messageCount || undefined,
        startDate: filter.startDate || undefined,
        endDate: filter.endDate || undefined,
      });

      const newConversations = response.data || [];

      if (pageNum === 1) {
        setConversations(newConversations);
      } else {
        setConversations((prev) => [...prev, ...newConversations]);
      }
      setHasMore(response.meta?.hasMore || false);

      // Fetch contacts for phone numbers in these conversations
      if (newConversations.length > 0) {
        const phoneNumbers = Array.from(new Set(newConversations.map((c: Conversation) => c.externalNumber)));
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
      console.error('Failed to fetch conversations:', error);
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
    fetchConversations(1);
  }, [filter.agentId, filter.status, filter.messageCount, filter.startDate, filter.endDate]);

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
      const phoneNumbers = Array.from(new Set(conversations.map((c) => c.externalNumber)));
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
    fetchConversations(nextPage);
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
          <MessageSquare className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-600">Messaging</h1>
            <p className="hidden sm:block text-muted-foreground text-sm">View and manage SMS/MMS conversations</p>
          </div>
        </div>
        {/* Mobile: icon-only buttons */}
        <div className="flex gap-2 sm:hidden">
          <Button
            onClick={() => fetchConversations(1)}
            disabled={loading}
            variant="outline"
            size="icon"
            className="text-teal-600 border-teal-600 hover:bg-teal-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="icon"
            onClick={() => setShowMessageDialog(true)}
            className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
        {/* Desktop: full buttons */}
        <div className="hidden sm:flex gap-2">
          <Button
            onClick={() => fetchConversations(1)}
            disabled={loading}
            variant="outline"
            className="text-teal-600 border-teal-600 hover:bg-teal-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setShowMessageDialog(true)}
            className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Send Message
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
                placeholder="Search by phone number..."
                className="pl-10"
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetchConversations(1);
                  }
                }}
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

            {/* Status Filter */}
            <div className="w-[calc(50%-4px)] sm:w-auto sm:min-w-[130px]">
              <Dropdown
                options={[
                  { value: '', label: 'All Status' },
                  { value: 'DELIVERED', label: 'Delivered' },
                  { value: 'SENT', label: 'Sent' },
                  { value: 'QUEUED', label: 'Queued' },
                  { value: 'FAILED', label: 'Failed' },
                  { value: 'UNDELIVERED', label: 'Undelivered' },
                ]}
                value={filter.status}
                onChange={(value) => setFilter({ ...filter, status: value })}
              />
            </div>

            {/* Message Count Filter */}
            <div className="w-[calc(50%-4px)] sm:w-auto sm:min-w-[120px]">
              <Dropdown
                options={[
                  { value: '', label: 'All Counts' },
                  { value: '<5', label: '< 5 msgs' },
                  { value: '5-10', label: '5-10 msgs' },
                  { value: '>10', label: '> 10 msgs' },
                ]}
                value={filter.messageCount}
                onChange={(value) => setFilter({ ...filter, messageCount: value })}
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

      {/* Conversations List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : conversations.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={MessageSquare}
              title={filter.agentId ? 'No conversations found' : 'No conversations yet'}
              description={
                filter.agentId
                  ? 'Try adjusting your filters to find what you are looking for.'
                  : 'When you send or receive SMS/MMS messages with your agents, they will appear here.'
              }
              action={
                !filter.agentId
                  ? {
                      label: 'New Message',
                      onClick: () => setShowMessageDialog(true),
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
            {conversations.map((conv) => {
              const contactName = getContactName(conv.externalNumber);
              const lastMsg = conv.lastMessage;
              const lastDirection = lastMsg?.direction;
              return (
                <Card key={conv.id} className="hover:bg-slate-50 transition-colors">
                  <CardContent className="p-4">
                    <Link href={`/dashboard/messaging/${conv.id}`} className="block">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-teal-100 flex-shrink-0">
                            {lastDirection === 'INBOUND' ? (
                              <ArrowDownLeft className="h-5 w-5 text-teal-600" />
                            ) : (
                              <ArrowUpRight className="h-5 w-5 text-teal-600" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            {contactName ? (
                              <>
                                <p className="text-sm font-medium text-slate-600">{contactName}</p>
                                <p className="font-mono text-xs text-muted-foreground">{formatPhoneNumber(conv.externalNumber)}</p>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <p className="font-mono text-sm font-medium text-slate-600">{formatPhoneNumber(conv.externalNumber)}</p>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleAddContact(conv.externalNumber);
                                    }}
                                    className="text-slate-400 hover:text-teal-600 transition-colors"
                                    title="Add to contacts"
                                  >
                                    <UserPlus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </>
                            )}
                            <p className="text-xs text-muted-foreground">{conv.agent?.name || conv.agentName || 'Deleted Agent'}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-muted-foreground">{formatRelativeTime(conv.lastMessageAt)}</p>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 mt-1">
                            {conv.messageCount} msgs
                          </span>
                        </div>
                      </div>

                      {/* Last message preview */}
                      {lastMsg && (
                        <div className="flex items-start gap-2 pl-[52px]">
                          {lastMsg.direction === 'INBOUND' ? (
                            <ArrowDownLeft className="h-3 w-3 text-slate-400 mt-0.5 flex-shrink-0" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3 text-teal-500 mt-0.5 flex-shrink-0" />
                          )}
                          <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
                            {lastMsg.numMedia > 0 && (
                              <span className="inline-flex items-center gap-1 mr-1 text-teal-600">
                                <ImageIcon className="h-3 w-3" />
                              </span>
                            )}
                            {truncateMessage(lastMsg.body, 80) || (lastMsg.numMedia > 0 ? 'Media attachment' : 'No content')}
                          </p>
                        </div>
                      )}
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
                      <th className="text-left p-4 font-medium text-slate-600">Last Message</th>
                      <th className="text-left p-4 font-medium text-slate-600">Messages</th>
                      <th className="text-left p-4 font-medium text-slate-600">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversations.map((conv) => {
                      const contactName = getContactName(conv.externalNumber);
                      const lastMsg = conv.lastMessage;
                      const agentAvatar = getVoiceAvatar(conv.agent?.voice || conv.agentVoice);

                      return (
                        <tr key={conv.id} className="border-b hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <Link href={`/dashboard/messaging/${conv.id}`} className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-teal-100 flex-shrink-0">
                                {lastMsg?.direction === 'INBOUND' ? (
                                  <ArrowDownLeft className="h-5 w-5 text-teal-600" />
                                ) : (
                                  <ArrowUpRight className="h-5 w-5 text-teal-600" />
                                )}
                              </div>
                              <div className="min-w-0">
                                {contactName ? (
                                  <>
                                    <p className="font-medium text-slate-600">{contactName}</p>
                                    <p className="font-mono text-xs text-muted-foreground">{formatPhoneNumber(conv.externalNumber)}</p>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <p className="font-mono text-sm font-medium text-slate-600">{formatPhoneNumber(conv.externalNumber)}</p>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleAddContact(conv.externalNumber);
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
                                {agentAvatar ? (
                                  <Image
                                    src={agentAvatar}
                                    alt={conv.agent?.name || conv.agentName || 'Deleted Agent'}
                                    width={32}
                                    height={32}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Bot className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <span className="text-sm text-slate-600">{conv.agent?.name || conv.agentName || 'Deleted Agent'}</span>
                            </div>
                          </td>
                          <td className="p-4 max-w-xs">
                            <Link href={`/dashboard/messaging/${conv.id}`}>
                              {lastMsg ? (
                                <div className="flex items-start gap-2">
                                  {lastMsg.direction === 'INBOUND' ? (
                                    <ArrowDownLeft className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                  ) : (
                                    <ArrowUpRight className="h-4 w-4 text-teal-500 mt-0.5 flex-shrink-0" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm text-slate-600 truncate">
                                      {lastMsg.numMedia > 0 && (
                                        <span className="inline-flex items-center gap-1 mr-1 text-teal-600">
                                          <ImageIcon className="h-3 w-3" />
                                        </span>
                                      )}
                                      {truncateMessage(lastMsg.body, 40) || (lastMsg.numMedia > 0 ? 'Media attachment' : 'No content')}
                                    </p>
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mt-1 ${getStatusColor(lastMsg.status)}`}>
                                      {lastMsg.status}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">No messages</span>
                              )}
                            </Link>
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center px-2 py-1 rounded text-sm font-medium bg-slate-100 text-slate-600">
                              {conv.messageCount}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                            {formatRelativeTime(conv.lastMessageAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={loadMore}
                className="text-teal-600 border-teal-600 hover:bg-teal-50"
              >
                Load More
              </Button>
            </div>
          )}
        </>
      )}

      {/* Add Contact Modal */}
      <ContactModal
        open={addContactModalOpen}
        onClose={() => setAddContactModalOpen(false)}
        onSave={handleSaveContact}
        initialPhoneNumber={selectedPhoneNumber}
      />

      {/* Send Message Dialog */}
      {showMessageDialog && (
        <OutboundMessageDialog
          onClose={() => setShowMessageDialog(false)}
          onMessageSent={() => {
            fetchConversations(1);
          }}
        />
      )}
    </div>
  );
}
