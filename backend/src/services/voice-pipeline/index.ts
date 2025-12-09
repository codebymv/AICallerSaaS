// ============================================
// Voice Pipeline - Orchestrates STT -> LLM -> TTS
// ============================================

import { EventEmitter } from 'events';
import { DeepgramSTTService, TranscriptEvent } from '../stt/deepgram.service';
import { OpenAIService, CALENDAR_TOOLS, ToolCall } from '../llm/openai.service';
import { ElevenLabsService } from '../tts/elevenlabs.service';
import { CalendlyService } from '../calendar/calendly.service';
import { MetricsTracker } from '../../utils/metrics';
import { logger } from '../../utils/logger';
import { Agent } from '@prisma/client';
import { getElevenLabsVoiceId } from '../../lib/constants';
import { decrypt } from '../../utils/crypto';

export interface CalendarIntegration {
  accessToken: string;
  calendlyUserUri: string | null;
  calendlyEventTypeUri: string | null;
  timezone: string;
}

export interface PipelineConfig {
  agent: Agent;
  callDirection?: string;
  calendarIntegration?: CalendarIntegration | null;
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
  private calendlyService: CalendlyService | null = null;

  private messages: ConversationMessage[] = [];
  private isProcessing = false;
  private pendingTranscript = '';
  private state: 'listening' | 'processing' | 'speaking' = 'listening';
  private interruptionEnabled: boolean;
  private interrupted = false;
  private hasCalendarAccess = false;

