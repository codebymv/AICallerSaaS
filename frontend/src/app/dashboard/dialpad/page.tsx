'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES } from '@/lib/constants';
import { Phone, PhoneCall, Delete, Loader2, Bot, ChevronDown, Hash, Plus, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  voice?: string;
  mode: string;
  callWindowStart?: string;
  callWindowEnd?: string;
  isActive: boolean;
}

const dialpadKeys = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

// Get avatar for a voice
const getVoiceAvatar = (voiceId?: string): string | null => {
  if (!voiceId) return null;
  const voice = ELEVENLABS_VOICES.find(v => v.id === voiceId.toLowerCase());
  return voice?.avatar || null;
};

const getModeIcon = (mode: string) => {
  switch (mode) {
    case 'INBOUND':
      return <ArrowDownLeft className="h-3 w-3" />;
    case 'OUTBOUND':
      return <ArrowUpRight className="h-3 w-3" />;
    case 'HYBRID':
      return <ArrowLeftRight className="h-3 w-3" />;
    default:
      return null;
  }
};

export default function DialpadPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  // State
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const agentDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch outbound-capable agents
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await api.getAgents();
        const allAgents = response.data || [];
        // Filter to only outbound/hybrid agents that are active
        const outboundAgents = allAgents.filter(
          (a: Agent) => (a.mode === 'OUTBOUND' || a.mode === 'HYBRID') && a.isActive
        );
        setAgents(outboundAgents);
        // Auto-select first agent if available
        if (outboundAgents.length > 0) {
          setSelectedAgentId(outboundAgents[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch agents:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  // Handle click outside for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(event.target as Node)) {
        setAgentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  const formatPhoneNumber = (digits: string) => {
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else if (digits.length <= 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const handleDialpadPress = (digit: string) => {
    const currentDigits = phoneNumber.replace(/\D/g, '');
    if (currentDigits.length < 10) {
      const newDigits = currentDigits + digit;
      setPhoneNumber(formatPhoneNumber(newDigits));
    }
  };

  const handleBackspace = () => {
    const currentDigits = phoneNumber.replace(/\D/g, '');
    const newDigits = currentDigits.slice(0, -1);
    setPhoneNumber(formatPhoneNumber(newDigits));
  };

  const isWithinCallWindow = () => {
    if (!selectedAgent?.callWindowStart || !selectedAgent?.callWindowEnd) return true;
    
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return currentTime >= selectedAgent.callWindowStart && currentTime <= selectedAgent.callWindowEnd;
  };

  const handleCall = async () => {
    const digits = phoneNumber.replace(/\D/g, '');
    
    if (!selectedAgentId) {
      toast({
        title: 'No agent selected',
        description: 'Please select an agent to make the call',
        variant: 'destructive',
      });
      return;
    }

    if (digits.length < 10) {
      toast({
        title: 'Invalid phone number',
        description: 'Please enter a valid 10-digit phone number',
        variant: 'destructive',
      });
      return;
    }

    if (!isWithinCallWindow()) {
      toast({
        title: 'Outside call window',
        description: `Calls can only be made between ${selectedAgent?.callWindowStart} and ${selectedAgent?.callWindowEnd}`,
        variant: 'destructive',
      });
      return;
    }

    setCalling(true);
    try {
      const formattedNumber = `+1${digits}`;
      const response = await api.makeOutboundCall(selectedAgentId, formattedNumber);
      
      toast({
        title: 'Call initiated!',
        description: `Calling ${phoneNumber}...`,
      });
      
      // Optionally redirect to calls page or the specific call
      // router.push(`/dashboard/calls/${response.data?.callId}`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to initiate call';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setCalling(false);
    }
  };

  const digits = phoneNumber.replace(/\D/g, '');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // No outbound agents available
  if (agents.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Hash className="h-8 w-8 text-slate-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-600">Dialpad</h1>
            <p className="text-muted-foreground">Make outbound calls with your AI agents</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                <Bot className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-600 mb-2">No Outbound Agents</h3>
              <p className="text-muted-foreground mb-6">
                You need at least one active agent with Outbound or Hybrid mode to make calls.
              </p>
              <Link href="/dashboard/agents/new">
                <Button className="bg-teal-600 hover:bg-teal-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create an Agent
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Hash className="h-8 w-8 text-slate-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-600">Dialpad</h1>
          <p className="text-muted-foreground">Make outbound calls with your AI agents</p>
        </div>
      </div>

      <div className="flex justify-center">
        <Card className="max-w-md w-full">
        <CardContent className="pt-6 space-y-6">
          {/* Agent Selector */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Select Agent</Label>
            <div className="relative" ref={agentDropdownRef}>
              <button
                type="button"
                onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
                className="flex items-center gap-3 px-3 py-2.5 text-sm border rounded-md bg-background w-full justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {selectedAgent ? (
                    <>
                      <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {getVoiceAvatar(selectedAgent.voice) ? (
                          <Image
                            src={getVoiceAvatar(selectedAgent.voice)!}
                            alt={selectedAgent.name}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Bot className="h-5 w-5 text-teal-600" />
                        )}
                      </div>
                      <div className="text-left min-w-0">
                        <span className="font-medium text-slate-600 block truncate">{selectedAgent.name}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {getModeIcon(selectedAgent.mode)}
                          {selectedAgent.mode === 'HYBRID' ? 'Hybrid' : 'Outbound'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <span className="text-muted-foreground">Select an agent</span>
                    </>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${agentDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {agentDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg py-1 max-h-60 overflow-auto">
                  {agents.map((agent) => {
                    const avatar = getVoiceAvatar(agent.voice);
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => {
                          setSelectedAgentId(agent.id);
                          setAgentDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 text-left ${
                          agent.id === selectedAgentId ? 'bg-teal-50' : ''
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {avatar ? (
                            <Image
                              src={avatar}
                              alt={agent.name}
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Bot className="h-5 w-5 text-teal-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-slate-600 block truncate">{agent.name}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            {getModeIcon(agent.mode)}
                            {agent.mode === 'HYBRID' ? 'Hybrid' : 'Outbound'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Phone Number Display */}
          <div className="text-center py-4">
            <div className="h-12 flex items-center justify-center">
              {phoneNumber ? (
                <span className="text-3xl font-semibold text-slate-600 tracking-wide">
                  {phoneNumber}
                </span>
              ) : (
                <span className="text-3xl text-slate-300">
                  (___) ___-____
                </span>
              )}
            </div>
          </div>

          {/* Dialpad */}
          <div className="grid grid-cols-3 gap-3">
            {dialpadKeys.map((key) => (
              <button
                key={key.digit}
                type="button"
                onClick={() => handleDialpadPress(key.digit)}
                className="flex flex-col items-center justify-center h-16 rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition-colors"
                disabled={calling}
              >
                <span className="text-xl font-semibold text-slate-700">{key.digit}</span>
                {key.letters && (
                  <span className="text-[10px] text-slate-400 tracking-widest">{key.letters}</span>
                )}
              </button>
            ))}
          </div>

          {/* Backspace */}
          <div className="flex justify-end px-4">
            <button
              type="button"
              onClick={handleBackspace}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              disabled={!phoneNumber || calling}
            >
              <Delete className="h-6 w-6" />
            </button>
          </div>

          {/* Call Window Warning */}
          {selectedAgent?.callWindowStart && selectedAgent?.callWindowEnd && !isWithinCallWindow() && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700">
                ⚠️ Outside call window ({selectedAgent.callWindowStart} - {selectedAgent.callWindowEnd})
              </p>
            </div>
          )}

          {/* Call Button */}
          <Button
            type="button"
            onClick={handleCall}
            className="w-full h-14 text-lg bg-teal-600 hover:bg-teal-700"
            disabled={calling || digits.length < 10 || !selectedAgentId}
          >
            {calling ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Calling...
              </>
            ) : (
              <>
                <PhoneCall className="h-5 w-5 mr-2" />
                Call
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
