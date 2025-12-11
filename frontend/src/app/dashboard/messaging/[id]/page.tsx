'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  MessageSquare,
  ArrowLeft,
  Bot,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  UserPlus,
  Clock,
  Image as ImageIcon,
  FileText,
  Video,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES } from '@/lib/constants';
import { ContactModal } from '@/components/ContactModal';
import { formatPhoneNumber } from '@/lib/utils';

interface Message {
  id: string;
  messageSid: string;
  type: string;
  direction: string;
  status: string;
  from: string;
  to: string;
  body: string | null;
  mediaUrls: string[];
  mediaTypes: string[];
  numMedia: number;
  sentAt: string | null;
  deliveredAt: string | null;
  aiGenerated: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  agentName: string | null;
  createdAt: string;
}

interface ConversationData {
  id: string;
  externalNumber: string;
  twilioNumber: string;
  lastMessageAt: string;
  agent: {
    id: string;
    name: string;
    voice?: string;
    communicationChannel?: string;
  } | null;
  agentName?: string; // Denormalized for when agent is deleted
  agentVoice?: string;
  createdAt: string;
}

// Helper to get avatar for a voice
const getVoiceAvatar = (voiceId?: string): string | null => {
  if (!voiceId) return null;
  const voice = ELEVENLABS_VOICES.find(v => v.id === voiceId.toLowerCase());
  return voice?.avatar || null;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const dateStr = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateStr} at ${timeStr}`;
};

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateHeader = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }
};

// Helper to get status badge color
const getStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'DELIVERED':
      return 'text-green-600';
    case 'SENT':
      return 'text-blue-600';
    case 'QUEUED':
    case 'SENDING':
      return 'text-yellow-600';
    case 'FAILED':
    case 'UNDELIVERED':
      return 'text-red-600';
    default:
      return 'text-slate-500';
  }
};

const getStatusIcon = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'DELIVERED':
      return <CheckCircle className="h-3 w-3" />;
    case 'SENT':
      return <CheckCircle className="h-3 w-3" />;
    case 'FAILED':
    case 'UNDELIVERED':
      return <XCircle className="h-3 w-3" />;
    default:
      return <Clock className="h-3 w-3" />;
  }
};

// Helper to get media icon
const getMediaIcon = (mimeType: string) => {
  if (mimeType?.startsWith('image/')) {
    return <ImageIcon className="h-4 w-4" />;
  } else if (mimeType?.startsWith('video/')) {
    return <Video className="h-4 w-4" />;
  } else {
    return <FileText className="h-4 w-4" />;
  }
};

// Check if messages are on the same day
const isSameDay = (date1: string, date2: string): boolean => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.toDateString() === d2.toDateString();
};

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<{ name: string; phoneNumber: string } | null>(null);
  const [addContactModalOpen, setAddContactModalOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationId = params.id as string;

  useEffect(() => {
    if (conversationId) {
      fetchConversation();
    }
  }, [conversationId]);

  const fetchConversation = async (pageNum: number = 1) => {
    try {
      const response = await api.getConversation(conversationId, { page: pageNum, limit: 50 });
      
      if (pageNum === 1) {
        setConversation(response.data.conversation);
        setMessages(response.data.messages);
      } else {
        // Prepend older messages
        setMessages(prev => [...response.data.messages, ...prev]);
      }
      
      setHasMore(response.meta?.hasMore || false);
      setPage(pageNum);

      // Fetch contact for the external phone number
      const convData = response.data.conversation;
      if (convData) {
        try {
          const contactRes = await api.getContactByPhone(convData.externalNumber);
          if (contactRes.data) {
            setContact(contactRes.data);
          }
        } catch (e) {
          // Ignore contact fetch errors
        }
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to fetch conversation';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      if (error instanceof ApiError && error.status === 404) {
        router.push('/dashboard/messaging');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    fetchConversation(page + 1);
  };

  const handleAddContact = () => {
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
      // Refresh contact
      if (conversation) {
        try {
          const contactRes = await api.getContactByPhone(conversation.externalNumber);
          if (contactRes.data) {
            setContact(contactRes.data);
          }
        } catch (e) {
          // Ignore
        }
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

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/messaging">
            <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Messaging
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">Conversation not found</h3>
            <p className="text-muted-foreground text-center">
              The conversation you're looking for doesn't exist or has been deleted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const agentAvatar = getVoiceAvatar(conversation.agent?.voice || conversation.agentVoice);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/messaging">
              <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-teal-100 flex-shrink-0">
                <MessageSquare className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                {contact ? (
                  <>
                    <h1 className="text-lg font-semibold text-slate-600">{contact.name}</h1>
                    <p className="text-sm text-muted-foreground font-mono">{formatPhoneNumber(conversation.externalNumber)}</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-semibold text-slate-600 font-mono">{formatPhoneNumber(conversation.externalNumber)}</h1>
                      <button
                        onClick={handleAddContact}
                        className="text-slate-400 hover:text-teal-600 transition-colors"
                        title="Add to contacts"
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-sm text-muted-foreground">Unknown contact</p>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Agent Info */}
          {(conversation.agent || conversation.agentName) && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {agentAvatar ? (
                  <Image
                    src={agentAvatar}
                    alt={conversation.agent?.name || conversation.agentName || 'Deleted Agent'}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Bot className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="text-sm">
                <p className="font-medium text-slate-600">{conversation.agent?.name || conversation.agentName || 'Deleted Agent'}</p>
                <p className="text-xs text-muted-foreground">Agent</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pb-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={loadMore}
                className="text-teal-600 border-teal-600 hover:bg-teal-50"
              >
                Load earlier messages
              </Button>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, index) => {
            const isOutbound = msg.direction === 'OUTBOUND';
            const showDateHeader = index === 0 || !isSameDay(messages[index - 1].createdAt, msg.createdAt);

            return (
              <div key={msg.id}>
                {/* Date Header */}
                {showDateHeader && (
                  <div className="flex justify-center my-4">
                    <span className="px-3 py-1 bg-slate-100 rounded-full text-xs text-muted-foreground">
                      {formatDateHeader(msg.createdAt)}
                    </span>
                  </div>
                )}

                {/* Message Bubble */}
                <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] ${isOutbound ? 'order-1' : 'order-2'}`}>
                    {/* Sender indicator */}
                    <div className={`flex items-center gap-1 mb-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                      {isOutbound ? (
                        <>
                          <span className="text-xs text-muted-foreground">
                            {msg.aiGenerated ? (msg.agentName || conversation.agent?.name || conversation.agentName || 'Agent') : 'You'}
                          </span>
                          <ArrowUpRight className="h-3 w-3 text-teal-500" />
                        </>
                      ) : (
                        <>
                          <ArrowDownLeft className="h-3 w-3 text-slate-400" />
                          <span className="text-xs text-muted-foreground">
                            {contact?.name || formatPhoneNumber(conversation.externalNumber)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Message Content */}
                    <div className={`rounded-2xl px-4 py-2 ${
                      isOutbound 
                        ? 'bg-teal-600 text-white rounded-br-md' 
                        : 'bg-slate-100 text-slate-800 rounded-bl-md'
                    }`}>
                      {/* Media attachments */}
                      {msg.numMedia > 0 && msg.mediaUrls.length > 0 && (
                        <div className="space-y-2 mb-2">
                          {msg.mediaUrls.map((url, i) => {
                            const mimeType = msg.mediaTypes[i] || '';
                            if (mimeType.startsWith('image/')) {
                              return (
                                <a 
                                  key={i} 
                                  href={url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="block"
                                >
                                  <img 
                                    src={url} 
                                    alt="Media" 
                                    className="rounded-lg max-w-full max-h-48 object-cover"
                                  />
                                </a>
                              );
                            } else {
                              return (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                                    isOutbound ? 'bg-teal-700' : 'bg-slate-200'
                                  }`}
                                >
                                  {getMediaIcon(mimeType)}
                                  <span className="text-sm truncate">Attachment</span>
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                </a>
                              );
                            }
                          })}
                        </div>
                      )}

                      {/* Message body */}
                      {msg.body && (
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                      )}

                      {/* Placeholder for media-only messages */}
                      {!msg.body && msg.numMedia > 0 && msg.mediaUrls.length === 0 && (
                        <p className={`text-sm italic ${isOutbound ? 'text-teal-200' : 'text-slate-400'}`}>
                          Media attachment
                        </p>
                      )}
                    </div>

                    {/* Time & Status */}
                    <div className={`flex items-center gap-1 mt-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(msg.createdAt)}
                      </span>
                      {isOutbound && (
                        <span className={`flex items-center gap-0.5 ${getStatusColor(msg.status)}`}>
                          {getStatusIcon(msg.status)}
                        </span>
                      )}
                    </div>

                    {/* Error message */}
                    {msg.errorMessage && (
                      <p className="text-xs text-red-500 mt-1">
                        {msg.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">No messages yet</h3>
              <p className="text-sm text-muted-foreground">
                Messages in this conversation will appear here.
              </p>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </CardContent>
      </Card>

      {/* Conversation Info Footer */}
      <div className="flex-shrink-0 pt-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </span>
          <span>
            Started {formatDate(conversation.createdAt)}
          </span>
        </div>
      </div>

      {/* Add Contact Modal */}
      <ContactModal
        open={addContactModalOpen}
        onClose={() => setAddContactModalOpen(false)}
        onSave={handleSaveContact}
        initialPhoneNumber={conversation.externalNumber}
      />
    </div>
  );
}
