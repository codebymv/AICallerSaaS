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
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES, STATUS_COLORS, DIRECTION_COLORS } from '@/lib/constants';

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

  const fetchCall = async () => {
    try {
      const response = await api.getCall(callId);
      setCall(response.data);
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
            <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
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
            <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Call Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-slate-600">Call Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Direction & Numbers */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
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
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-slate-600">{formatPhoneNumber(call.from)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono text-slate-600">{formatPhoneNumber(call.to)}</span>
                </div>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-slate-600">AI Agent</CardTitle>
          </CardHeader>
          <CardContent>
            {(displayName || call.agent) ? (
              <div className="flex items-center gap-4">
                {agentAvatar ? (
                  <Image
                    src={agentAvatar}
                    alt={displayName || 'Agent'}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-slate-600">{displayName}</p>
                  {displayVoice && (
                    <p className="text-sm text-muted-foreground capitalize">
                      Voice: {displayVoice}
                    </p>
                  )}
                </div>
                {call.agent && (
                  <Link href={`/dashboard/agents/${call.agent.id}`} className="ml-auto">
                    <Button variant="outline" size="sm" className="text-teal-600 border-teal-600 hover:bg-teal-50">
                      View Agent
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4 text-muted-foreground">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <Bot className="h-6 w-6" />
                </div>
                <p>Agent information unavailable</p>
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
                          : 'bg-blue-100 text-blue-900'
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

      {/* Recording Card */}
      {call.recordingUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-slate-600">Recording</CardTitle>
          </CardHeader>
          <CardContent>
            <audio controls className="w-full">
              <source src={call.recordingUrl} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
