'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Phone, RefreshCw, Settings, Trash2, ChevronDown, Bot, Contact } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES } from '@/lib/constants';

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  twilioSid?: string;
  friendlyName?: string;
  isActive: boolean;
  agent?: { id: string; name: string; voice?: string } | null;
  createdAt: string;
}

interface TwilioNumber {
  phoneNumber: string;
  sid: string;
  friendlyName: string;
  capabilities: any;
  alreadyAdded: boolean;
}

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

// Custom Agent Selector with avatars
function AgentSelector({
  agents,
  selectedAgentId,
  onSelect,
  disabled,
}: {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelect: (agentId: string) => void;
  disabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const selectedAvatar = selectedAgent ? getVoiceAvatar(selectedAgent.voice) : null;

  // Close dropdown when clicking outside
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
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-3 px-3 py-2.5 text-sm border rounded-md bg-white disabled:opacity-50 min-w-[180px] justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {selectedAgent ? (
            <>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {selectedAvatar ? (
                  <Image
                    src={selectedAvatar}
                    alt={selectedAgent.name}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Bot className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <span className="truncate font-medium">{selectedAgent.name}</span>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Bot className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-muted-foreground">No agent</span>
            </>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] bg-white border rounded-md shadow-lg py-1 max-h-60 overflow-auto right-0 sm:right-auto">
          <button
            type="button"
            onClick={() => {
              onSelect('');
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Bot className="h-5 w-5 text-muted-foreground" />
            </div>
            <span className="text-muted-foreground">No agent</span>
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 text-left ${
                  agent.id === selectedAgentId ? 'bg-blue-50' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {avatar ? (
                    <Image
                      src={avatar}
                      alt={agent.name}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Bot className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <span className="truncate font-medium">{agent.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PhoneNumbersPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [twilioConfigured, setTwilioConfigured] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [twilioNumbers, setTwilioNumbers] = useState<TwilioNumber[]>([]);
  const [loadingTwilio, setLoadingTwilio] = useState(false);
  const [addingNumber, setAddingNumber] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [updatingNumber, setUpdatingNumber] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, numbersRes, agentsRes] = await Promise.all([
        api.getTwilioSettings(),
        api.getPhoneNumbers(),
        api.getAgents(),
      ]);

      setTwilioConfigured(settingsRes.data?.configured || false);
      setPhoneNumbers(numbersRes.data || []);
      setAgents(agentsRes.data || []);

      // If Twilio is configured, fetch available numbers
      if (settingsRes.data?.configured) {
        fetchTwilioNumbers();
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTwilioNumbers = async () => {
    setLoadingTwilio(true);
    try {
      const response = await api.getTwilioPhoneNumbers();
      setTwilioNumbers(response.data || []);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to fetch Twilio numbers';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoadingTwilio(false);
    }
  };

  const handleAddNumber = async (twilioNumber: TwilioNumber) => {
    setAddingNumber(twilioNumber.phoneNumber);
    try {
      await api.addPhoneNumber({
        phoneNumber: twilioNumber.phoneNumber,
        twilioSid: twilioNumber.sid,
        friendlyName: twilioNumber.friendlyName,
      });

      toast({
        title: 'Phone number added',
        description: `${twilioNumber.phoneNumber} has been added.`,
      });

      // Refresh data
      fetchData();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to add phone number';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setAddingNumber(null);
    }
  };

  const handleAssignAgent = async (numberId: string, agentId: string) => {
    setUpdatingNumber(numberId);
    
    // Optimistic update
    const selectedAgentObj = agents.find(a => a.id === agentId);
    setPhoneNumbers(prev => prev.map(num => 
      num.id === numberId 
        ? { ...num, agent: agentId ? selectedAgentObj : null }
        : num
    ));
    
    try {
      await api.updatePhoneNumber(numberId, {
        agentId: agentId || null,
      });

      toast({
        title: 'Agent assigned',
        description: 'Phone number updated successfully.',
      });

      // Refresh to confirm
      await fetchData();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to assign agent';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      // Revert optimistic update on error
      await fetchData();
    } finally {
      setUpdatingNumber(null);
    }
  };

  const handleDeleteNumber = async (id: string) => {
    if (!confirm('Are you sure you want to remove this phone number?')) return;

    try {
      await api.deletePhoneNumber(id);
      toast({
        title: 'Phone number removed',
        description: 'The phone number has been removed.',
      });
      fetchData();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to remove phone number';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const formatPhoneNumber = (phone: string) => {
    // Format as (XXX) XXX-XXXX for US numbers
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show setup prompt if Twilio not configured
  if (!twilioConfigured) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Contact className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-600">Phone Numbers</h1>
          <span className="hidden sm:inline text-slate-400">•</span>
          <p className="text-muted-foreground text-sm sm:text-base w-full sm:w-auto">Manage your Twilio phone numbers</p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Settings className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">Twilio Not Configured</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              You need to connect your Twilio account before you can manage phone numbers.
            </p>
            <Link href="/dashboard/settings">
              <Button>
                <Settings className="h-4 w-4 mr-2" />
                Configure Twilio
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Contact className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-600">Phone Numbers</h1>
          <span className="hidden sm:inline text-slate-400">•</span>
          <p className="text-muted-foreground text-sm sm:text-base w-full sm:w-auto">Manage your Twilio phone numbers</p>
        </div>
        <Button onClick={fetchTwilioNumbers} disabled={loadingTwilio} className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700">
          <RefreshCw className={`h-4 w-4 mr-2 ${loadingTwilio ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Phone Numbers Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-slate-600">Twilio</CardTitle>
          {/* <CardDescription>
            Phone numbers from your Twilio account connected to AI agents
          </CardDescription> */}
        </CardHeader>
        <CardContent>
          {loadingTwilio && phoneNumbers.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : phoneNumbers.length === 0 ? (
            <div className="text-center py-8">
              <Phone className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="font-semibold text-slate-600 mb-2">No phone numbers added yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Purchase a phone number in your Twilio Console to get started
              </p>
              <a
                href="https://console.twilio.com/us1/develop/phone-numbers/manage/incoming"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-blue-600 hover:underline"
              >
                Open Twilio Console →
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {phoneNumbers.map((number) => (
                <div
                  key={number.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border gap-4"
                >
                  {/* Phone Info */}
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <Phone className="h-5 w-5 text-teal-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono font-medium text-sm sm:text-base text-slate-600">
                        {formatPhoneNumber(number.phoneNumber)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          Twilio
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 sm:gap-3 ml-13 sm:ml-0">
                    <AgentSelector
                      agents={agents}
                      selectedAgentId={number.agent?.id || null}
                      onSelect={(agentId) => handleAssignAgent(number.id, agentId)}
                      disabled={updatingNumber === number.id || agents.length === 0}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteNumber(number.id)}
                      className="flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help text */}
      {phoneNumbers.length > 0 && (
        <p className="text-xs sm:text-sm text-muted-foreground text-center">
          Need more numbers?{' '}
          <a
            href="https://console.twilio.com/us1/develop/phone-numbers/manage/incoming"
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-600 hover:underline"
          >
            Purchase in Twilio Console
          </a>
          {' '}then refresh to see them here.
        </p>
      )}
    </div>
  );
}

