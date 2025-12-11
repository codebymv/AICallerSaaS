import { z } from 'zod';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
});

// Agent schemas
export const createAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().min(1, 'System prompt is required').max(10000),
  voiceId: z.string().optional(),
  voiceProvider: z.enum(['elevenlabs', 'deepgram']).default('elevenlabs'),
  voiceSettings: z.record(z.any()).optional(),
  llmModel: z.string().default('gpt-4-turbo'),
  llmProvider: z.enum(['openai', 'anthropic']).default('openai'),
  greeting: z.string().max(500).optional(),
  maxCallDuration: z.number().min(30).max(3600).default(600),
  interruptible: z.boolean().default(true),
  webhookUrl: z.string().url().optional(),
  webhookEvents: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
  // Mode-specific fields
  mode: z.enum(['INBOUND', 'OUTBOUND', 'HYBRID']).default('INBOUND'),
  outboundGreeting: z.string().max(500).optional(),
  callTimeout: z.number().min(30).max(3600).default(600),
  retryAttempts: z.number().min(0).max(5).default(0),
  callWindowStart: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').optional(),
  callWindowEnd: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').optional(),
  // Calendar integration (agent-centric)
  calendarEnabled: z.boolean().default(false),
  calendarIntegrationId: z.string().optional(),
  calendarScopes: z.array(z.enum(['read_calendar', 'create_events', 'reschedule_events'])).default(['read_calendar', 'create_events', 'reschedule_events']),
  defaultEventTypeId: z.string().optional(),
  defaultEventTypeName: z.string().optional(),
  defaultEventDuration: z.number().min(5).max(480).default(30),
  // Business context
  personaName: z.string().max(100).optional(),
  callPurpose: z.string().max(500).optional(),
  // Communication channel
  communicationChannel: z.enum(['VOICE_ONLY', 'MESSAGING_ONLY', 'OMNICHANNEL']).default('VOICE_ONLY'),
  // Messaging-specific fields
  messagingGreeting: z.string().max(500).optional(),
  messagingSystemPrompt: z.string().max(10000).optional(),
  // Media tool access (for messaging-capable agents)
  imageToolEnabled: z.boolean().default(false),
  documentToolEnabled: z.boolean().default(false),
  videoToolEnabled: z.boolean().default(false),
});

export const updateAgentSchema = createAgentSchema.partial();

export const makeOutboundCallSchema = z.object({
  phoneNumber: z.string().min(10, 'Invalid phone number').max(15),
});

// Message schemas
export const sendMessageSchema = z.object({
  phoneNumber: z.string().min(10, 'Invalid phone number').max(15),
  message: z.string().min(1, 'Message is required').max(1600), // SMS can be up to 1600 chars (10 segments)
  mediaUrls: z.array(z.string().url()).max(10).optional(), // MMS allows up to 10 media files
  assetIds: z.array(z.string()).max(10).optional(), // Reference pre-uploaded assets by ID
});

// Asset schemas
export const createAssetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  category: z.enum(['IMAGE', 'DOCUMENT', 'VIDEO', 'OTHER']).default('OTHER'),
  url: z.string().url('Must be a valid URL'),
  mimeType: z.string().optional(),
  fileSize: z.number().optional(),
  agentId: z.string().optional(), // Optional: associate with specific agent
});

export const updateAssetSchema = createAssetSchema.partial();

// Call schemas
export const initiateCallSchema = z.object({
  agentId: z.string().uuid('Invalid agent ID'),
  to: z.string().min(10, 'Invalid phone number'),
  toNumber: z.string().optional(),
  from: z.string().optional(),
  fromNumber: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const callFilterSchema = z.object({
  status: z.string().optional(),
  agentId: z.string().uuid().optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type MakeOutboundCallInput = z.infer<typeof makeOutboundCallSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type InitiateCallInput = z.infer<typeof initiateCallSchema>;
export type CallFilterInput = z.infer<typeof callFilterSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
