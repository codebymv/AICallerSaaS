'use client';

import Link from 'next/link';
import { Check, Loader2, Zap, Crown, Building2, User } from 'lucide-react';

interface PricingCardsProps {
    hideFree?: boolean;
    currentPlan?: string;
    variant?: 'landing' | 'dashboard';
}

const PRICING_PLANS = [
    {
        id: 'FREE',
        name: 'Free',
        price: '$0',
        period: '/month',
        description: 'Perfect for getting started',
        features: [
            '1 AI Agent',
            '3 Voice Options',
            '1,000 Included Credits',
            'Pay-as-you-go usage',
            'Basic Analytics',
        ],
        cta: 'Get Started Free',
        href: '/register',
        highlighted: false,
        icon: User,
        iconColor: 'text-slate-500',
    },
    {
        id: 'STARTER',
        name: 'Starter',
        price: '$29',
        period: '/month',
        description: 'For growing businesses',
        features: [
            '5 AI Agents',
            '5 Voice Options',
            '1 Outbound Campaign',
            '5,000 Included Credits',
            'Email Support',
        ],
        cta: 'Start Free Trial',
        href: '/register',
        highlighted: false,
        icon: Zap,
        iconColor: 'text-slate-700',
    },
    {
        id: 'PROFESSIONAL',
        name: 'Professional',
        price: '$99',
        period: '/month',
        description: 'For teams that need more',
        features: [
            '20 AI Agents',
            'All 11 Voices',
            '3 Outbound Campaigns',
            '20,000 Included Credits',
            'Calendar Integration',
            'Hybrid Mode & Omnichannel',
            'Priority Support',
        ],
        badge: 'Most Popular',
        cta: 'Start Free Trial',
        href: '/register',
        highlighted: true,
        icon: Crown,
        iconColor: 'text-amber-500',
    },
    {
        id: 'ENTERPRISE',
        name: 'Enterprise',
        price: 'Custom',
        period: '',
        description: 'For large organizations',
        features: [
            'Unlimited AI Agents',
            'All Voices + Custom',
            'Unlimited Campaigns',
            'Custom Credits & Pricing',
            'White-labeling',
            'SSO',
            'Dedicated Account Manager',
        ],
        cta: 'Contact Sales',
        href: 'mailto:sales@gleam.ai',
        highlighted: false,
        icon: Building2,
        iconColor: 'text-slate-700',
    },
];

export function PricingCards({ hideFree = false, currentPlan, variant = 'landing' }: PricingCardsProps) {
    const plans = hideFree ? PRICING_PLANS.filter(p => p.id !== 'FREE') : PRICING_PLANS;

    // Button styles based on variant
    const getButtonClass = (isHighlighted: boolean, isEnterprise: boolean) => {
        if (variant === 'dashboard') {
            // Dashboard: highlighted Pro card gets white bg (visible on teal), others get teal gradient
            if (isHighlighted) {
                return 'w-full py-3 px-4 bg-white rounded-lg text-teal-700 font-medium text-center hover:bg-slate-50 transition-colors border border-white';
            }
            return 'w-full py-3 px-4 bg-gradient-to-b from-[#0fa693] to-teal-600 rounded-lg text-white font-medium text-center hover:from-[#0e9585] hover:to-teal-700 transition-colors';
        }
        // Landing: dark slate for all buttons
        if (isHighlighted) {
            return 'w-full py-3 px-4 bg-white rounded-lg text-teal-700 font-semibold text-center hover:bg-teal-50 transition-colors';
        }
        return 'w-full py-3 px-4 bg-slate-900 rounded-lg text-white font-medium text-center hover:bg-slate-800 transition-colors';
    };

    return (
        <div className="space-y-6">
            <div className={`grid grid-cols-1 md:grid-cols-2 ${hideFree ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-6`}>
                {plans.map((plan) => {
                    const isCurrentPlan = currentPlan === plan.id;

                    if (plan.highlighted) {
                        return (
                            <div key={plan.id} className="bg-gradient-to-b from-teal-600 to-teal-700 rounded-2xl p-6 flex flex-col relative">
                                {plan.badge && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <span className="bg-amber-400 text-amber-900 text-xs font-semibold px-3 py-1 rounded-full">
                                            {plan.badge}
                                        </span>
                                    </div>
                                )}
                                <div className="mb-6">
                                    <div className="flex items-center gap-2">
                                        <plan.icon className="h-6 w-6 text-white" />
                                        <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                                    </div>
                                    <div className="mt-2">
                                        <span className="text-3xl font-bold text-white">{plan.price}</span>
                                        <span className="text-teal-100">{plan.period}</span>
                                    </div>
                                    <p className="mt-2 text-sm text-teal-100">{plan.description}</p>
                                </div>
                                <ul className="space-y-3 flex-1 mb-6">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-center gap-2 text-sm text-white">
                                            <Check className="h-4 w-4 text-teal-200 flex-shrink-0" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                                {isCurrentPlan ? (
                                    <div className="w-full py-3 px-4 bg-white/20 rounded-lg text-white font-medium text-center">
                                        Current Plan
                                    </div>
                                ) : (
                                    <Link
                                        href={plan.href}
                                        className={getButtonClass(true, false)}
                                    >
                                        {plan.cta}
                                    </Link>
                                )}
                            </div>
                        );
                    }

                    return (
                        <div key={plan.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col">
                            <div className="mb-6">
                                <div className="flex items-center gap-2">
                                    <plan.icon className={`h-6 w-6 ${variant === 'dashboard' && plan.highlighted ? 'text-white' : plan.iconColor}`} />
                                    <h3 className={`text-lg font-semibold ${variant === 'dashboard' && plan.highlighted ? 'text-white' : (variant === 'dashboard' ? 'text-slate-600' : 'text-slate-900')}`}>{plan.name}</h3>
                                </div>
                                <div className="mt-2">
                                    <span className={`text-3xl font-bold ${variant === 'dashboard' ? 'text-slate-600' : 'text-slate-900'}`}>{plan.price}</span>
                                    <span className="text-slate-500">{plan.period}</span>
                                </div>
                                <p className="mt-2 text-sm text-slate-500">{plan.description}</p>
                            </div>
                            <ul className="space-y-3 flex-1 mb-6">
                                {plan.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                                        <Check className="h-4 w-4 text-teal-500 flex-shrink-0" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                            {isCurrentPlan ? (
                                <div className="w-full py-3 px-4 bg-slate-100 rounded-lg text-slate-600 font-medium text-center">
                                    Current Plan
                                </div>
                            ) : (
                                <Link
                                    href={plan.href}
                                    className={getButtonClass(false, plan.id === 'ENTERPRISE')}
                                >
                                    {plan.cta}
                                </Link>
                            )}
                        </div>
                    );
                })}
            </div>

            <p className="text-center text-sm text-slate-500">
                All plans include a 14-day free trial. No credit card required to start.
            </p>
        </div>
    );
}
