// Voice provider constants

export const ELEVENLABS_VOICES = [
  { id: 'rachel', name: 'Rachel', description: 'Calm, professional female voice', avatar: '/rachel.png' },
  { id: 'drew', name: 'Drew', description: 'Confident, articulate male voice', avatar: '/drew.png' },
  { id: 'clyde', name: 'Clyde', description: 'Warm, friendly male voice', avatar: '/clyde.png' },
  { id: 'paul', name: 'Paul', description: 'Clear, authoritative male voice', avatar: '/paul.png' },
  { id: 'domi', name: 'Domi', description: 'Energetic, youthful female voice', avatar: '/domi.png' },
  { id: 'dave', name: 'Dave', description: 'Conversational male voice', avatar: '/dave.png' },
  { id: 'fin', name: 'Fin', description: 'Sophisticated Irish male voice', avatar: '/fin.png' },
  { id: 'sarah', name: 'Sarah', description: 'Soft, friendly female voice', avatar: '/sarah.png' },
  { id: 'antoni', name: 'Antoni', description: 'Warm, expressive male voice', avatar: '/antoni.png' },
  { id: 'thomas', name: 'Thomas', description: 'Calm, reassuring male voice', avatar: '/thomas.png' },
  { id: 'charlie', name: 'Charlie', description: 'Natural Australian male voice', avatar: '/charlie.png' },
];

export const DEFAULT_VOICES = {
  elevenlabs: ELEVENLABS_VOICES,
} as const;

export const DEFAULT_LLM_MODELS = [
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
] as const;

// Error codes
export const ERROR_CODES = {
  // Auth errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // Call errors
  CALL_FAILED: 'CALL_FAILED',
  CALL_IN_PROGRESS: 'CALL_IN_PROGRESS',
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

// UI Color Constants - Centralized for consistency
export const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  'in-progress': 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
  ringing: 'bg-yellow-100 text-yellow-700',
  busy: 'bg-orange-100 text-orange-700',
  'no-answer': 'bg-slate-100 text-slate-600',
  queued: 'bg-slate-100 text-slate-600',
  canceled: 'bg-slate-100 text-slate-600',
  default: 'bg-slate-100 text-slate-600',
};

export const AGENT_STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-slate-100 text-slate-600',
} as const;

export const DIRECTION_COLORS = {
  inbound: { bg: 'bg-blue-100', icon: 'text-blue-600' },
  outbound: { bg: 'bg-green-100', icon: 'text-green-600' },
} as const;

// Agent modes
export const AGENT_MODES = {
  INBOUND: { 
    id: 'INBOUND',
    label: 'Inbound', 
    description: 'Receive inbound calls only',
    iconType: 'ArrowDownLeft'
  },
  OUTBOUND: { 
    id: 'OUTBOUND',
    label: 'Outbound', 
    description: 'Make outbound calls only',
    iconType: 'ArrowUpRight'
  },
  HYBRID: { 
    id: 'HYBRID',
    label: 'Hybrid', 
    description: 'Both inbound and outbound calls',
    iconType: 'ArrowLeftRight'
  },
} as const;

export type AgentMode = keyof typeof AGENT_MODES;
