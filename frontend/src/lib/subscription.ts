// Define Plan type locally since frontend doesn't have access to Prisma types
export type Plan = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

// Feature flags configuration
export const FEATURES = {
    HYBRID_MODE: {
        allowedPlans: ['PROFESSIONAL', 'ENTERPRISE'],
        label: 'Hybrid Mode',
        description: 'Allow agents to handle both inbound and outbound calls'
    },
    CALENDAR_INTEGRATION: {
        allowedPlans: ['PROFESSIONAL', 'ENTERPRISE'],
        label: 'Calendar Integration',
        description: 'Connect Google Calendar, Calendly, or Cal.com'
    },
    VOICE_CLONING: {
        allowedPlans: ['PROFESSIONAL', 'ENTERPRISE'],
        label: 'Voice Cloning',
        description: 'Create custom voices from your own audio samples'
    },
    WHITE_LABEL: {
        allowedPlans: ['ENTERPRISE'],
        label: 'White Labeling',
        description: 'Remove "Powered by AI Caller" branding'
    },
    MULTIPLE_AGENTS: {
        allowedPlans: ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
        limit: {
            FREE: 1,
            STARTER: 5,
            PROFESSIONAL: 20,
            ENTERPRISE: 100
        }
    },
    VOICE_LIBRARY: {
        allowedPlans: ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
        label: 'Extended Voice Library',
        description: 'Access to all premium AI voices',
        limit: {
            FREE: 3,
            STARTER: 5,
            PROFESSIONAL: 11,
            ENTERPRISE: 11
        }
    },
    CAMPAIGNS: {
        allowedPlans: ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
        label: 'Outbound Campaigns',
        description: 'Automated outbound calling campaigns',
        limit: {
            FREE: 0,
            STARTER: 1,
            PROFESSIONAL: 3,
            ENTERPRISE: 100
        }
    }
};

export function canAccessFeature(plan: string, featureKey: keyof typeof FEATURES): boolean {
    const feature = FEATURES[featureKey];
    if ('allowedPlans' in feature) {
        return feature.allowedPlans.includes(plan);
    }
    return true;
}

export function getFeatureLimit(plan: string, featureKey: 'MULTIPLE_AGENTS' | 'VOICE_LIBRARY' | 'CAMPAIGNS'): number {
    const feature = FEATURES[featureKey];
    return (feature.limit as any)[plan] || 0;
}

