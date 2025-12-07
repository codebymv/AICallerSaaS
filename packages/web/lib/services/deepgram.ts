import { createClient, LiveTranscriptionEvents, LiveClient } from '@deepgram/sdk';

export class DeepgramService {
  private client;
  
  constructor() {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY is not set');
    }
    this.client = createClient(apiKey);
  }
  
  async createLiveTranscription(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError?: (error: any) => void
  ): Promise<LiveClient> {
    const connection = this.client.listen.live({
      model: 'nova-2',
      language: 'en-US',
      smart_format: true,
      interim_results: true,
      utterance_end_ms: 1000,
      vad_events: true,
      punctuate: true,
    });
    
    connection.on(LiveTranscriptionEvents.Open, () => {
      console.log('[Deepgram] Connection opened');
    });
    
    connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      const isFinal = data.is_final ?? false;
      
      if (transcript && transcript.length > 0) {
        onTranscript(transcript, isFinal);
      }
    });
    
    connection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('[Deepgram] Error:', error);
      if (onError) onError(error);
    });
    
    connection.on(LiveTranscriptionEvents.Close, () => {
      console.log('[Deepgram] Connection closed');
    });
    
    return connection;
  }
  
  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      const { result, error } = await this.client.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-2',
          smart_format: true,
          punctuate: true,
        }
      );
      
      if (error) {
        throw error;
      }
      
      const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
      return transcript || '';
    } catch (error) {
      console.error('[Deepgram] Transcription error:', error);
      throw error;
    }
  }
}
