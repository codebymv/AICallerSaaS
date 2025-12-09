// ============================================
// Voice Pipeline - Orchestrates STT -> LLM -> TTS
// ============================================

import { EventEmitter } from 'events';
import { DeepgramSTTService, TranscriptEvent } from '../stt/deepgram.service';
import { OpenAIService, CALENDAR_TOOLS, ToolCall } from '../llm/openai.service';
import { ElevenLabsService } from '../tts/elevenlabs.service';
import { CalendlyService } from '../calendar/calendly.service';
import { CalComService } from '../calendar/calcom.service';
import { MetricsTracker } from '../../utils/metrics';
import { logger } from '../../utils/logger';
import { Agent } from '@prisma/client';
import { getElevenLabsVoiceId } from '../../lib/constants';
import { decrypt } from '../../utils/crypto';

export interface CalendarIntegration {
  provider: 'calendly' | 'calcom';
  // Calendly fields
  accessToken?: string;
  calendlyUserUri?: string | null;
  calendlyEventTypeUri?: string | null;
  // Cal.com fields
  calcomApiKey?: string;
  calcomEventTypeId?: number | null;
  calcomEventTypeName?: string | null;
  // Common fields
  eventTypeName?: string | null;
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
  private calcomService: CalComService | null = null;

  private messages: ConversationMessage[] = [];
  private isProcessing = false;
  private pendingTranscript = '';
  private state: 'listening' | 'processing' | 'speaking' = 'listening';
  private interruptionEnabled: boolean;
  private interrupted = false;
  private hasCalendarAccess = false;
  private calendarProvider: 'calendly' | 'calcom' | null = null;

