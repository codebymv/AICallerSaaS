// ============================================
// ElevenLabs TTS Service - Text to Speech
// ============================================

import axios from 'axios';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { pcmToMulaw } from '../../utils/audio';

export interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor() {
    this.apiKey = config.elevenlabsApiKey;
  }

  async textToSpeech(
    text: string,
    voiceId: string = 'EXAVITQu4vr4xnSDxMaL',
    settings?: VoiceSettings
  ): Promise<Buffer> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        {
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: settings?.stability ?? 0.5,
            similarity_boost: settings?.similarity_boost ?? 0.75,
            style: settings?.style ?? 0,
            use_speaker_boost: settings?.use_speaker_boost ?? true,
          },
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          responseType: 'arraybuffer',
        }
      );

      return Buffer.from(response.data);
    } catch (error) {
      logger.error('[ElevenLabs] TTS error:', error);
      throw error;
    }
  }

  /**
   * Generate TTS optimized for Twilio (mulaw 8kHz)
   */
  async textToSpeechForTwilio(
    text: string,
    voiceId: string = 'EXAVITQu4vr4xnSDxMaL',
    settings?: VoiceSettings
  ): Promise<Buffer> {
    try {
      // Request PCM audio for better conversion
      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        {
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: settings?.stability ?? 0.5,
            similarity_boost: settings?.similarity_boost ?? 0.75,
          },
          output_format: 'pcm_16000', // 16kHz PCM
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        }
      );

      // Convert to mulaw 8kHz for Twilio
      // Note: In production, use ffmpeg or similar for proper resampling
      const pcmBuffer = Buffer.from(response.data);
      return pcmToMulaw(pcmBuffer);
    } catch (error) {
      logger.error('[ElevenLabs] TTS for Twilio error:', error);
      throw error;
    }
  }

  /**
   * Stream TTS for lower latency
   */
  async *streamTextToSpeech(
    text: string,
    voiceId: string = 'EXAVITQu4vr4xnSDxMaL',
    settings?: VoiceSettings
  ): AsyncGenerator<Buffer, void, unknown> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}/stream`,
        {
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: settings?.stability ?? 0.5,
            similarity_boost: settings?.similarity_boost ?? 0.75,
          },
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          responseType: 'stream',
        }
      );

      for await (const chunk of response.data) {
        yield Buffer.from(chunk);
      }
    } catch (error) {
      logger.error('[ElevenLabs] Streaming error:', error);
      throw error;
    }
  }

  async getVoices(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });
      return response.data.voices;
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
