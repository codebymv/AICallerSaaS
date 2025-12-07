import axios from 'axios';

export class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  
  constructor() {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not set');
    }
    this.apiKey = apiKey;
  }
  
  async textToSpeech(text: string, voiceId: string = 'rachel'): Promise<Buffer> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        {
          text,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        }
      );
      
      return Buffer.from(response.data);
    } catch (error) {
      console.error('[ElevenLabs] TTS error:', error);
      throw error;
    }
  }
  
  async streamTextToSpeech(
    text: string,
    voiceId: string,
    onAudioChunk: (chunk: Buffer) => void
  ): Promise<void> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}/stream`,
        {
          text,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
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
      
      response.data.on('data', (chunk: Buffer) => {
        onAudioChunk(chunk);
      });
      
      return new Promise((resolve, reject) => {
        response.data.on('end', resolve);
        response.data.on('error', reject);
      });
    } catch (error) {
      console.error('[ElevenLabs] Streaming error:', error);
      throw error;
    }
  }
  
  async getVoices() {
    try {
      const response = await axios.get(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });
      
      return response.data.voices;
    } catch (error) {
      console.error('[ElevenLabs] Get voices error:', error);
      throw error;
    }
  }
  
  calculateCost(characterCount: number): number {
    // $0.30 per 1000 characters
    return (characterCount / 1000) * 0.30;
  }
}
