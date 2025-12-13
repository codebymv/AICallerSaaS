'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Plus, Flag, RefreshCw, Loader2, Edit, User, Lock, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/DeleteButton';
import { EmptyState } from '@/components/EmptyState';
import { CampaignStatusBadge } from '@/components/CampaignStatusBadge';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ELEVENLABS_VOICES } from '@/lib/constants';
import { getFeatureLimit, Plan } from '@/lib/subscription';

export default function CampaignsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userPlan, setUserPlan] = useState<Plan>('FREE');

  const campaignLimit = getFeatureLimit(userPlan, 'CAMPAIGNS');
  const canCreateMore = campaigns.length < campaignLimit;
  const isFreeUser = userPlan === 'FREE';

  const fetchCampaigns = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const response = await api.getCampaigns();
      setCampaigns(response.data || []);
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();

    // Fetch user plan
    const fetchPlan = async () => {
      try {
        const response = await api.getBillingStatus();
        if (response.data?.plan) {
          setUserPlan(response.data.plan);
        }
      } catch {
        // Ignore
      }
    };
    fetchPlan();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    try {
      await api.deleteCampaign(id);
      toast({ title: 'Campaign deleted', description: `${name} has been deleted.` });
      fetchCampaigns();
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete campaign.',
        variant: 'destructive',
      });
    }
  };

  const handleNewCampaign = () => {
    if (!canCreateMore) {
      toast({
        title: 'Upgrade Required',
        description: `Your ${userPlan} plan allows ${campaignLimit} campaign${campaignLimit !== 1 ? 's' : ''}. Upgrade to create more.`,
        variant: 'destructive',
      });
      return;
    }
    router.push('/dashboard/campaigns/new');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // FREE users see upgrade prompt
  if (isFreeUser) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Flag className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-600">Campaigns</h1>
            <p className="hidden sm:block text-muted-foreground text-sm">Manage your outbound calling campaigns</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-10 pb-10">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                <Lock className="h-8 w-8 text-slate-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-600">Upgrade to Access Campaigns</h3>
                <p className="text-muted-foreground max-w-md">
                  Outbound campaigns let you automate calling to a list of leads.
                  Upgrade to Starter or above to unlock this powerful feature.
                </p>
              </div>
              <Link href="/dashboard/settings?tab=subscription">
                <Button className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
                  <Zap className="h-4 w-4 mr-2" />
                  Upgrade Now
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Flag className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-600">Campaigns</h1>
            <p className="hidden sm:block text-muted-foreground text-sm">
              Manage your outbound calling campaigns
              <span className="ml-2 text-xs">({campaigns.length}/{campaignLimit} used)</span>
            </p>
          </div>
        </div>
        {/* Mobile: icon-only buttons */}
        <div className="flex gap-2 sm:hidden">
          <Button
            onClick={() => fetchCampaigns(true)}
            disabled={refreshing}
            variant="outline"
            size="icon"
            className="text-teal-600 border-teal-600 hover:bg-teal-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="icon"
            className={`${canCreateMore
              ? 'bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700'
              : 'bg-slate-300 cursor-not-allowed'}`}
            onClick={handleNewCampaign}
            disabled={!canCreateMore}
          >
            {canCreateMore ? <Plus className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          </Button>
        </div>
        {/* Desktop: full buttons */}
        <div className="hidden sm:flex gap-2">
          <Button
            onClick={() => fetchCampaigns(true)}
            disabled={refreshing}
            variant="outline"
            className="text-teal-600 border-teal-600 hover:bg-teal-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            className={`${canCreateMore
              ? 'bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700'
              : 'bg-slate-300 cursor-not-allowed'}`}
            onClick={handleNewCampaign}
            disabled={!canCreateMore}
          >
            {canCreateMore ? <Plus className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
            {canCreateMore ? 'New Campaign' : 'Limit Reached'}
          </Button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Flag}
              title="No campaigns yet"
              description="Create your first campaign to start making automated outbound calls to your leads."
              action={{
                label: 'Create Your First Campaign',
                onClick: handleNewCampaign,
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => {
            const progressPercent = campaign.totalLeads > 0
              ? Math.round((campaign.leadsContacted / campaign.totalLeads) * 100)
              : 0;

            return (
              <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Link href={`/dashboard/campaigns/${campaign.id}`} className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-teal-600 transition-all">
                        {ELEVENLABS_VOICES.find(v => v.id === campaign.agent?.voice)?.avatar ? (
                          <Image
                            src={ELEVENLABS_VOICES.find(v => v.id === campaign.agent?.voice)!.avatar!}
                            alt={ELEVENLABS_VOICES.find(v => v.id === campaign.agent?.voice)?.name || 'Voice'}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <User className="h-6 w-6 text-slate-400" />
                        )}
                      </div>
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/dashboard/campaigns/${campaign.id}`}>
                        <CardTitle className="text-lg text-slate-600 hover:text-teal-600 hover:underline decoration-slate-300 hover:decoration-teal-600 underline-offset-2 transition-colors cursor-pointer truncate">
                          {campaign.name}
                        </CardTitle>
                      </Link>
                      <CardDescription className="line-clamp-1">
                        {campaign.agent?.name || 'No agent'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Link href={`/dashboard/campaigns/${campaign.id}?edit=true`}>
                      <Button variant="ghost" size="icon" title="Edit campaign" className="text-teal-600 hover:text-teal-700">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <DeleteButton
                      onDelete={() => handleDelete(campaign.id, campaign.name)}
                      itemName={campaign.name}
                      title="Delete Campaign"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                      <CampaignStatusBadge status={campaign.status} />
                      <span className="text-sm text-muted-foreground">
                        {campaign.totalLeads} leads
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-[#0fa693] to-teal-600 h-2 rounded-full transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-sm pt-2 border-t">
                      <span className="text-muted-foreground">
                        {campaign.callsCompleted} calls
                      </span>
                      <span className="text-green-600 font-medium">
                        {campaign.callsSuccessful} successful
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
