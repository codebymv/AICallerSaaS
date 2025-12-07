// Twilio WebSocket event types

export interface TwilioMediaStart {
  event: 'start';
  sequenceNumber: string;
  start: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    customParameters: Record<string, string>;
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
  };
  streamSid: string;
}

export interface TwilioMediaPayload {
  event: 'media';
  sequenceNumber: string;
  media: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string; // Base64 encoded audio
  };
  streamSid: string;
}

export interface TwilioMediaMark {
  event: 'mark';
  sequenceNumber: string;
  mark: {
    name: string;
  };
  streamSid: string;
}

export interface TwilioMediaStop {
  event: 'stop';
  sequenceNumber: string;
  stop: {
    accountSid: string;
    callSid: string;
  };
  streamSid: string;
}

export type TwilioMediaEvent = 
  | TwilioMediaStart 
  | TwilioMediaPayload 
  | TwilioMediaMark 
  | TwilioMediaStop
  | { event: 'connected'; protocol: string; version: string };

// WebSocket message types for dashboard
export interface CallUpdateMessage {
  type: 'call:update';
  data: {
    callId: string;
    status: string;
    duration?: number;
    transcript?: string;
  };
}

export interface CallTranscriptMessage {
  type: 'call:transcript';
  data: {
    callId: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  };
}

export type DashboardMessage = CallUpdateMessage | CallTranscriptMessage;
