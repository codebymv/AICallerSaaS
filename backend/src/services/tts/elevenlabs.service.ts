// ============================================
// ElevenLabs TTS Service - Text to Speech
// ============================================

import { ElevenLabsClient } from 'elevenlabs';
import { Readable } from 'stream';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export class ElevenLabsService {
  private client: ElevenLabsClient;

  constructor() {
    this.client = new ElevenLabsClient({
      apiKey: config.elevenlabsApiKey,
    });
  }

  async textToSpeech(
    text: string,
    voiceId: string = 'EXAVITQu4vr4xnSDxMaL',
    settings?: VoiceSettings
  ): Promise<Buffer> {
    try {
      const response = await this.client.textToSpeech.convert(voiceId, {
        model_id: 'eleven_turbo_v2_5',
        output_format: 'mp3_44100_128',
        text,
        voice_settings: {
          stability: settings?.stability ?? 0.5,
          similarity_boost: settings?.similarity_boost ?? 0.75,
        },
      });

      const readableStream = Readable.from(response);
      const audioArrayBuffer = await this.streamToArrayBuffer(readableStream);
      
      return Buffer.from(audioArrayBuffer);
    } catch (error) {
      logger.error('[ElevenLabs] TTS error:', error);
      throw error;
    }
  }

  /**
   * Generate TTS optimized for Twilio (mulaw 8kHz)
   * Uses ElevenLabs SDK - matches their official Twilio integration example
   */
  async textToSpeechForTwilio(
    text: string,
    voiceId: string = 'EXAVITQu4vr4xnSDxMaL',
    settings?: VoiceSettings
  ): Promise<Buffer> {
    try {
      console.log('[ElevenLabs] Using SDK to generate audio for Twilio');
      
      // Use ElevenLabs SDK (matching their official Twilio example)
      const response = await this.client.textToSpeech.convert(voiceId, {
        model_id: 'eleven_flash_v2_5',
        output_format: 'ulaw_8000',
        text,
        voice_settings: {
          stability: settings?.stability ?? 0.5,
          similarity_boost: settings?.similarity_boost ?? 0.75,
        },
      });

      // Convert stream to buffer (matching ElevenLabs example)
      const readableStream = Readable.from(response);
      const audioArrayBuffer = await this.streamToArrayBuffer(readableStream);
      
      return Buffer.from(audioArrayBuffer);
    } catch (error) {
      logger.error('[ElevenLabs] TTS for Twilio error:', error);
      throw error;
    }
  }

  /**
   * Convert readable stream to ArrayBuffer (from ElevenLabs example)
   */
  private streamToArrayBuffer(readableStream: Readable): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      readableStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      readableStream.on('end', () => {
        resolve(Buffer.concat(chunks).buffer);
      });

      readableStream.on('error', reject);
    });
  }

  async getVoices(): Promise<any[]> {
    try {
      const response = await this.client.voices.getAll();
      return response.voices;
    } catch (error) {
      logger.error('[ElevenLabs] Get voices error:', error);
      throw error;
    }
  }

  /**
   * Calculate approximate cost
   * ~$0.30 per 1000 characters for turbo model
   */
  calculateCost(characterCount: number): number {
    return (characterCount / 1000) * 0.3;
  }
}
