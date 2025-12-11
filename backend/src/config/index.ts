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
  
  // Google OAuth
  googleClientId: z.string().optional(),
  googleClientSecret: z.string().optional(),
  googleRedirectUri: z.string().optional(),
  
  // AWS S3
  awsAccessKeyId: z.string().optional(),
  awsSecretAccessKey: z.string().optional(),
  awsRegion: z.string().default('us-east-1'),
  awsS3Bucket: z.string().optional(),
  
  // App URL
  appUrl: z.string().default('http://localhost:3000'),
  apiUrl: z.string().default('http://localhost:3001'),
  websocketUrl: z.string().optional(),
});

function loadConfig() {
  console.log('Loading configuration...');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PORT:', process.env.PORT);
  console.log('CORS_ORIGIN:', process.env.CORS_ORIGIN);
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'MISSING');
  console.log('JWT_SECRET:', process.env.JWT_SECRET ? `SET (${process.env.JWT_SECRET.length} chars)` : 'MISSING');
  console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING');
  console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'MISSING');
  console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI ? process.env.GOOGLE_REDIRECT_URI : 'NOT SET');
  console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? 'SET' : 'MISSING');
  console.log('DEBUG: Actual values being passed to Zod:', {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ? '[REDACTED]' : undefined,
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
  });
  
  console.log('DEEPGRAM_API_KEY:', process.env.DEEPGRAM_API_KEY ? 'SET' : 'MISSING');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'MISSING');
  console.log('ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY ? 'SET' : 'MISSING');
  console.log('WEBSOCKET_URL:', process.env.WEBSOCKET_URL ? process.env.WEBSOCKET_URL : 'NOT SET');
  
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
    googleClientId: process.env.GOOGLE_CLIENT_ID || undefined,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || undefined,
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || undefined,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: process.env.AWS_REGION,
    awsS3Bucket: process.env.AWS_S3_BUCKET,
    
    appUrl: process.env.APP_URL,
    apiUrl: process.env.API_URL,
    websocketUrl: process.env.WEBSOCKET_URL,
  });

  if (!result.success) {
    console.error('❌ Invalid configuration:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  console.log('DEBUG: Config object after parsing:', {
    googleClientId: result.data.googleClientId ? 'SET' : 'MISSING',
    googleClientSecret: result.data.googleClientSecret ? 'SET' : 'MISSING',
    googleRedirectUri: result.data.googleRedirectUri || 'MISSING',
  });
  console.log('✅ Configuration loaded successfully');
  return result.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof configSchema>;
