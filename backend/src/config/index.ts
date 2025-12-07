// ============================================
// Configuration
// ============================================

import { z } from 'zod';

const configSchema = z.object({
  // Server
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.number().default(3001),
  corsOrigin: z.string().default('http://localhost:3000'),
  
  // Database
  databaseUrl: z.string(),
  
  // Redis
  redisUrl: z.string().optional(),
  
  // JWT
  jwtSecret: z.string().min(32),
  jwtExpiresIn: z.string().default('7d'),
  
  // Twilio
  twilioAccountSid: z.string(),
  twilioAuthToken: z.string(),
  twilioPhoneNumber: z.string().optional(),
  
  // Deepgram
  deepgramApiKey: z.string(),
  
  // OpenAI
  openaiApiKey: z.string(),
  
  // ElevenLabs
  elevenlabsApiKey: z.string(),
  
  // Stripe
  stripeSecretKey: z.string().optional(),
  stripeWebhookSecret: z.string().optional(),
  
  // App URL
  appUrl: z.string().default('http://localhost:3000'),
  apiUrl: z.string().default('http://localhost:3001'),
});

function loadConfig() {
  const result = configSchema.safeParse({
    nodeEnv: process.env.NODE_ENV,
    port: parseInt(process.env.PORT || '3001', 10),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN,
    
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
    
    deepgramApiKey: process.env.DEEPGRAM_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,
    
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    
    appUrl: process.env.APP_URL,
    apiUrl: process.env.API_URL,
  });

  if (!result.success) {
    console.error('❌ Invalid configuration:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof configSchema>;