  constructor(config: PipelineConfig, callSid: string) {
    super();
    this.config = config;
    this.stt = new DeepgramSTTService();
    this.llm = new OpenAIService();
    this.tts = new ElevenLabsService();
    this.metrics = new MetricsTracker(callSid);
    this.interruptionEnabled = config.agent.interruptible;

    // Initialize calendar service based on provider
    if (config.agent.calendarEnabled && config.calendarIntegration) {
      const integration = config.calendarIntegration;
      
      if (integration.provider === 'calcom' && integration.calcomApiKey && integration.calcomEventTypeId) {
        // Cal.com integration (supports direct booking!)
        try {
          const decryptedApiKey = decrypt(integration.calcomApiKey);
          this.calcomService = new CalComService(decryptedApiKey, integration.timezone);
          this.hasCalendarAccess = true;
          this.calendarProvider = 'calcom';
          logger.info('[Pipeline] Cal.com integration enabled for agent:', config.agent.name);
        } catch (error) {
          logger.error('[Pipeline] Failed to initialize Cal.com service:', error);
        }
      } else if (integration.provider === 'calendly' && integration.accessToken && integration.calendlyEventTypeUri) {
        // Calendly integration (availability check only)
        try {
          const decryptedToken = decrypt(integration.accessToken);
          this.calendlyService = new CalendlyService(decryptedToken, integration.timezone);
          this.hasCalendarAccess = true;
          this.calendarProvider = 'calendly';
          logger.info('[Pipeline] Calendly integration enabled for agent:', config.agent.name);
        } catch (error) {
          logger.error('[Pipeline] Failed to initialize Calendly service:', error);
        }
      }
    } else if (config.calendarIntegration && !config.agent.calendarEnabled) {
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
      if (this.hasCalendarAccess && (this.calendlyService || this.calcomService)) {
        logger.info('[Pipeline] Using tool-calling approach (provider: ' + this.calendarProvider + ')');
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
- CRITICAL: When booking, the datetime MUST include the timezone offset. For example: "2025-12-10T17:40:00-07:00" (for Phoenix time). Do NOT use just "10:40" - you must use the full ISO 8601 format with timezone.
- Use book_appointment to confirm bookings after collecting: name, email (REQUIRED), and preferred time.
- If the caller asks "what times are available" or similar, call check_calendar_availability with today's date or the date they mention.
- You MUST collect the caller's email address before booking - it is required for confirmation.
- After booking, confirm the appointment details with the caller.`;

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
          
          // Cal.com provider
          if (this.calendarProvider === 'calcom' && this.calcomService) {
            const eventTypeId = this.config.calendarIntegration?.calcomEventTypeId;
            if (!eventTypeId) {
              return 'Calendar is not properly configured. Please collect preferred times and let them know someone will confirm.';
            }

            const slots = await this.calcomService.getAvailableSlots(eventTypeId, date);

            if (slots.length === 0) {
              return `No available time slots found for ${date}. You may want to suggest checking another date.`;
            }

            const formattedSlots = this.calcomService.formatSlotsForVoice(slots, 5);
            return formattedSlots;
          }
          
          // Calendly provider (fallback)
          if (this.calendarProvider === 'calendly' && this.calendlyService) {
            const eventTypeUri = this.config.calendarIntegration?.calendlyEventTypeUri;
            if (!eventTypeUri) {
              return 'Calendar is not properly configured. Please collect preferred times and let them know someone will confirm.';
            }

            const slots = await this.calendlyService.getAvailableSlots(eventTypeUri, date);

            if (slots.length === 0) {
              return `No available time slots found for ${date}. You may want to suggest checking another date.`;
            }

            const formattedSlots = this.calendlyService.formatSlotsForVoice(slots, 5);
            return formattedSlots;
          }

          return 'Calendar is not properly configured. Please collect preferred times and let them know someone will confirm.';
        }

        case 'book_appointment': {
          const { datetime, name, email, phone, notes } = toolCall.arguments;
          
          // Cal.com provider - DIRECT BOOKING!
          if (this.calendarProvider === 'calcom' && this.calcomService) {
            const eventTypeId = this.config.calendarIntegration?.calcomEventTypeId;
            if (!eventTypeId) {
              return 'Calendar is not properly configured. Appointment details collected but booking could not be completed automatically.';
            }

            // Email is required for Cal.com
            if (!email) {
              return 'I need an email address to complete the booking. Could you please provide your email?';
            }

            // Clean up email from common transcription errors
            // "code by mv at gmail dot com" -> "codebymv@gmail.com"
            let cleanedEmail = email
              .toLowerCase()
              .replace(/\s+at\s+/gi, '@')      // " at " -> "@"
              .replace(/\s+dot\s+/gi, '.')     // " dot " -> "."
              .replace(/\s/g, '')               // Remove all remaining spaces
              .trim();
            
            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(cleanedEmail)) {
              logger.warn('[Pipeline] Invalid email after cleaning:', { original: email, cleaned: cleanedEmail });
              return `The email address "${email}" doesn't appear to be valid. Could you please spell out your email address clearly?`;
            }

            logger.info('[Pipeline] Email cleaned:', { original: email, cleaned: cleanedEmail });

            try {
              // Format datetime for Cal.com API
              const formattedDatetime = this.calcomService.formatDateTimeForApi(datetime);
              
              const booking = await this.calcomService.createBooking({
                eventTypeId,
                start: formattedDatetime,
                name,
                email: cleanedEmail,
                timeZone: this.config.calendarIntegration?.timezone,
                notes: notes || (phone ? `Phone: ${phone}` : undefined),
              });

              logger.info('[Pipeline] Cal.com booking created:', booking.uid);
              
              // Return success message with confirmation details
              return `Appointment successfully booked for ${name} on ${new Date(booking.startTime).toLocaleString('en-US', {
                timeZone: this.config.calendarIntegration?.timezone,
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}. A confirmation email has been sent to ${cleanedEmail}. Booking reference: ${booking.uid.substring(0, 8)}.`;
            } catch (error: any) {
              logger.error('[Pipeline] Cal.com booking error:', error);
              
              // Parse the error for more helpful responses
              const errorMessage = error?.message || '';
              
              if (errorMessage.includes('already has booking') || errorMessage.includes('not available')) {
                return `I'm sorry, but that time slot is no longer available. Would you like me to check for other available times?`;
              }
              
              if (errorMessage.includes('email')) {
                return `There was an issue with the email address. Could you please confirm your email address?`;
              }
              
              return `I encountered an issue booking the appointment. I've noted the details for ${name} at ${datetime}. Someone from our team will confirm the appointment shortly.`;
            }
          }
          
          // Calendly provider (no direct booking - link only)
          if (this.calendarProvider === 'calendly' && this.calendlyService) {
            const eventTypeUri = this.config.calendarIntegration?.calendlyEventTypeUri;
            if (!eventTypeUri) {
              return 'Calendar is not properly configured. Appointment details collected but booking could not be completed automatically.';
            }

            try {
              const bookingUrl = await this.calendlyService.createSingleUseLink(eventTypeUri);
              return `I've collected the appointment details for ${name} at ${datetime}. Unfortunately, I cannot complete the booking automatically with this calendar system. Someone from our team will confirm the appointment shortly.${email ? ` A confirmation will be sent to ${email}.` : ''}`;
            } catch (error) {
              logger.error('[Pipeline] Calendly booking error:', error);
              return `I've collected the appointment details for ${name} at ${datetime}. Someone from our team will confirm the appointment shortly.`;
            }
          }

          return 'Calendar is not properly configured. Appointment details collected but booking could not be completed automatically.';
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
