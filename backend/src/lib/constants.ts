// Voice provider constants

export const ELEVENLABS_VOICES = [
  { id: 'rachel', name: 'Rachel', description: 'Calm, professional female voice' },
  { id: 'drew', name: 'Drew', description: 'Confident, articulate male voice' },
  { id: 'clyde', name: 'Clyde', description: 'Warm, friendly male voice' },
  { id: 'paul', name: 'Paul', description: 'Clear, authoritative male voice' },
  { id: 'domi', name: 'Domi', description: 'Energetic, youthful female voice' },
  { id: 'dave', name: 'Dave', description: 'Conversational male voice' },
  { id: 'fin', name: 'Fin', description: 'Sophisticated Irish male voice' },
  { id: 'sarah', name: 'Sarah', description: 'Soft, friendly female voice' },
  { id: 'antoni', name: 'Antoni', description: 'Warm, expressive male voice' },
  { id: 'thomas', name: 'Thomas', description: 'Calm, reassuring male voice' },
  { id: 'charlie', name: 'Charlie', description: 'Natural Australian male voice' },
];

export const DEEPGRAM_VOICES = [
  { id: 'aura-asteria-en', name: 'Asteria', description: 'Professional female voice' },
  { id: 'aura-luna-en', name: 'Luna', description: 'Warm female voice' },
  { id: 'aura-stella-en', name: 'Stella', description: 'Friendly female voice' },
  { id: 'aura-athena-en', name: 'Athena', description: 'Authoritative female voice' },
  { id: 'aura-hera-en', name: 'Hera', description: 'Confident female voice' },
  { id: 'aura-orion-en', name: 'Orion', description: 'Professional male voice' },
  { id: 'aura-arcas-en', name: 'Arcas', description: 'Warm male voice' },
  { id: 'aura-perseus-en', name: 'Perseus', description: 'Friendly male voice' },
  { id: 'aura-angus-en', name: 'Angus', description: 'Scottish male voice' },
  { id: 'aura-orpheus-en', name: 'Orpheus', description: 'Deep male voice' },
];

export const DEFAULT_VOICES: Record<string, typeof ELEVENLABS_VOICES> = {
  elevenlabs: ELEVENLABS_VOICES,
  deepgram: DEEPGRAM_VOICES,
};

export const DEFAULT_LLM_MODELS = [
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
];

// Error codes - comprehensive list
export const ERROR_CODES = {
  // Auth errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  AUTH_INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  AUTH_TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'TOKEN_INVALID',
  UNAUTHORIZED: 'UNAUTHORIZED',
  AUTH_UNAUTHORIZED: 'UNAUTHORIZED',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  CALL_NOT_FOUND: 'CALL_NOT_FOUND',
  PHONE_NUMBER_NOT_FOUND: 'PHONE_NUMBER_NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // Call errors
  CALL_FAILED: 'CALL_FAILED',
  CALL_IN_PROGRESS: 'CALL_IN_PROGRESS',
  CALL_QUOTA_EXCEEDED: 'CALL_QUOTA_EXCEEDED',
  TWILIO_ERROR: 'TWILIO_ERROR',
  
  // Twilio configuration
  TWILIO_NOT_CONFIGURED: 'TWILIO_NOT_CONFIGURED',
} as const;

export const ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODES.INVALID_CREDENTIALS]: 'Invalid email or password',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Your session has expired, please log in again',
  [ERROR_CODES.UNAUTHORIZED]: 'You are not authorized to perform this action',
  [ERROR_CODES.VALIDATION_ERROR]: 'Please check your input and try again',
  [ERROR_CODES.INVALID_INPUT]: 'Invalid input provided',
  [ERROR_CODES.NOT_FOUND]: 'The requested resource was not found',
  [ERROR_CODES.ALREADY_EXISTS]: 'This resource already exists',
  [ERROR_CODES.RATE_LIMITED]: 'Too many requests, please try again later',
  [ERROR_CODES.INTERNAL_ERROR]: 'An unexpected error occurred',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
  [ERROR_CODES.CALL_FAILED]: 'Failed to initiate call',
  [ERROR_CODES.CALL_IN_PROGRESS]: 'A call is already in progress',
};

// Call status
export const CALL_STATUS = {
  QUEUED: 'queued',
  RINGING: 'ringing',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  BUSY: 'busy',
  NO_ANSWER: 'no-answer',
  CANCELED: 'canceled',
} as const;
