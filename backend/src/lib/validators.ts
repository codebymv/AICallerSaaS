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
});

export const updateAgentSchema = createAgentSchema.partial();

export const makeOutboundCallSchema = z.object({
  phoneNumber: z.string().min(10, 'Invalid phone number').max(15),
});

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
export type InitiateCallInput = z.infer<typeof initiateCallSchema>;
export type CallFilterInput = z.infer<typeof callFilterSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
