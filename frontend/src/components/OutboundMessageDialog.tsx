'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { AssetManager, Asset } from '@/components/AssetManager';
import { hasAnyMediaToolEnabled, getEnabledMediaTools, ASSET_CATEGORIES, AssetCategory, ELEVENLABS_VOICES } from '@/lib/constants';
import { MessageSquare, X, Loader2, Send, Image as ImageIcon, AlertCircle, Paperclip, ChevronDown, ChevronUp, Bot, Check } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  voice?: string;
  communicationChannel?: string;
  imageToolEnabled?: boolean;
  documentToolEnabled?: boolean;
  videoToolEnabled?: boolean;
}

interface OutboundMessageDialogProps {
  // Optional: if provided, use this agent directly (agent detail page mode)
  agentId?: string;
  agentName?: string;
  imageToolEnabled?: boolean;
  documentToolEnabled?: boolean;
  videoToolEnabled?: boolean;
  // Required
  onClose: () => void;
  onMessageSent?: (messageData: any) => void;
}

// Helper to get avatar for a voice
const getVoiceAvatar = (voiceId?: string): string | null => {
  if (!voiceId) return null;
  const voice = ELEVENLABS_VOICES.find(v => v.id === voiceId.toLowerCase());
  return voice?.avatar || null;
};

// Helper to check if agent supports messaging
const supportsMessaging = (channel?: string) => {
  return channel === 'MESSAGING_ONLY' || channel === 'OMNICHANNEL';
};

export function OutboundMessageDialog({ 
  agentId: initialAgentId, 
  agentName: initialAgentName, 
  imageToolEnabled: initialImageToolEnabled = false,
  documentToolEnabled: initialDocumentToolEnabled = false,
  videoToolEnabled: initialVideoToolEnabled = false,
  onClose, 
  onMessageSent 
}: OutboundMessageDialogProps) {
  const { toast } = useToast();
  
  // Agent selection state (for general mode)
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(!initialAgentId);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(
    initialAgentId ? {
      id: initialAgentId,
      name: initialAgentName || 'Agent',
      imageToolEnabled: initialImageToolEnabled,
      documentToolEnabled: initialDocumentToolEnabled,
      videoToolEnabled: initialVideoToolEnabled,
    } : null
  );
  
  // Message form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Determine which media capabilities are available for selected agent
  const imageToolEnabled = selectedAgent?.imageToolEnabled || false;
  const documentToolEnabled = selectedAgent?.documentToolEnabled || false;
  const videoToolEnabled = selectedAgent?.videoToolEnabled || false;
  const hasMediaTools = imageToolEnabled || documentToolEnabled || videoToolEnabled;
  
  // Get allowed categories based on enabled tools
  const allowedCategories: AssetCategory[] = [];
  if (imageToolEnabled) allowedCategories.push('IMAGE');
  if (documentToolEnabled) allowedCategories.push('DOCUMENT');
  if (videoToolEnabled) allowedCategories.push('VIDEO');

  // Use portal to render at document.body level
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch messaging-capable agents if no agent provided
  useEffect(() => {
    if (!initialAgentId) {
      fetchAgents();
    }
  }, [initialAgentId]);

  const fetchAgents = async () => {
    setLoadingAgents(true);
    try {
      const response = await api.getAgents();
      // Filter to only messaging-capable agents
      const messagingAgents = (response.data || []).filter((agent: Agent) => 
        supportsMessaging(agent.communicationChannel)
      );
      setAgents(messagingAgents);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoadingAgents(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    
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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const handleSend = async () => {
    if (!selectedAgent) {
      toast({
        title: 'Select an agent',
        description: 'Please select an agent to send the message',
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

    if (!message.trim()) {
      toast({
        title: 'Message required',
        description: 'Please enter a message to send',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const formattedNumber = `+1${digits}`;
      const mediaUrls = mediaUrl.trim() ? [mediaUrl.trim()] : undefined;
      const assetIds = selectedAssetIds.length > 0 ? selectedAssetIds : undefined;
      
      const response = await api.sendMessage(selectedAgent.id, formattedNumber, message, mediaUrls, assetIds);
      
      const hasMedia = (mediaUrls && mediaUrls.length > 0) || (assetIds && assetIds.length > 0);
      
      toast({
        title: '📨 Message Sent',
        description: `${hasMedia ? 'MMS' : 'SMS'} sent to ${phoneNumber}`,
      });
      
      if (onMessageSent) {
        onMessageSent(response.data);
      }
      
      onClose();
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : 'Failed to send message';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const digits = phoneNumber.replace(/\D/g, '');
  const characterCount = message.length;
  const segmentCount = Math.ceil(characterCount / 160) || 1;

  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-slate-600" />
              <CardTitle className="text-slate-600">Send Message</CardTitle>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Send a text message {selectedAgent && <>as <span className="font-medium text-slate-600">{selectedAgent.name}</span></>}
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
                      <p className="font-medium">No messaging agents</p>
                      <p className="mt-0.5 text-xs">Create an agent with Messaging or Omnichannel channel.</p>
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
                            {selectedAgent.communicationChannel === 'OMNICHANNEL' ? 'Omnichannel' : 'Messaging'}
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
                                {agent.communicationChannel === 'OMNICHANNEL' ? 'Omnichannel' : 'Messaging'}
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

          {/* Phone Number Input */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-muted-foreground">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={phoneNumber}
              onChange={handlePhoneChange}
              className="text-lg"
              disabled={!initialAgentId && !selectedAgent}
            />
          </div>

          {/* Message Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="message" className="text-muted-foreground">Message</Label>
              <span className={`text-xs ${characterCount > 160 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                {characterCount}/160 {segmentCount > 1 && `(${segmentCount} segments)`}
              </span>
            </div>
            <textarea
              id="message"
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full min-h-[100px] p-3 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-muted-foreground"
              maxLength={1600}
              disabled={!initialAgentId && !selectedAgent}
            />
          </div>

          {/* MMS Media Options */}
          {selectedAgent && hasMediaTools && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowMediaOptions(!showMediaOptions)}
                className="flex items-center justify-between w-full text-sm text-teal-600 hover:text-teal-700 py-1"
              >
                <span className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attach media {(selectedAssetIds.length > 0 || mediaUrl.trim()) && (
                    <span className="bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded text-xs">
                      {selectedAssetIds.length + (mediaUrl.trim() ? 1 : 0)} attached
                    </span>
                  )}
                </span>
                {showMediaOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              
              {showMediaOptions && (
                <div className="space-y-3 p-3 bg-slate-50 rounded-md border">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Select from your assets</Label>
                    <AssetManager
                      mode="select"
                      allowedCategories={allowedCategories}
                      agentId={selectedAgent.id}
                      selectedAssetIds={selectedAssetIds}
                      onSelectionChange={setSelectedAssetIds}
                    />
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-slate-50 px-2 text-muted-foreground">or enter URL</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Input
                      type="url"
                      placeholder="https://example.com/file.pdf"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      className="text-sm h-8"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter a publicly accessible URL to any{' '}
                      {allowedCategories.map(c => ASSET_CATEGORIES[c].label.toLowerCase()).join(', ')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Character limit warning */}
          {characterCount > 160 && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Messages over 160 characters are split into multiple segments, which may increase costs.
              </p>
            </div>
          )}

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={loading || !selectedAgent || digits.length < 10 || !message.trim()}
            className="w-full bg-teal-600 hover:bg-teal-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send {(selectedAssetIds.length > 0 || mediaUrl.trim()) ? 'MMS' : 'SMS'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return createPortal(modalContent, document.body);
}
