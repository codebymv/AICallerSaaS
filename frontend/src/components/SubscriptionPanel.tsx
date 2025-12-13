'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { Loader2, CreditCard, Zap, Check, ExternalLink, User, Crown, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PricingCards } from '@/components/PricingCards';

interface BillingStatus {
  plan: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  creditsBalance: number;
  minutesUsed: number;
  minutesLimit: number;
  stripeCustomerId: string | null;
}

const PLANS = {
  FREE: {
    name: 'Free',
    price: '$0/mo',
    features: [
      '1 AI Agent',
      '3 Voice Options',
      'Basic Analytics',
      'Pay-as-you-go credits',
    ],
    color: 'bg-slate-500',
    icon: User,
  },
  STARTER: {
    name: 'Starter',
    price: '$29/mo',
    priceId: 'price_1Sdq7DRxBJaRlFvtBe9fI2dc',
    features: [
      '5 AI Agents',
      '5 Voice Options',
      '1 Outbound Campaign',
      '500 Included Minutes',
      'Email Support',
    ],
    color: 'bg-teal-500',
    icon: Zap,
  },
  PROFESSIONAL: {
    name: 'Professional',
    price: '$99/mo',
    priceId: 'price_1Sdq8eRxBJaRlFvtctCqP1e4',
    features: [
      '20 AI Agents',
      'All 11 Voices',
      '3 Outbound Campaigns',
      '2,000 Included Minutes',
      'Calendar Integration',
      'Hybrid Mode & Omnichannel',
      'Priority Support',
    ],
    color: 'bg-teal-700',
    icon: Crown,
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 'Custom',
    features: [
      'Unlimited AI Agents',
      'All Voices + Custom',
      'Unlimited Campaigns',
      'Custom Minutes & Pricing',
      'White-labeling',
      'SSO',
      'Dedicated Account Manager',
    ],
    color: 'bg-slate-800',
    icon: Building2,
  },
};

export function SubscriptionPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await api.getBillingStatus();
      if (response.data) {
        setStatus(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch billing status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePortal = async () => {
    setProcessing(true);
    try {
      const response = await api.createPortalSession(window.location.href);
      if (response.data && response.data.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error("No URL returned");
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to open billing portal',
        variant: 'destructive',
      });
      setProcessing(false);
    }
  };

  const handleUpgrade = async (priceId: string) => {
    setProcessing(true);
    try {
      const response = await api.createCheckoutSession({
        priceId,
        mode: 'subscription',
        successUrl: `${window.location.origin}/dashboard/settings?success=true`,
        cancelUrl: `${window.location.origin}/dashboard/settings?canceled=true`,
      });
      if (response.data && response.data.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error("No URL returned");
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start checkout',
        variant: 'destructive',
      });
      setProcessing(false);
    }
  };

  const handleBuyCredits = async (amount: number) => {
    // Logic for buying credits
    // amount is in dollars
    const priceMap: Record<number, string> = {
      10: 'price_1SdqBRRxBJaRlFvthmn8Bbet',
      50: 'price_1SdqCVRxBJaRlFvtmOMx0sjf'
    };

    setProcessing(true);
    try {
      const response = await api.createCheckoutSession({
        priceId: priceMap[amount],
        mode: 'payment',
        successUrl: `${window.location.origin}/dashboard/settings?success=credits_purchased`,
        cancelUrl: `${window.location.origin}/dashboard/settings?canceled=true`,
      });
      if (response.data && response.data.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error("No URL returned");
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start credit purchase',
        variant: 'destructive',
      });
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!status) return null;

  const currentPlan = PLANS[status.plan] || PLANS.FREE;

  return (
    <div className="space-y-8">
      {/* Current Usage & Credits */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Plan
            </CardTitle>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-semibold text-slate-600">{currentPlan.name}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground mb-4">
              {currentPlan.price}
            </div>
            {status.plan !== 'FREE' && (
              <Button
                variant="outline"
                className="w-full text-teal-600 border-teal-600 hover:bg-teal-50"
                onClick={handlePortal}
                disabled={processing}
              >
                Manage Subscription
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Additional Credits
            </CardTitle>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-semibold text-slate-600">{Math.floor(Number(status.creditsBalance) * 10)} credits</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground mb-2">
              For calls beyond included plan usage and SMS/MMS messaging
            </div>
            {status.minutesUsed >= status.minutesLimit && Number(status.creditsBalance) <= 0 && (
              <p className="text-xs text-red-600 mb-2">
                No credits remaining. Usage beyond included plan limits is paused until you add more.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700 text-white"
                onClick={() => handleBuyCredits(10)}
                disabled={processing}
              >
                Add 100 Credits
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700 text-white"
                onClick={() => handleBuyCredits(50)}
                disabled={processing}
              >
                Add 500 Credits
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-slate-600">Plan Usage</CardTitle>
          <CardDescription>Your current plan includes usage credits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Included Credits</span>
              <span className="text-muted-foreground">{status.minutesUsed * 10} / {status.minutesLimit * 10} credits</span>
            </div>
            <Progress value={(status.minutesUsed / status.minutesLimit) * 100} className="h-2" indicatorClassName="bg-gradient-to-b from-[#0fa693] to-teal-600" />
            <p className="text-xs text-muted-foreground">
              After your included credits, additional usage is billed from your purchased credits.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold mb-4 text-slate-600">Available Plans</h3>
        <PricingCards hideFree currentPlan={status.plan} variant="dashboard" />
      </div>
    </div>
  );
}
