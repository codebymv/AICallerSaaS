'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Flag, ArrowLeft, Edit, X, Save, Loader2, Trash2, Play, Pause, User, Bot, Phone, Clock, TrendingUp, Calendar as CalendarIcon, AlertCircle, CheckCircle2, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CampaignStatusBadge } from '@/components/CampaignStatusBadge';
import { DeleteButton } from '@/components/DeleteButton';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES } from '@/lib/constants';
import { formatPhoneNumber } from '@/lib/utils';

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
};

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast, dismiss } = useToast();

  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    callWindowStart: '',
    callWindowEnd: '',
    dailyCallLimit: 100,
    callsPerHour: null as number | null,
    minCallInterval: 30,
    maxRetryAttempts: 3,
    retryInterval: 3600,
  });

  // Leads pagination
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsHasMore, setLeadsHasMore] = useState(false);
  const [leadsFilter, setLeadsFilter] = useState('');

  useEffect(() => {
    if (campaignId) {
      fetchCampaign();
      fetchLeads();
    }
  }, [campaignId]);

  useEffect(() => {
    // Auto-refresh campaign data every 30 seconds if the campaign is active
    if (campaign?.status === 'ACTIVE' || campaign?.status === 'PENDING') {
      const interval = setInterval(() => {
        fetchCampaign();
        fetchLeads(1, leadsFilter);
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [campaign?.status, leadsFilter]);

  useEffect(() => {
    if (campaign) {
      setEditForm({
        name: campaign.name,
        description: campaign.description || '',
        callWindowStart: campaign.callWindowStart || '09:00',
        callWindowEnd: campaign.callWindowEnd || '17:00',
        dailyCallLimit: campaign.dailyCallLimit || 100,
        callsPerHour: campaign.callsPerHour,
        minCallInterval: campaign.minCallInterval || 30,
        maxRetryAttempts: campaign.maxRetryAttempts || 3,
        retryInterval: campaign.retryInterval || 3600,
      });
    }
  }, [campaign]);

  

  useEffect(() => {
    let isMounted = true;

    if (campaignId) {
      // Pass isMounted check to fetch functions if needed, or just rely on state updates
      // Since fetch functions are defined outside, we can't easily pass isMounted ref
      // So we'll define wrapper functions or check a ref
      fetchCampaign();
      fetchLeads(1, leadsFilter);
    }

    return () => {
      isMounted = false;
      // Dismiss all toasts when the component unmounts
      dismiss();
    };
  }, [campaignId, leadsFilter]);

  const fetchCampaign = async (signal?: AbortSignal) => {
    try {
      const response = await api.getCampaign(campaignId, signal);
      setCampaign(response.data);
    } catch (error: any) {
      if (error.name === 'AbortError' || (error instanceof ApiError && error.code === 'ABORT_ERROR')) {
        console.log('Campaign fetch aborted');
        return;
      }
      const message = error instanceof ApiError ? error.message : 'Failed to load campaign';
      toast({ title: 'Error', description: message, variant: 'destructive' });
      router.push('/dashboard/campaigns');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async (page = 1, filter = '', signal?: AbortSignal) => {
    setLoadingLeads(true);
    try {
      const response = await api.getCampaignLeads(campaignId, {
        page,
        limit: 20,
        status: filter || undefined,
      }, signal);
      
      if (page === 1) {
        setLeads(response.data || []);
      } else {
        setLeads(prev => [...prev, ...(response.data || [])]);
      }
      
      setLeadsHasMore(response.meta?.hasMore || false);
      setLeadsPage(page);
    } catch (error: any) {
      if (error.name === 'AbortError' || (error instanceof ApiError && error.code === 'ABORT_ERROR')) {
        console.log('Leads fetch aborted');
        return;
      }
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoadingLeads(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateCampaign(campaignId, editForm);
      toast({ title: 'Campaign updated', description: 'Your changes have been saved.' });
      setEditing(false);
      fetchCampaign();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to update campaign';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    // Reset form to current campaign data
    if (campaign) {
      setEditForm({
        name: campaign.name,
        description: campaign.description || '',
        callWindowStart: campaign.callWindowStart || '09:00',
        callWindowEnd: campaign.callWindowEnd || '17:00',
        dailyCallLimit: campaign.dailyCallLimit || 100,
        callsPerHour: campaign.callsPerHour,
        minCallInterval: campaign.minCallInterval || 30,
        maxRetryAttempts: campaign.maxRetryAttempts || 3,
        retryInterval: campaign.retryInterval || 3600,
      });
    }
  };

  const handleStart = async () => {
    setActionLoading('start');
    try {
      await api.startCampaign(campaignId);
      toast({ title: 'Campaign started', description: 'Calling leads now...' });
      fetchCampaign();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to start campaign';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePause = async () => {
    setActionLoading('pause');
    try {
      await api.pauseCampaign(campaignId);
      toast({ title: 'Campaign paused', description: 'Calling has been paused.' });
      fetchCampaign();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to pause campaign';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteCampaign(campaignId);
      toast({ title: 'Campaign deleted', description: 'Campaign has been removed.' });
      router.push('/dashboard/campaigns');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to delete campaign';
      toast({ title: 'Error', description: message, variant: 'destructive' });
      throw error;
    }
  };

  const handleSkipLead = async (leadId: string) => {
    try {
      await api.updateCampaignLead(campaignId, leadId, { status: 'SKIPPED' });
      toast({ title: 'Lead skipped' });
      fetchLeads(1, leadsFilter);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to skip lead', variant: 'destructive' });
    }
  };

  const handleConvertToContacts = async () => {
    setActionLoading('convert');
    try {
      const response = await api.convertSuccessfulLeadsToContacts(campaignId);
      toast({
        title: 'Leads converted',
        description: response.message || 'Successful leads have been added to contacts.',
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to convert leads';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/campaigns">
            <Button variant="ghost" size="icon" className="sm:hidden text-teal-600 hover:text-teal-700 hover:bg-teal-50">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard/campaigns">
            <Button variant="ghost" size="sm" className="hidden sm:flex text-teal-600 hover:text-teal-700 hover:bg-teal-50">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Campaigns
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-slate-600">Campaign not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progressPercent = campaign.totalLeads > 0
    ? Math.round((campaign.leadsContacted / campaign.totalLeads) * 100)
    : 0;

  const successRate = campaign.callsCompleted > 0
    ? Math.round((campaign.callsSuccessful / campaign.callsCompleted) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        {/* Top row: Back, Name, Actions */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Back + Name */}
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <Link href="/dashboard/campaigns" className="flex-shrink-0">
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
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <Flag className="h-6 w-6 text-slate-600 flex-shrink-0" />
                {editing ? (
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="text-xl sm:text-2xl font-bold h-auto py-1"
                  />
                ) : (
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-600 truncate" title={campaign.name}>
                    {campaign.name}
                  </h1>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {/* <CampaignStatusBadge status={campaign.status} /> */}
                <span className="text-xs text-muted-foreground">
                  {campaign.totalLeads} leads
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center justify-end">
            {/* Mobile Header Actions (Edit/Delete icons only) */}
            {!editing && (
              <div className="flex items-center gap-1 sm:hidden">
                <Button variant="outline" size="icon" onClick={() => setEditing(true)} className="text-teal-600 border-teal-600 hover:bg-teal-50">
                  <Edit className="h-4 w-4" />
                </Button>
                <DeleteButton
                  onDelete={handleDelete}
                  itemName={campaign.name}
                  title="Delete Campaign"
                  variant="full"
                />
              </div>
            )}

            {/* Desktop Actions (Hidden on mobile) */}
            <div className="hidden sm:flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {editing ? (
                <>
                  <Button variant="ghost" onClick={handleCancel} className="text-slate-600 hover:text-slate-700 hover:bg-slate-100">
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                  </Button>
                </>
              ) : (
                <>
                  {/* Convert to Contacts button */}
                  {campaign.callsSuccessful > 0 && (
                    <Button
                      onClick={handleConvertToContacts}
                      disabled={actionLoading === 'convert'}
                      variant="outline"
                      className="text-teal-600 border-teal-600 hover:bg-teal-50"
                    >
                      {actionLoading === 'convert' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Users className="h-4 w-4 mr-2" />
                      )}
                      Convert to Contacts
                    </Button>
                  )}

                  {/* Edit & Delete */}
                  <Button variant="outline" onClick={() => setEditing(true)} className="text-teal-600 hover:text-teal-700">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <DeleteButton
                    onDelete={handleDelete}
                    itemName={campaign.name}
                    title="Delete Campaign"
                    variant="full"
                  />

                  {/* Start/Pause Button */}
                  {campaign.status !== 'COMPLETED' && campaign.status !== 'CANCELLED' && (
                    <>
                      {campaign.status === 'ACTIVE' ? (
                        <Button
                          onClick={handlePause}
                          disabled={actionLoading === 'pause'}
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          {actionLoading === 'pause' ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Pause className="h-4 w-4 mr-2" />
                          )}
                          Pause
                        </Button>
                      ) : (
                        <Button
                          onClick={handleStart}
                          disabled={actionLoading === 'start'}
                          className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700"
                        >
                          {actionLoading === 'start' ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          Start
                        </Button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Main Actions (Start/Convert - Full width below header) */}
        {!editing && (
          <div className="grid grid-cols-1 gap-2 sm:hidden">
            {/* Start/Pause Button (Main Action) */}
            {campaign.status !== 'COMPLETED' && campaign.status !== 'CANCELLED' && (
              <>
                {campaign.status === 'ACTIVE' ? (
                  <Button
                    onClick={handlePause}
                    disabled={actionLoading === 'pause'}
                    className="w-full bg-amber-600 hover:bg-amber-700"
                  >
                    {actionLoading === 'pause' ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Pause className="h-4 w-4 mr-2" />
                    )}
                    Pause Campaign
                  </Button>
                ) : (
                  <Button
                    onClick={handleStart}
                    disabled={actionLoading === 'start'}
                    className="w-full bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700"
                  >
                    {actionLoading === 'start' ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Start Campaign
                  </Button>
                )}
              </>
            )}

            {/* Convert Button */}
            {campaign.callsSuccessful > 0 && (
              <Button
                onClick={handleConvertToContacts}
                disabled={actionLoading === 'convert'}
                variant="outline"
                className="w-full text-teal-600 border-teal-600 hover:bg-teal-50"
              >
                {actionLoading === 'convert' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                Convert to Contacts
              </Button>
            )}
          </div>
        )}

        {/* Mobile Editing Actions */}
        {editing && (
          <div className="grid grid-cols-2 gap-2 sm:hidden">
             <Button variant="ghost" onClick={handleCancel} className="text-slate-600 hover:text-slate-700 hover:bg-slate-100">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Leads</p>
                <p className="text-lg sm:text-2xl font-bold text-slate-600">{campaign.totalLeads}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 flex-shrink-0">
                <User className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Calls Made</p>
                <p className="text-lg sm:text-2xl font-bold text-slate-600">{campaign.callsCompleted}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 flex-shrink-0">
                <Phone className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Success Rate</p>
                <p className="text-lg sm:text-2xl font-bold text-slate-600">{successRate}%</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 flex-shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Progress</p>
                <p className="text-lg sm:text-2xl font-bold text-slate-600">{progressPercent}%</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 flex-shrink-0">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {campaign.totalLeads > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Campaign Progress</span>
                <span className="font-medium text-slate-600">
                  {campaign.leadsContacted} / {campaign.totalLeads} leads contacted
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-[#0fa693] to-teal-600 h-3 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-slate-600">Campaign Configuration</CardTitle>
              <CardDescription>Settings and schedule <CampaignStatusBadge status={campaign.status} /></CardDescription>
                              
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {editing ? (
            <>
              {/* Description */}
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                />
              </div>

              {/* Call Window */}
              <div className="space-y-2">
                <Label>Call Window</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Start Time</Label>
                    <Input
                      type="time"
                      value={editForm.callWindowStart}
                      onChange={(e) => setEditForm({ ...editForm, callWindowStart: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">End Time</Label>
                    <Input
                      type="time"
                      value={editForm.callWindowEnd}
                      onChange={(e) => setEditForm({ ...editForm, callWindowEnd: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Pacing Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Daily Call Limit</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editForm.dailyCallLimit}
                    onChange={(e) => setEditForm({ ...editForm, dailyCallLimit: parseInt(e.target.value) || 100 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min Seconds Between Calls</Label>
                  <Input
                    type="number"
                    min="10"
                    value={editForm.minCallInterval}
                    onChange={(e) => setEditForm({ ...editForm, minCallInterval: parseInt(e.target.value) || 30 })}
                  />
                </div>
              </div>

              {/* Retry Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Retry Attempts</Label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    value={editForm.maxRetryAttempts}
                    onChange={(e) => setEditForm({ ...editForm, maxRetryAttempts: parseInt(e.target.value) || 3 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Retry Interval (seconds)</Label>
                  <Input
                    type="number"
                    min="300"
                    value={editForm.retryInterval}
                    onChange={(e) => setEditForm({ ...editForm, retryInterval: parseInt(e.target.value) || 3600 })}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Agent Info */}
              <div className="flex items-start gap-6 pb-6 border-b">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {ELEVENLABS_VOICES.find(v => v.id === campaign.agent?.voice)?.avatar ? (
                    <Image
                      src={ELEVENLABS_VOICES.find(v => v.id === campaign.agent?.voice)!.avatar!}
                      alt={campaign.agent?.name || 'Agent'}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-slate-400" />
                  )}
                </div>
                <div className="flex-1">
                  <Label className="text-muted-foreground">Agent</Label>
                  <Link href={`/dashboard/agents/${campaign.agent?.id}`}>
                    <p className="font-medium text-lg text-slate-600 hover:text-teal-600 hover:underline">
                      {campaign.agent?.name}
                    </p>
                  </Link>
                  <p className="text-sm text-muted-foreground mt-1">
                    Voice: {ELEVENLABS_VOICES.find(v => v.id === campaign.agent?.voice)?.name || campaign.agent?.voice}
                  </p>
                </div>
              </div>

              {/* Schedule & Pacing Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Call Window</Label>
                  <p className="font-medium text-slate-600 mt-1">
                    {campaign.callWindowStart || '00:00'} - {campaign.callWindowEnd || '23:59'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Daily Limit</Label>
                  <p className="font-medium text-slate-600 mt-1">{campaign.dailyCallLimit} calls/day</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Call Interval</Label>
                  <p className="font-medium text-slate-600 mt-1">{campaign.minCallInterval}s between calls</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Retry Settings</Label>
                  <p className="font-medium text-slate-600 mt-1">
                    {campaign.maxRetryAttempts} attempts, {Math.round(campaign.retryInterval / 60)}min interval
                  </p>
                </div>
              </div>

              {campaign.description && (
                <div className="pt-4 border-t">
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm text-slate-600 mt-1">{campaign.description}</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-slate-600">Leads</CardTitle>
              <CardDescription>{leads.length} of {campaign.totalLeads} total</CardDescription>
            </div>
            <div className="flex gap-2">
              <select
                value={leadsFilter}
                onChange={(e) => {
                  setLeadsFilter(e.target.value);
                  fetchLeads(1, e.target.value);
                }}
                className="text-sm border rounded-md px-3 py-1.5"
              >
                <option value="">All Leads</option>
                <option value="PENDING">Pending</option>
                <option value="CALLING">Calling</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
                <option value="SKIPPED">Skipped</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingLeads && leads.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No leads found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Desktop Table Header */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 bg-slate-50 rounded-lg text-xs font-medium text-muted-foreground">
                <div className="col-span-3">Name</div>
                <div className="col-span-3">Phone</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Attempts</div>
                <div className="col-span-2">Outcome</div>
              </div>

              {/* Leads */}
              {leads.map((lead) => (
                <div key={lead.id} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                  {/* Mobile Layout */}
                  <div className="sm:hidden space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        {lead.name && <p className="font-medium text-slate-600">{lead.name}</p>}
                        <p className="font-mono text-sm text-muted-foreground">{formatPhoneNumber(lead.phoneNumber)}</p>
                      </div>
                      <CampaignStatusBadge status={lead.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{lead.attempts} attempts</span>
                      {lead.outcome && <span className="capitalize">{lead.outcome}</span>}
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden sm:grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-3 truncate">
                      <p className="font-medium text-slate-600 truncate">{lead.name || '—'}</p>
                    </div>
                    <div className="col-span-3">
                      <p className="font-mono text-sm text-slate-600">{formatPhoneNumber(lead.phoneNumber)}</p>
                    </div>
                    <div className="col-span-2">
                      <CampaignStatusBadge status={lead.status} />
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground">
                      {lead.attempts} / {campaign.maxRetryAttempts}
                    </div>
                    <div className="col-span-2 text-sm text-slate-600 capitalize">
                      {lead.outcome || '—'}
                    </div>
                  </div>

                  {lead.notes && (
                    <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                      {lead.notes}
                    </div>
                  )}
                </div>
              ))}

              {/* Load More */}
              {leadsHasMore && (
                <div className="pt-4 text-center">
                  <Button
                    variant="outline"
                    onClick={() => fetchLeads(leadsPage + 1, leadsFilter)}
                    disabled={loadingLeads}
                    className="text-teal-600 border-teal-600 hover:bg-teal-50"
                  >
                    {loadingLeads ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Load More
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

