// ============================================
// ElevenLabs TTS Service - Text to Speech
// ============================================

import { ElevenLabsClient } from 'elevenlabs';
import { Readable } from 'stream';
import { WebSocket } from 'ws';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface AudioChunk {
  audio: Buffer;
  isFinal: boolean;
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
   * Stream TTS via WebSocket for ultra-low latency
   * Yields audio chunks as they're generated (don't wait for full audio)
   * 
   * @param text - Text to convert to speech
   * @param voiceId - ElevenLabs voice ID
   * @param settings - Voice settings
   * @param onChunk - Callback for each audio chunk (for immediate streaming to Twilio)
   * @returns Total audio buffer and duration
   */
  async streamTTSForTwilio(
    text: string,
    voiceId: string,
    settings: VoiceSettings | undefined,
    onChunk: (chunk: Buffer) => void
  ): Promise<{ totalBuffer: Buffer; durationMs: number }> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      
      const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=eleven_flash_v2_5&output_format=ulaw_8000`;
      
      console.log('[ElevenLabs] Opening WebSocket stream...');
      
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        console.log('[ElevenLabs] WebSocket connected, sending init message');
        
        // Send initialization message with voice settings
        const initMessage = {
          text: ' ', // Initial space to start the stream
          voice_settings: {
            stability: settings?.stability ?? 0.5,
            similarity_boost: settings?.similarity_boost ?? 0.75,
          },
          xi_api_key: config.elevenlabsApiKey,
        };
        ws.send(JSON.stringify(initMessage));
        
        // Send the actual text
        const textMessage = {
          text: text,
          try_trigger_generation: true,
        };
        ws.send(JSON.stringify(textMessage));
        
        // Signal end of input
        ws.send(JSON.stringify({ text: '' }));
      });
      
      ws.on('message', (data: Buffer | string) => {
        try {
          const response = JSON.parse(data.toString());
          
          if (response.audio) {
            // Decode base64 audio chunk
            const audioChunk = Buffer.from(response.audio, 'base64');
            chunks.push(audioChunk);
            totalBytes += audioChunk.length;
            
            // Stream chunk immediately to Twilio
            onChunk(audioChunk);
            
            console.log(`[ElevenLabs] Streamed chunk: ${audioChunk.length} bytes (total: ${totalBytes})`);
          }
          
          if (response.isFinal) {
            console.log('[ElevenLabs] Received final message');
          }
        } catch (error) {
          // Might be binary data, ignore parse errors
        }
      });
      
      ws.on('close', () => {
        console.log(`[ElevenLabs] WebSocket closed. Total: ${totalBytes} bytes`);
        
        const totalBuffer = Buffer.concat(chunks);
        const durationMs = Math.ceil((totalBuffer.length / 8000) * 1000);
        
        resolve({ totalBuffer, durationMs });
      });
      
      ws.on('error', (error) => {
        logger.error('[ElevenLabs] WebSocket error:', error);
        reject(error);
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }, 10000);
    });
  }

  /**
   * Calculate approximate cost
   * ~$0.30 per 1000 characters for turbo model
   */
  calculateCost(characterCount: number): number {
    return (characterCount / 1000) * 0.3;
  }
}
