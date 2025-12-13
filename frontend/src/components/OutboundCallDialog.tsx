'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES } from '@/lib/constants';
import { PhoneCall, X, Loader2, Delete, Bot, ChevronDown, Check, AlertCircle } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  voice?: string;
  communicationChannel?: string;
  callWindowStart?: string;
  callWindowEnd?: string;
}

interface OutboundCallDialogProps {
  // Optional: if provided, use this agent directly (agent detail page mode)
  agentId?: string;
  agentName?: string;
  callWindow?: { start?: string; end?: string };
  // Required
  onClose: () => void;
  onCallInitiated?: (callData: any) => void;
}

// Helper to get avatar for a voice
const getVoiceAvatar = (voiceId?: string): string | null => {
  if (!voiceId) return null;
  const voice = ELEVENLABS_VOICES.find(v => v.id === voiceId.toLowerCase());
  return voice?.avatar || null;
};

// Helper to check if agent supports voice calls
const supportsVoice = (channel?: string) => {
  return channel === 'VOICE_ONLY' || channel === 'OMNICHANNEL' || !channel;
};

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

export function OutboundCallDialog({ 
  agentId: initialAgentId, 
  agentName: initialAgentName, 
  callWindow: initialCallWindow,
  onClose, 
  onCallInitiated 
}: OutboundCallDialogProps) {
  const { toast } = useToast();
  
  // Agent selection state (for general mode)
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(!initialAgentId);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(
    initialAgentId ? {
      id: initialAgentId,
      name: initialAgentName || 'Agent',
      callWindowStart: initialCallWindow?.start,
      callWindowEnd: initialCallWindow?.end,
    } : null
  );
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Get call window from selected agent
  const callWindow = selectedAgent ? {
    start: selectedAgent.callWindowStart,
    end: selectedAgent.callWindowEnd,
  } : undefined;

  // Use portal to render at document.body level (avoids z-index stacking context issues)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch voice-capable agents if no agent provided
  useEffect(() => {
    if (!initialAgentId) {
      fetchAgents();
    }
  }, [initialAgentId]);

  const fetchAgents = async () => {
    setLoadingAgents(true);
    try {
      const response = await api.getAgents();
      // Filter to only voice-capable agents
      const voiceAgents = (response.data || []).filter((agent: Agent) => 
        supportsVoice(agent.communicationChannel)
      );
      setAgents(voiceAgents);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoadingAgents(false);
    }
  };

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
    if (!callWindow?.start || !callWindow?.end) return true;
    
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return currentTime >= callWindow.start && currentTime <= callWindow.end;
  };

  const handleCall = async () => {
    if (!selectedAgent) {
      toast({
        title: 'Select an agent',
        description: 'Please select an agent to make the call',
        variant: 'destructive',
      });
      return;
    }

    const digits = phoneNumber.replace(/\D/g, '');
    
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
        description: `Calls can only be made between ${callWindow?.start} and ${callWindow?.end}`,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const formattedNumber = `+1${digits}`;
      const response = await api.makeOutboundCall(selectedAgent.id, formattedNumber);
      
      toast({
        title: '📱 Dialing...',
        description: `Calling ${phoneNumber}`,
      });
      
      if (onCallInitiated) {
        onCallInitiated(response.data);
      }
      
      onClose();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to initiate call';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const digits = phoneNumber.replace(/\D/g, '');

  // Don't render until mounted (for SSR compatibility with portal)
  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-slate-600" />
              <CardTitle className="text-slate-600">Make Call</CardTitle>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Place a call {selectedAgent && <>using <span className="font-medium text-slate-600">{selectedAgent.name}</span></>}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Agent Selector Dropdown (only shown if no agent was pre-selected) */}
          {!initialAgentId && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Agent</Label>
              {loadingAgents ? (
                <div className="flex items-center gap-2 p-3 border rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                  <span className="text-sm text-muted-foreground">Loading agents...</span>
                </div>
              ) : agents.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-700">
                      <p className="font-medium">No voice agents</p>
                      <p className="mt-0.5 text-xs">Create an agent with Voice or Omnichannel channel.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                    className="w-full flex items-center gap-3 p-3 border rounded-md bg-white hover:bg-slate-50 transition-colors"
                  >
                    {selectedAgent ? (
                      <>
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {getVoiceAvatar(selectedAgent.voice) ? (
                            <Image
                              src={getVoiceAvatar(selectedAgent.voice)!}
                              alt={selectedAgent.name}
                              width={32}
                              height={32}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Bot className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium text-slate-600 truncate text-sm">{selectedAgent.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedAgent.communicationChannel === 'OMNICHANNEL' ? 'Omnichannel' : 'Voice'}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="text-sm text-muted-foreground">Select an agent...</span>
                      </>
                    )}
                    <ChevronDown className={`h-4 w-4 text-muted-foreground ml-auto transition-transform ${showAgentDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showAgentDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {agents.map((agent) => {
                        const avatar = getVoiceAvatar(agent.voice);
                        const isSelected = selectedAgent?.id === agent.id;
                        return (
                          <button
                            key={agent.id}
                            type="button"
                            onClick={() => {
                              setSelectedAgent(agent);
                              setShowAgentDropdown(false);
                            }}
                            className={`w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors ${
                              isSelected ? 'bg-teal-50' : ''
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
                            <div className="flex-1 text-left min-w-0">
                              <p className="font-medium text-slate-600 truncate text-sm">{agent.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {agent.communicationChannel === 'OMNICHANNEL' ? 'Omnichannel' : 'Voice'}
                              </p>
                            </div>
                            {isSelected && (
                              <Check className="h-4 w-4 text-teal-600 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Phone Number Display with Backspace */}
          <div className="relative py-4">
            <div className="h-10 flex items-center justify-center">
              {phoneNumber ? (
                <span className="text-2xl font-semibold text-slate-700 tracking-wide">
                  {phoneNumber}
                </span>
              ) : (
                <span className="text-2xl text-slate-300">
                  (___) ___-____
                </span>
              )}
            </div>
            {/* Backspace button - absolutely positioned to the right of phone number */}
            {phoneNumber && (
              <button
                type="button"
                onClick={handleBackspace}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 transition-colors"
                disabled={loading || (!initialAgentId && !selectedAgent)}
              >
                <Delete className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* Dialpad */}
          <div className="grid grid-cols-3 gap-3">
            {dialpadKeys.map((key) => (
              <button
                key={key.digit}
                type="button"
                onClick={() => handleDialpadPress(key.digit)}
                className="flex flex-col items-center justify-center h-16 rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || (!initialAgentId && !selectedAgent)}
              >
                <span className="text-xl font-semibold text-slate-700">{key.digit}</span>
                {key.letters && (
                  <span className="text-[10px] text-slate-400 tracking-widest">{key.letters}</span>
                )}
              </button>
            ))}
          </div>

          {/* Call Window Warning */}
          {callWindow?.start && callWindow?.end && !isWithinCallWindow() && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700">
                ⚠️ Outside call window ({callWindow.start} - {callWindow.end})
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 text-slate-600"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCall}
              className="flex-1 bg-teal-600 hover:bg-teal-700"
              disabled={loading || !selectedAgent || digits.length < 10}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calling...
                </>
              ) : (
                <>
                  <PhoneCall className="h-4 w-4 mr-2" />
                  Call Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Render via portal to escape any stacking context
  return createPortal(modalContent, document.body);
}


