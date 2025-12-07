export const APP_CONFIG = {
  name: "AI Caller SaaS",
  description: "Build and deploy AI voice agents",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
} as const;

export const VOICE_CONFIG = {
  // Latency targets
  maxResponseLatency: 500, // ms
  silenceThreshold: 800, // ms before considering user done speaking
  
  // Call limits
  maxCallDuration: 1800, // 30 minutes
  maxConcurrentCalls: 10,
  
  // Default settings
  defaultVoice: "rachel",
  defaultVoiceProvider: "elevenlabs",
} as const;

export const PRICING = {
  perMinute: 0.12, // $0.12/minute
  minimumPurchase: 20, // $20 minimum
  
  creditPackages: [
    { amount: 20, bonus: 0, minutes: 166 },
    { amount: 100, bonus: 10, minutes: 916 },
    { amount: 500, bonus: 75, minutes: 4791 },
  ],
  
  freeTier: {
    testCalls: 10,
    liveMinutes: 0,
    agents: 1,
  },
} as const;

export const COST_PER_CALL = {
  deepgram: 0.0043, // per minute
  openai: 0.005, // estimated per call
  elevenlabs: 0.30, // per 1k characters
  twilio: 0.013, // per minute
} as const;

export const AVAILABLE_VOICES = [
  { id: "rachel", name: "Rachel (Professional)", provider: "elevenlabs", gender: "female" },
  { id: "adam", name: "Adam (Friendly)", provider: "elevenlabs", gender: "male" },
  { id: "bella", name: "Bella (Warm)", provider: "elevenlabs", gender: "female" },
  { id: "josh", name: "Josh (Energetic)", provider: "elevenlabs", gender: "male" },
] as const;
