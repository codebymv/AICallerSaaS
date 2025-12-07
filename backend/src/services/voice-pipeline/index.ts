// ============================================
// Voice Pipeline - Orchestrates STT -> LLM -> TTS
// ============================================

import { EventEmitter } from 'events';
import { DeepgramSTTService, TranscriptEvent } from '../stt/deepgram.service';
import { OpenAIService } from '../llm/openai.service';
import { ElevenLabsService } from '../tts/elevenlabs.service';
import { MetricsTracker } from '../../utils/metrics';
import { logger } from '../../utils/logger';
import { Agent } from '@prisma/client';
import { getElevenLabsVoiceId } from '../../lib/constants';

export interface PipelineConfig {
  agent: Agent;
  onTranscript: (text: string, isFinal: boolean, speaker: 'user' | 'agent') => void;
  onAudio: (audio: Buffer) => void;
  onError: (error: Error) => void;
  onLatencyMetrics: (metrics: { stt: number; llm: number; tts: number; total: number }) => void;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export class VoicePipeline extends EventEmitter {
  private stt: DeepgramSTTService;
  private llm: OpenAIService;
  private tts: ElevenLabsService;
  private metrics: MetricsTracker;
  private config: PipelineConfig;

  private messages: ConversationMessage[] = [];
  private isProcessing = false;
  private pendingTranscript = '';
  private state: 'listening' | 'processing' | 'speaking' = 'listening';
  private interruptionEnabled: boolean;
  private interrupted = false;

  constructor(config: PipelineConfig, callSid: string) {
    super();
    this.config = config;
    this.stt = new DeepgramSTTService();
    this.llm = new OpenAIService();
    this.tts = new ElevenLabsService();
    this.metrics = new MetricsTracker(callSid);
    this.interruptionEnabled = config.agent.interruptible;

    this.setupSTTHandlers();
  }

  private setupSTTHandlers(): void {
    this.stt.on('transcript', async (event: TranscriptEvent) => {
      this.metrics.mark('transcript_ready');
      
      // Emit transcript to client
      this.config.onTranscript(event.text, event.isFinal, 'user');

      // Handle interruption
      if (this.state === 'speaking' && this.interruptionEnabled) {
        logger.debug('[Pipeline] User interrupted, stopping TTS');
        this.interrupted = true;
        this.state = 'listening';
        this.emit('interrupt');
      }

      if (event.isFinal) {
        this.pendingTranscript += ' ' + event.text;
      }
    });

    this.stt.on('utterance_end', async () => {
      if (this.pendingTranscript.trim() && !this.isProcessing) {
        await this.processUserInput(this.pendingTranscript.trim());
        this.pendingTranscript = '';
      }
    });

    this.stt.on('error', (error) => {
      this.config.onError(error);
    });
  }

  async start(): Promise<void> {
    console.log('[Pipeline] start() called');
    console.log('[Pipeline] Agent greeting:', this.config.agent.greeting);
    
    console.log('[Pipeline] Starting Deepgram STT...');
    await this.stt.startStream();
    console.log('[Pipeline] ✅ Deepgram STT started');

    // Send greeting if configured
    if (this.config.agent.greeting) {
      console.log('[Pipeline] Generating greeting audio...');
      await this.generateAndSendAudio(this.config.agent.greeting);
      console.log('[Pipeline] ✅ Greeting sent');
    } else {
      console.log('[Pipeline] ⚠️ No greeting configured');
    }
  }

  async processAudio(audioData: Buffer): Promise<void> {
    this.metrics.mark('audio_received');
    this.stt.sendAudio(audioData);
  }

  private async processUserInput(text: string): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.state = 'processing';
    this.interrupted = false;

    try {
      // Add user message
      this.messages.push({
        role: 'user',
        content: text,
        timestamp: Date.now(),
      });

      // Generate LLM response with streaming
      const llmStart = Date.now();
      let fullResponse = '';

      // Use sentence-based streaming for lower latency
      for await (const { sentence, isComplete } of this.llm.streamSentences(
        this.messages.map((m) => ({ role: m.role, content: m.content })),
        this.config.agent.systemPrompt,
        0.7, // temperature
        150  // maxTokens
      )) {
        if (this.interrupted) {
          logger.debug('[Pipeline] Processing interrupted');
          break;
        }

        fullResponse += sentence + ' ';
        this.metrics.mark('llm_complete');

        // Start TTS for this sentence immediately
        await this.generateAndSendAudio(sentence);
      }

      // Add assistant message
      if (fullResponse.trim()) {
        this.messages.push({
          role: 'assistant',
          content: fullResponse.trim(),
          timestamp: Date.now(),
        });
        this.config.onTranscript(fullResponse.trim(), true, 'agent');
      }

      // Report latency metrics
      const metrics = this.metrics.getLatencyMetrics();
      this.config.onLatencyMetrics(metrics);
      logger.debug('[Pipeline] Latency metrics:', metrics);

    } catch (error) {
      logger.error('[Pipeline] Process error:', error);
      this.config.onError(error as Error);
    } finally {
      this.isProcessing = false;
      this.state = 'listening';
    }
  }

  private async generateAndSendAudio(text: string): Promise<void> {
    if (!text.trim()) {
      console.log('[Pipeline] generateAndSendAudio: text is empty, skipping');
      return;
    }

    try {
      this.state = 'speaking';
      const ttsStart = Date.now();

      console.log('[Pipeline] Generating TTS for text:', text.substring(0, 50) + '...');
      
      // Generate TTS audio
      const voiceSettings = this.config.agent.voiceSettings as any;
      // Map friendly voice name to actual ElevenLabs voice ID
      const elevenLabsVoiceId = getElevenLabsVoiceId(this.config.agent.voice);
      
      console.log('[Pipeline] Using voice:', this.config.agent.voice, '-> ElevenLabs ID:', elevenLabsVoiceId);
      
      const audioBuffer = await this.tts.textToSpeech(
        text,
        elevenLabsVoiceId,
        {
          stability: voiceSettings?.stability ?? 0.5,
          similarity_boost: voiceSettings?.similarityBoost ?? 0.75,
        }
      );

      console.log('[Pipeline] ✅ TTS generated, buffer size:', audioBuffer.length);
      this.metrics.mark('audio_sent');

      // Send audio to client (if not interrupted)
      if (!this.interrupted) {
        console.log('[Pipeline] Sending audio to client via onAudio callback');
        this.config.onAudio(audioBuffer);
      } else {
        console.log('[Pipeline] ⚠️ Audio generation interrupted, not sending');
      }

    } catch (error) {
      console.error('[Pipeline] ❌ TTS error:', error);
      logger.error('[Pipeline] TTS error:', error);
      // Continue without audio on error
    }
  }

  async stop(): Promise<void> {
    await this.stt.close();
    this.removeAllListeners();
  }

  getMessages(): ConversationMessage[] {
    return [...this.messages];
  }

  getState(): string {
    return this.state;
  }
}
