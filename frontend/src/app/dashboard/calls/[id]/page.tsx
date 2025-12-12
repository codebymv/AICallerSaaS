'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Phone,
  PhoneCall,
  ArrowLeft,
  Clock,
  Calendar,
  User,
  Bot,
  MessageSquare,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  UserPlus,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES, STATUS_COLORS, DIRECTION_COLORS, AGENT_MODES } from '@/lib/constants';
import { ContactModal } from '@/components/ContactModal';

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

interface Call {
  id: string;
  direction: 'inbound' | 'outbound';
  status: string;
  from?: string;
  to?: string;
  duration?: number;
  startTime?: string;
  endTime?: string;
  transcript?: any;
  summary?: string;
  sentiment?: string;
  recordingUrl?: string;
  costUsd?: number;
  // Agent snapshot (preserves agent config at time of call)
  agentName?: string;
  agentVoice?: string;
  agentVoiceProvider?: string;
  // Agent relation (current agent data)
  agent?: {
    id: string;
    name: string;
    voice?: string;
  };
  createdAt: string;
}

// Helper to get avatar for a voice
const getVoiceAvatar = (voiceId?: string): string | null => {
  if (!voiceId) return null;
  const voice = ELEVENLABS_VOICES.find(v => v.id === voiceId.toLowerCase());
  return voice?.avatar || null;
};

