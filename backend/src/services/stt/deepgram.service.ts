// ============================================
// Deepgram STT Service - Real-time Transcription
// ============================================

import { createClient, LiveTranscriptionEvents, LiveClient } from '@deepgram/sdk';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

export interface TranscriptEvent {
  text: string;
  isFinal: boolean;
  confidence: number;
  timestamp: number;
}

export class DeepgramSTTService extends EventEmitter {
  private client;
  private connection: LiveClient | null = null;

  constructor() {
    super();
    this.client = createClient(config.deepgramApiKey);
  }

  async startStream(): Promise<void> {
    try {
      this.connection = this.client.listen.live({
        model: 'nova-2',
        language: 'en-US',
        encoding: 'mulaw',
        sample_rate: 8000,
        channels: 1,
        smart_format: true,
        interim_results: true,
        utterance_end_ms: 1500,     // Increased from 1000 - more time for natural pauses
        vad_events: true,
        endpointing: 500,           // Increased from 300 - less aggressive cutoff
        punctuate: true,
      });

      this.connection.on(LiveTranscriptionEvents.Open, () => {
        logger.debug('[Deepgram] Connection opened');
        this.emit('open');
      });

      this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        const confidence = data.channel?.alternatives?.[0]?.confidence || 0;
        const isFinal = data.is_final ?? false;

        if (transcript && transcript.length > 0) {
          const event: TranscriptEvent = {
            text: transcript,
            isFinal,
            confidence,
            timestamp: Date.now(),
          };
          this.emit('transcript', event);
        }
      });

      this.connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
        this.emit('utterance_end');
      });

      this.connection.on(LiveTranscriptionEvents.SpeechStarted, () => {
        this.emit('speech_started');
      });

      this.connection.on(LiveTranscriptionEvents.Error, (error) => {
        logger.error('[Deepgram] Error:', error);
        this.emit('error', error);
      });

      this.connection.on(LiveTranscriptionEvents.Close, () => {
        logger.debug('[Deepgram] Connection closed');
        this.emit('close');
      });

    } catch (error) {
      logger.error('[Deepgram] Start stream error:', error);
      throw error;
    }
  }

  sendAudio(audioData: Buffer): void {
    if (this.connection) {
      // Send raw buffer - Deepgram SDK handles the conversion
      this.connection.send(audioData.buffer.slice(
        audioData.byteOffset,
        audioData.byteOffset + audioData.byteLength
      ));
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      this.connection.finish();
      this.connection = null;
    }
  }

  isConnected(): boolean {
    return this.connection !== null;
  }
}