  constructor(config: PipelineConfig, callSid: string) {
    super();
    this.config = config;
    this.stt = new DeepgramSTTService();
    this.llm = new OpenAIService();
    this.tts = new ElevenLabsService();
    this.metrics = new MetricsTracker(callSid);
    this.interruptionEnabled = config.agent.interruptible;

    // Initialize calendar service if integration is available AND agent has calendar enabled
    if (
      config.agent.calendarEnabled && 
      config.calendarIntegration?.accessToken && 
      config.calendarIntegration?.calendlyEventTypeUri
    ) {
      try {
        const decryptedToken = decrypt(config.calendarIntegration.accessToken);
        this.calendlyService = new CalendlyService(
          decryptedToken,
          config.calendarIntegration.timezone
        );
        this.hasCalendarAccess = true;
        logger.info('[Pipeline] Calendar integration enabled for agent:', config.agent.name);
      } catch (error) {
        logger.error('[Pipeline] Failed to initialize calendar service:', error);
      }
    } else if (config.calendarIntegration?.accessToken && !config.agent.calendarEnabled) {
      logger.info('[Pipeline] Calendar integration available but disabled for agent:', config.agent.name);
    }

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
      logger.info('[Pipeline] Utterance end detected, pending: ' + this.pendingTranscript.trim());
      if (this.pendingTranscript.trim() && !this.isProcessing) {
        await this.processUserInput(this.pendingTranscript.trim());
        this.pendingTranscript = '';
      } else {
        logger.info(`[Pipeline] Skipping processing - isProcessing: ${this.isProcessing}, pending empty: ${!this.pendingTranscript.trim()}`);
      }
    });

    this.stt.on('error', (error) => {
      this.config.onError(error);
    });
  }

  async start(): Promise<void> {
    console.log('[Pipeline] start() called');
    console.log('[Pipeline] Call direction:', this.config.callDirection);
    
    console.log('[Pipeline] Starting Deepgram STT...');
    await this.stt.startStream();
    console.log('[Pipeline] ✅ Deepgram STT started');

    // Determine which greeting to use based on call direction
    let greeting = this.config.agent.greeting;
    if (this.config.callDirection === 'outbound' && this.config.agent.outboundGreeting) {
      greeting = this.config.agent.outboundGreeting;
      console.log('[Pipeline] Using outbound greeting');
    } else {
      console.log('[Pipeline] Using regular greeting');
    }
    
    console.log('[Pipeline] Greeting:', greeting);

    // Send greeting if configured
    if (greeting) {
      console.log('[Pipeline] Generating greeting audio...');
      await this.generateAndSendAudio(greeting);
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

    logger.info('[Pipeline] Processing user input:', text);
    logger.info('[Pipeline] Calendar access:', this.hasCalendarAccess);

    try {
      // Add user message
      this.messages.push({
        role: 'user',
        content: text,
        timestamp: Date.now(),
      });

      let fullResponse = '';

      // If calendar access is enabled, use tool-calling approach
      if (this.hasCalendarAccess && this.calendlyService) {
        logger.info('[Pipeline] Using tool-calling approach');
        fullResponse = await this.processWithTools();
      } else {
        // Standard streaming response without tools
        logger.info('[Pipeline] Using standard streaming approach');
        fullResponse = await this.processWithStreaming();
      }

      logger.info('[Pipeline] Response generated:', fullResponse?.substring(0, 100) || 'EMPTY');

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

  /**
   * Process user input with function calling for calendar access
   */
  private async processWithTools(): Promise<string> {
    const llmStart = Date.now();
    logger.info('[Pipeline] processWithTools started');
    
    // Enhance system prompt with current date context
    const today = new Date();
    const timezone = this.config.calendarIntegration?.timezone || 'America/New_York';
    
    // Get event type name if available for context
    const eventTypeContext = this.config.calendarIntegration?.eventTypeName 
      ? `\n\nAvailable appointment type: ${this.config.calendarIntegration.eventTypeName}`
      : '';
    
    const enhancedPrompt = `${this.config.agent.systemPrompt}

Current date and time: ${today.toLocaleDateString('en-US', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})} at ${today.toLocaleTimeString('en-US', { 
  hour: 'numeric', 
  minute: '2-digit', 
  hour12: true,
  timeZone: timezone
})} (${timezone} timezone)
${eventTypeContext}

IMPORTANT CALENDAR INSTRUCTIONS:
- You have access to a REAL calendar booking system.
- When a caller asks about scheduling, availability, or appointments, you MUST use the check_calendar_availability tool to look up actual available time slots.
- Do NOT make up or guess available times - always check the calendar first.
- Use book_appointment to confirm bookings after collecting: name, email (optional), and preferred time.
- If the caller asks "what times are available" or similar, call check_calendar_availability with today's date or the date they mention.`;

    logger.info('[Pipeline] Calling LLM with tools...');
    
    // First, try to get a response with potential tool calls
    const response = await this.llm.generateResponseWithTools(
      this.messages.map((m) => ({ role: m.role, content: m.content })),
      enhancedPrompt,
      CALENDAR_TOOLS,
      0.7,
      300
    );

    logger.info('[Pipeline] LLM response:', { hasContent: !!response.content, hasToolCalls: !!response.toolCalls?.length });

    // If there are tool calls, execute them
    if (response.toolCalls && response.toolCalls.length > 0) {
      logger.info('[Pipeline] Tool calls detected:', response.toolCalls.map(tc => tc.name));
      
      for (const toolCall of response.toolCalls) {
        const toolResult = await this.executeToolCall(toolCall);
        
        logger.info('[Pipeline] Tool result:', toolResult.substring(0, 100));
        
        // Get natural language response incorporating tool results
        const naturalResponse = await this.llm.continueAfterToolCall(
          this.messages.map((m) => ({ role: m.role, content: m.content })),
          enhancedPrompt,
          toolCall, // Pass full toolCall object
          toolResult,
          0.7,
          200
        );

        if (naturalResponse && !this.interrupted) {
          await this.generateAndSendAudio(naturalResponse);
          this.metrics.mark('llm_complete');
          return naturalResponse;
        }
      }
    }

    // If no tool calls, just use the content response
    if (response.content && !this.interrupted) {
      await this.generateAndSendAudio(response.content);
      this.metrics.mark('llm_complete');
      return response.content;
    }

    return '';
  }

  /**
   * Execute a tool call and return the result
   */
  private async executeToolCall(toolCall: ToolCall): Promise<string> {
    logger.info(`[Pipeline] Executing tool: ${toolCall.name}`, toolCall.arguments);

    try {
      switch (toolCall.name) {
        case 'check_calendar_availability': {
          const { date } = toolCall.arguments;
          
          if (!this.calendlyService || !this.config.calendarIntegration?.calendlyEventTypeUri) {
            return 'Calendar is not properly configured. Please collect preferred times and let them know someone will confirm.';
          }

          const slots = await this.calendlyService.getAvailableSlots(
            this.config.calendarIntegration.calendlyEventTypeUri,
            date
          );

          if (slots.length === 0) {
            return `No available time slots found for ${date}. You may want to suggest checking another date.`;
          }

          // Format slots for the AI to speak naturally
          const formattedSlots = this.calendlyService.formatSlotsForVoice(slots, 5);
          return formattedSlots;
        }

        case 'book_appointment': {
          const { datetime, name, email, phone, notes } = toolCall.arguments;
          
          if (!this.calendlyService || !this.config.calendarIntegration?.calendlyEventTypeUri) {
            return 'Calendar is not properly configured. Appointment details collected but booking could not be completed automatically.';
          }

          // For now, Calendly doesn't have a direct booking API
          // We'll create a single-use scheduling link instead
          try {
            const bookingUrl = await this.calendlyService.createSingleUseLink(
              this.config.calendarIntegration.calendlyEventTypeUri
            );
            
            // In a real implementation, you might send this link via SMS
            return `Appointment request received for ${name} at the requested time. A confirmation link will be sent to complete the booking. The booking details: Name: ${name}, Time: ${datetime}${email ? `, Email: ${email}` : ''}${phone ? `, Phone: ${phone}` : ''}.`;
          } catch (error) {
            logger.error('[Pipeline] Booking error:', error);
            return `I've collected the appointment details for ${name} at ${datetime}. Someone from our team will confirm the appointment shortly.`;
          }
        }

        default:
          return `Unknown tool: ${toolCall.name}`;
      }
    } catch (error) {
      logger.error(`[Pipeline] Tool execution error (${toolCall.name}):`, error);
      return `I encountered an issue checking availability. Let me collect your preferred times and someone will confirm.`;
    }
  }

  /**
   * Standard streaming response without tools
   */
  private async processWithStreaming(): Promise<string> {
    logger.info('[Pipeline] processWithStreaming started');
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

    return fullResponse;
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
      
      // Use Twilio-optimized TTS (ElevenLabs outputs ulaw_8000 directly!)
      console.log('[Pipeline] Requesting ulaw_8000 audio from ElevenLabs (native Twilio format)');
      const audioBuffer = await this.tts.textToSpeechForTwilio(
        text,
        elevenLabsVoiceId,
        {
          stability: voiceSettings?.stability ?? 0.5,
          similarity_boost: voiceSettings?.similarityBoost ?? 0.75,
        }
      );

      console.log('[Pipeline] ✅ TTS generated, ulaw_8000 buffer size:', audioBuffer.length, 'bytes');
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