const formatDuration = (seconds: number): string => {
  if (!seconds || seconds === 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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

const formatPhoneNumber = (phone?: string): string => {
  if (!phone) return 'Unknown';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'in-progress':
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    case 'ringing':
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    default:
      return <AlertCircle className="h-5 w-5 text-slate-500" />;
  }
};

const getStatusColor = (status: string) => {
  return STATUS_COLORS[status] || STATUS_COLORS.default;
};

export default function CallDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [call, setCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<{ name: string; phoneNumber: string } | null>(null);
  const [addContactModalOpen, setAddContactModalOpen] = useState(false);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>('');
  const [fullAgent, setFullAgent] = useState<any>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

  const callId = params.id as string;

  // Prevent body scroll on this page (desktop only)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (callId) {
      fetchCall();
    }
  }, [callId]);

  // Fetch recording as blob and create blob URL for audio element
  useEffect(() => {
    if (!call?.recordingUrl) {
      setRecordingUrl(null);
      return;
    }

    let blobUrl: string | null = null;

    const fetchRecording = async () => {
      try {
        // Fetch recording with authentication using the API client
        const blob = await api.fetchBlob(`/api/calls/${callId}/recording`);
        blobUrl = URL.createObjectURL(blob);
        setRecordingUrl(blobUrl);
      } catch (error) {
        console.error('Failed to load recording:', error);
        setRecordingUrl(null);
      }
    };

    fetchRecording();

    // Cleanup: revoke blob URL when component unmounts or call changes
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [call?.recordingUrl, callId]);

  const fetchCall = async () => {
    try {
      const response = await api.getCall(callId);
      setCall(response.data);
      
      // Fetch contact for the relevant phone number
      const callData = response.data;
      if (callData) {
        const phone = callData.direction === 'inbound' ? callData.from : callData.to;
        try {
          const contactRes = await api.getContactByPhone(phone);
          if (contactRes.data) {
            setContact(contactRes.data);
          }
        } catch (e) {
          // Ignore contact fetch errors
        }

        // Fetch full agent details if agent exists
        if (callData.agent?.id) {
          try {
            const agentRes = await api.getAgent(callData.agent.id);
            if (agentRes.data) {
              setFullAgent(agentRes.data);
            }
          } catch (e) {
            // Ignore agent fetch errors
          }
        }
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to fetch call details';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      // Redirect back to calls list if call not found
      if (error instanceof ApiError && error.status === 404) {
        router.push('/dashboard/calls');
      }
    } finally {
      setLoading(false);
    }
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
      // Refresh contact
      if (call) {
        const phone = call.direction === 'inbound' ? call.from : call.to;
        if (phone) {
          try {
            const contactRes = await api.getContactByPhone(phone);
            if (contactRes.data) {
              setContact(contactRes.data);
            }
          } catch (e) {
            // Ignore
          }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/calls">
            {/* Mobile: icon-only */}
            <Button variant="ghost" size="icon" className="sm:hidden text-teal-600 hover:text-teal-700 hover:bg-teal-50">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {/* Desktop: icon + text */}
            <Button variant="ghost" size="sm" className="hidden sm:flex text-teal-600 hover:text-teal-700 hover:bg-teal-50">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Calls
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Phone className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">Call not found</h3>
            <p className="text-muted-foreground text-center">
              The call you're looking for doesn't exist or has been deleted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use snapshot data if available, fallback to live agent data for backwards compatibility
  const displayVoice = call.agentVoice || call.agent?.voice;
  const displayName = call.agentName || call.agent?.name;
  const agentAvatar = displayVoice ? getVoiceAvatar(displayVoice) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/calls">
            {/* Mobile: icon-only */}
            <Button variant="ghost" size="icon" className="sm:hidden text-teal-600 hover:text-teal-700 hover:bg-teal-50">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {/* Desktop: icon + text */}
            <Button variant="ghost" size="sm" className="hidden sm:flex text-teal-600 hover:text-teal-700 hover:bg-teal-50">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <PhoneCall className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600" />
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-600">Call Details</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              {formatDate(call.startTime || call.createdAt)}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor(call.status)}`}>
          {getStatusIcon(call.status)}
          {call.status.charAt(0).toUpperCase() + call.status.slice(1).replace('-', ' ')}
        </span>
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 w-full max-w-full">
        {/* Call Info Card */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg text-slate-600">Call Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Direction & Numbers */}
            <div className="flex items-center gap-3 p-3 sm:p-4 bg-slate-50 rounded-lg">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                call.direction === 'inbound' ? DIRECTION_COLORS.inbound.bg : DIRECTION_COLORS.outbound.bg
              }`}>
                {call.direction === 'inbound' ? (
                  <ArrowDownLeft className={`h-5 w-5 ${DIRECTION_COLORS.inbound.icon}`} />
                ) : (
                  <ArrowUpRight className={`h-5 w-5 ${DIRECTION_COLORS.outbound.icon}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">
                  {call.direction === 'inbound' ? 'Inbound Call' : 'Outbound Call'}
                </p>
                {contact ? (
                  <div>
                    <p className="font-medium text-slate-600">{contact.name}</p>
                    <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm flex-wrap">
                      <span className="font-mono text-muted-foreground">{formatPhoneNumber(call.from)}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono text-muted-foreground">{formatPhoneNumber(call.to)}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm flex-wrap">
                      <span className="font-mono text-slate-600">{formatPhoneNumber(call.from)}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono text-slate-600">{formatPhoneNumber(call.to)}</span>
                      <button
                        onClick={() => {
                          const phone = call.direction === 'inbound' ? call.from : call.to;
                          if (phone) handleAddContact(phone);
                        }}
                        className="text-slate-400 hover:text-teal-600 transition-colors"
                        title="Add to contacts"
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-medium text-slate-600">{formatDuration(call.duration || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="font-medium text-sm text-slate-600">
                  {new Date(call.startTime || call.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Cost if available */}
            {call.costUsd !== undefined && Number(call.costUsd) > 0 && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">Estimated Cost</p>
                <p className="font-medium text-slate-600">${Number(call.costUsd).toFixed(4)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agent Card */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg text-slate-600">AI Agent</CardTitle>
          </CardHeader>
          <CardContent>
            {(displayName || call.agent) ? (
              call.agent && fullAgent ? (
                <Link
                  href={`/dashboard/agents/${call.agent.id}`}
                  className="flex items-center p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {agentAvatar ? (
                          <Image
                            src={agentAvatar}
                            alt={displayName || 'Agent'}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-600 truncate">{displayName}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {fullAgent.totalCalls || 0} calls
                          {fullAgent.callPurpose && (
                            <>
                              <span className="mx-1.5">•</span>
                              {fullAgent.callPurpose}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-2 sm:ml-3">
                      <span
                        className={`px-2 py-1 text-xs rounded-full flex-shrink-0 ${
                          fullAgent.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {fullAgent.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {fullAgent.mode && AGENT_MODES[fullAgent.mode as keyof typeof AGENT_MODES] && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
                          <span className="w-5 h-5 rounded-full flex items-center justify-center bg-teal-100 flex-shrink-0">
                            {getModeIcon(fullAgent.mode)}
                          </span>
                          <span className="hidden sm:inline">{AGENT_MODES[fullAgent.mode as keyof typeof AGENT_MODES].label}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center p-3 rounded-lg border bg-slate-50">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {agentAvatar ? (
                        <Image
                          src={agentAvatar}
                          alt={displayName || 'Agent'}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-600 truncate">{displayName}</p>
                      {displayVoice && (
                        <p className="text-sm text-muted-foreground capitalize truncate">
                          Voice: {displayVoice}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-600 flex-shrink-0 ml-3">
                    Deleted
                  </span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-4 text-muted-foreground p-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <Bot className="h-5 w-5" />
                </div>
                <p className="text-sm">Agent information unavailable</p>
              </div>
            )}

            {/* Recording Audio Bar */}
            {call.recordingUrl && (
              <div className="mt-4 pt-4 border-t">
                {recordingUrl ? (
                  <audio controls className="w-full" key={recordingUrl}>
                    <source src={recordingUrl} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                ) : (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading recording...</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transcript Card */}
      {call.transcript && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-slate-600">Transcript</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
              {Array.isArray(call.transcript) ? (
                <div className="space-y-3">
                  {call.transcript.map((entry: any, index: number) => (
                    <div key={index} className={`flex gap-3 ${entry.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
                        entry.role === 'assistant' 
                          ? 'bg-white border' 
                          : 'bg-teal-100 text-teal-900'
                      }`}>
                        <p className="text-xs text-muted-foreground mb-1 capitalize">{entry.role || 'Unknown'}</p>
                        <p>{entry.content || entry.text || JSON.stringify(entry)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : typeof call.transcript === 'string' ? (
                <pre className="whitespace-pre-wrap text-sm font-mono">{call.transcript}</pre>
              ) : (
                <pre className="whitespace-pre-wrap text-sm font-mono">{JSON.stringify(call.transcript, null, 2)}</pre>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      {call.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-slate-600">Call Summary</CardTitle>
            {call.sentiment && (
              <CardDescription>
                Sentiment: <span className="capitalize">{call.sentiment}</span>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm">{call.summary}</p>
          </CardContent>
        </Card>
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
    </div>
  );
}
