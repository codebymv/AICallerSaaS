'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Flag, ArrowLeft, ArrowRight, Bot, User, ChevronDown, Check, Calendar, Clock, Loader2, AlertCircle, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CsvUploadZone } from '@/components/CsvUploadZone';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES } from '@/lib/constants';

interface FormData {
  name: string;
  description: string;
  agentId: string;
  leads: any[];
  startDate: string;
  endDate: string;
  callWindowStart: string;
  callWindowEnd: string;
  dailyCallLimit: number;
  callsPerHour: number | null;
  minCallInterval: number;
  maxRetryAttempts: number;
  retryInterval: number;
}

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

export default function NewCampaignPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const agentDropdownRef = useRef<HTMLDivElement>(null);
  const [csvData, setCsvData] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    agentId: '',
    leads: [],
    startDate: '',
    endDate: '',
    callWindowStart: '09:00',
    callWindowEnd: '17:00',
    dailyCallLimit: 100,
    callsPerHour: null,
    minCallInterval: 30,
    maxRetryAttempts: 3,
    retryInterval: 3600,
  });

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    if (!showAgentDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(event.target as Node)) {
        setShowAgentDropdown(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAgentDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAgentDropdown]);

  const fetchAgents = async () => {
    setLoadingAgents(true);
    try {
      const response = await api.getAgents();
      // Filter to outbound/hybrid agents only
      const outboundAgents = (response.data || []).filter((agent: any) => 
        agent.mode === 'OUTBOUND' || agent.mode === 'HYBRID'
      );
      setAgents(outboundAgents);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoadingAgents(false);
    }
  };

  const selectedAgent = agents.find(a => a.id === formData.agentId);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Campaign name is required', variant: 'destructive' });
      return;
    }

    if (!formData.agentId) {
      toast({ title: 'Error', description: 'Please select an agent', variant: 'destructive' });
      return;
    }

    if (formData.leads.length === 0) {
      toast({ title: 'Error', description: 'Please upload leads', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Create campaign
      const campaignResponse = await api.createCampaign({
        name: formData.name,
        description: formData.description || undefined,
        agentId: formData.agentId,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
        callWindowStart: formData.callWindowStart,
        callWindowEnd: formData.callWindowEnd,
        dailyCallLimit: formData.dailyCallLimit,
        callsPerHour: formData.callsPerHour || undefined,
        minCallInterval: formData.minCallInterval,
        maxRetryAttempts: formData.maxRetryAttempts,
        retryInterval: formData.retryInterval,
      });

      const campaignId = campaignResponse.data.id;

      // Upload leads
      if (csvData) {
        await api.uploadCampaignLeadsCSV(campaignId, csvData);
      }

      toast({ title: 'Campaign created!', description: `${formData.name} is ready to launch.` });
      router.push(`/dashboard/campaigns/${campaignId}`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to create campaign';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const canProceedToStep2 = formData.name.trim() && formData.agentId;
  const canProceedToStep3 = formData.leads.length > 0;
  const canProceedToStep4 = formData.callWindowStart && formData.callWindowEnd;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Flag className="h-8 w-8 text-slate-600" />
        <h1 className="text-3xl font-bold text-slate-600">Create Campaign</h1>
        <span className="hidden sm:inline text-slate-400">•</span>
        <p className="text-muted-foreground w-full sm:w-auto">Set up automated outbound calling</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {[1, 2, 3, 4].map((num) => (
          <div key={num} className="flex items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                num === step
                  ? 'bg-gradient-to-b from-[#0fa693] to-teal-600 text-white'
                  : num < step
                  ? 'bg-teal-100 text-teal-600'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {num < step ? <Check className="h-4 w-4" /> : num}
            </div>
            {num < 4 && (
              <div
                className={`flex-1 h-1 mx-2 transition-colors ${
                  num < step ? 'bg-teal-600' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Campaign Basics */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-600">Campaign Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Campaign Name */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Campaign Name *</Label>
              <Input
                placeholder="e.g., Holiday Promotion 2025"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Description</Label>
              <Textarea
                placeholder="Brief description of campaign goals..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Agent Selection */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Agent *</Label>
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
                      <p className="font-medium">No outbound agents</p>
                      <p className="mt-0.5 text-xs">Create an agent with Outbound or Hybrid mode first.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative" ref={agentDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                    className="w-full flex items-center gap-3 p-3 border rounded-md bg-white hover:bg-slate-50 transition-colors"
                  >
                    {selectedAgent ? (
                      <>
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {ELEVENLABS_VOICES.find(v => v.id === selectedAgent.voice)?.avatar ? (
                            <Image
                              src={ELEVENLABS_VOICES.find(v => v.id === selectedAgent.voice)!.avatar!}
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
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            {getModeIcon(selectedAgent.mode)}
                            {selectedAgent.mode === 'HYBRID' ? 'Hybrid' : selectedAgent.mode === 'INBOUND' ? 'Inbound' : 'Outbound'}
                          </span>
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
                    <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-64 overflow-y-auto">
                      {agents.map((agent) => {
                        const avatar = ELEVENLABS_VOICES.find(v => v.id === agent.voice)?.avatar;
                        const isSelected = formData.agentId === agent.id;
                        return (
                          <button
                            key={agent.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, agentId: agent.id });
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
                                <User className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <p className="font-medium text-slate-600 truncate text-sm">{agent.name}</p>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                {getModeIcon(agent.mode)}
                                {agent.mode === 'HYBRID' ? 'Hybrid' : agent.mode === 'INBOUND' ? 'Inbound' : 'Outbound'}
                              </span>
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

            <div className="flex items-center justify-between pt-4">
              <Link href="/dashboard/campaigns" passHref>
                <Button variant="ghost" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                  <ArrowLeft className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              </Link>
              <Button
                onClick={() => setStep(2)}
                disabled={!canProceedToStep2}
                className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Upload Leads */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-600">Upload Leads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CsvUploadZone
              onUpload={(data) => {
                setCsvData(data);
              }}
              onPreview={(leads) => {
                setFormData({ ...formData, leads });
              }}
            />

            {formData.leads.length > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <p className="text-sm text-green-700">
                    <span className="font-medium">{formData.leads.length} leads</span> will be imported
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <div>
                <Button variant="ghost" onClick={() => setStep(1)} className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                  <ArrowLeft className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              </div>
              <Button
                onClick={() => setStep(3)}
                disabled={!canProceedToStep3}
                className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Schedule & Pacing */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-600">Schedule & Pacing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Start Date (optional)</Label>
                <Input
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">End Date (optional)</Label>
                <Input
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            {/* Call Window */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Call Window</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Start Time</Label>
                  <Input
                    type="time"
                    value={formData.callWindowStart}
                    onChange={(e) => setFormData({ ...formData, callWindowStart: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">End Time</Label>
                  <Input
                    type="time"
                    value={formData.callWindowEnd}
                    onChange={(e) => setFormData({ ...formData, callWindowEnd: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Daily Call Limit */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Daily Call Limit</Label>
              <Input
                type="number"
                min="1"
                max="1000"
                value={formData.dailyCallLimit}
                onChange={(e) => setFormData({ ...formData, dailyCallLimit: parseInt(e.target.value) || 100 })}
              />
            </div>

            {/* Calls Per Hour */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Calls Per Hour (optional)</Label>
              <Input
                type="number"
                min="1"
                max="100"
                placeholder="No limit"
                value={formData.callsPerHour || ''}
                onChange={(e) => setFormData({ ...formData, callsPerHour: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>

            {/* Min Call Interval */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Seconds Between Calls</Label>
              <Input
                type="number"
                min="10"
                max="300"
                value={formData.minCallInterval}
                onChange={(e) => setFormData({ ...formData, minCallInterval: parseInt(e.target.value) || 30 })}
              />
            </div>

            {/* Retry Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Max Retry Attempts</Label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.maxRetryAttempts}
                  onChange={(e) => setFormData({ ...formData, maxRetryAttempts: parseInt(e.target.value) || 3 })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Retry Interval (seconds)</Label>
                <Input
                  type="number"
                  min="300"
                  max="86400"
                  value={formData.retryInterval}
                  onChange={(e) => setFormData({ ...formData, retryInterval: parseInt(e.target.value) || 3600 })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <Button variant="ghost" onClick={() => setStep(2)} className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                  <ArrowLeft className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              </div>
              <Button
                onClick={() => setStep(4)}
                disabled={!canProceedToStep4}
                className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700"
              >
                Review
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review & Create */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-600">Review Campaign</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Campaign Name</p>
                  <p className="font-medium text-slate-600">{formData.name}</p>
                </div>
                {formData.description && (
                  <div>
                    <p className="text-xs text-muted-foreground">Description</p>
                    <p className="text-sm text-slate-600">{formData.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Agent</p>
                  <p className="font-medium text-slate-600">{selectedAgent?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Leads</p>
                  <p className="font-medium text-slate-600">{formData.leads.length} leads</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Call Window</p>
                    <p className="text-sm text-slate-600">{formData.callWindowStart} - {formData.callWindowEnd}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Daily Limit</p>
                    <p className="text-sm text-slate-600">{formData.dailyCallLimit} calls/day</p>
                  </div>
                </div>
                {formData.callsPerHour && (
                  <div>
                    <p className="text-xs text-muted-foreground">Rate Limit</p>
                    <p className="text-sm text-slate-600">{formData.callsPerHour} calls/hour</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Retry Settings</p>
                  <p className="text-sm text-slate-600">
                    {formData.maxRetryAttempts} attempts, {Math.round(formData.retryInterval / 60)} min interval
                  </p>
                </div>
              </div>

              {/* Estimated Completion */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">Estimated completion:</span> This campaign will be created as a draft. 
                  You can start it from the campaign detail page.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <Button variant="ghost" onClick={() => setStep(3)} className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                  <ArrowLeft className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Campaign
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

