// ============================================
// Voice Pipeline - Orchestrates STT -> LLM -> TTS
// ============================================

import { EventEmitter } from 'events';
import { DeepgramSTTService, TranscriptEvent } from '../stt/deepgram.service';
import { OpenAIService, CALENDAR_TOOLS, ToolCall } from '../llm/openai.service';
import { ElevenLabsService } from '../tts/elevenlabs.service';
import { CalendlyService } from '../calendar/calendly.service';
import { CalComService } from '../calendar/calcom.service';
import { GoogleCalendarService } from '../calendar/google.service';
import { MetricsTracker } from '../../utils/metrics';
import { logger } from '../../utils/logger';
import { Agent } from '@prisma/client';
import { getElevenLabsVoiceId } from '../../lib/constants';
import { decrypt } from '../../utils/crypto';
import { cacheGet, cacheSet } from '../../lib/redis';

export interface CalendarIntegration {
  provider: 'calendly' | 'calcom' | 'google';
  // Calendly fields
  accessToken?: string;
  calendlyUserUri?: string | null;
  calendlyEventTypeUri?: string | null;
  // Cal.com fields
  calcomApiKey?: string;
  calcomEventTypeId?: number | null;
  calcomEventTypeName?: string | null;
  // Google Calendar fields
  googleAccessToken?: string;
  googleRefreshToken?: string | null;
  googleCalendarId?: string;
  googleUserEmail?: string | null;
  // Common fields
  eventTypeName?: string | null;
  timezone: string;
  // Agent-specific duration (for Google Calendar)
  defaultDuration?: number;
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
  private googleService: GoogleCalendarService | null = null;

  private messages: ConversationMessage[] = [];
  private isProcessing = false;
  private pendingTranscript = '';
  private state: 'listening' | 'processing' | 'speaking' = 'listening';
  private interruptionEnabled: boolean;
  private interrupted = false;
  private hasCalendarAccess = false;
  private calendarProvider: 'calendly' | 'calcom' | 'google' | null = null;
  
  // Performance: Limit conversation context sent to LLM (reduces latency & cost)
  private readonly MAX_CONTEXT_MESSAGES = 10; // Keep last 10 messages (~5 exchanges)
  
  // Performance: Use streaming TTS for lower latency (audio starts playing before full generation)
  private readonly USE_STREAMING_TTS = true;

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

  private utteranceTimeout: NodeJS.Timeout | null = null;
  private readonly UTTERANCE_DELAY_MS = 400; // Wait 400ms (reduced from 600ms) for faster response

  // Dead air detection - reprompt if user doesn't respond
  private deadAirTimeout: NodeJS.Timeout | null = null;
  private lastAiResponse: string = '';
  private lastAudioPlaybackMs: number = 0; // Track last audio duration for dead air timing
  private deadAirCount: number = 0;
  private readonly DEAD_AIR_TIMEOUT_MS = 7000; // 7 seconds of silence triggers reprompt
  private readonly MAX_DEAD_AIR_REPROMPTS = 2; // Max times to reprompt before giving up

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

      // Cancel pending utterance processing if user continues speaking
      if (this.utteranceTimeout) {
        clearTimeout(this.utteranceTimeout);
        this.utteranceTimeout = null;
      }

      // Cancel dead air timeout when user speaks
      if (this.deadAirTimeout) {
        clearTimeout(this.deadAirTimeout);
        this.deadAirTimeout = null;
        this.deadAirCount = 0; // Reset count when user responds
      }

      if (event.isFinal) {
        this.pendingTranscript += ' ' + event.text;
      }
    });

    // When user starts speaking again, cancel any pending processing
    this.stt.on('speech_started', () => {
      if (this.utteranceTimeout) {
        logger.info('[Pipeline] User started speaking again, cancelling pending processing');
        clearTimeout(this.utteranceTimeout);
        this.utteranceTimeout = null;
      }
      
      // Also cancel dead air timeout
      if (this.deadAirTimeout) {
        clearTimeout(this.deadAirTimeout);
        this.deadAirTimeout = null;
        this.deadAirCount = 0;
      }
    });

    this.stt.on('utterance_end', async () => {
      const transcript = this.pendingTranscript.trim();
      logger.info('[Pipeline] Utterance end detected, pending: ' + transcript);
      
      if (!transcript || this.isProcessing) {
        logger.info(`[Pipeline] Skipping - isProcessing: ${this.isProcessing}, empty: ${!transcript}`);
        return;
      }

      // Check if transcript seems incomplete (user might continue)
      if (this.isIncompletePhrase(transcript)) {
        logger.info('[Pipeline] Phrase seems incomplete, waiting for more...');
        // Wait longer for incomplete phrases
        this.utteranceTimeout = setTimeout(async () => {
          const finalTranscript = this.pendingTranscript.trim();
          if (finalTranscript && !this.isProcessing) {
            await this.processUserInput(finalTranscript);
        this.pendingTranscript = '';
          }
          this.utteranceTimeout = null;
        }, this.UTTERANCE_DELAY_MS * 2); // Double delay for incomplete phrases
        return;
      }

      // Normal delay before processing - gives user time to continue
      this.utteranceTimeout = setTimeout(async () => {
        const finalTranscript = this.pendingTranscript.trim();
        if (finalTranscript && !this.isProcessing) {
          await this.processUserInput(finalTranscript);
          this.pendingTranscript = '';
        }
        this.utteranceTimeout = null;
      }, this.UTTERANCE_DELAY_MS);
    });

    this.stt.on('error', (error) => {
      this.config.onError(error);
    });
  }

  /**
   * Check if a phrase seems incomplete and the user might continue speaking
   */
  private isIncompletePhrase(text: string): boolean {
    const lowerText = text.toLowerCase().trim();
    
    // Phrases that often indicate more is coming
    const incompleteEndings = [
      ' and', ' or', ' but', ' so', ' my', ' the', ' is', ' are',
      ' at', ' to', ' for', ' with', ' about', ' because',
      ' email', ' name', ' number', ' address',
      ' it\'s', ' its', ' that\'s', ' i\'m', ' i am',
    ];
    
    for (const ending of incompleteEndings) {
      if (lowerText.endsWith(ending)) {
        return true;
      }
    }
    
    // Also check if it's a very short response that might be incomplete
    const wordCount = lowerText.split(/\s+/).length;
    if (wordCount <= 2 && !lowerText.includes('@')) {
      // Short responses like "my name" or "the email" - might be incomplete
      // But not if it contains @ (email address)
      return true;
    }
    
    return false;
  }

  /**
   * Start the dead air detection timer
   * @param audioPlaybackMs - How long the audio will take to play (delay before counting dead air)
   */
  private startDeadAirTimer(audioPlaybackMs: number = 0): void {
    // Clear any existing timer
    if (this.deadAirTimeout) {
      clearTimeout(this.deadAirTimeout);
    }
    
    // Don't start if we've already reprompted too many times
    if (this.deadAirCount >= this.MAX_DEAD_AIR_REPROMPTS) {
      logger.info('[Pipeline] Max dead air reprompts reached, not starting timer');
      return;
    }
    
    // Total delay = audio playback time + dead air timeout
    // This ensures we only count silence AFTER the AI finishes speaking
    const totalDelay = audioPlaybackMs + this.DEAD_AIR_TIMEOUT_MS;
    console.log(`[Pipeline] Dead air timer: ${audioPlaybackMs}ms playback + ${this.DEAD_AIR_TIMEOUT_MS}ms silence = ${totalDelay}ms total`);
    
    this.deadAirTimeout = setTimeout(async () => {
      await this.handleDeadAir();
    }, totalDelay);
  }

  /**
   * Handle dead air by rephrasing the last response
   */
  private async handleDeadAir(): Promise<void> {
    if (this.isProcessing || !this.lastAiResponse) {
      return;
    }
    
    this.deadAirCount++;
    logger.info(`[Pipeline] Dead air detected (count: ${this.deadAirCount}), reprompting...`);
    
    try {
      // Generate a rephrased/follow-up message
      const repromptMessage = await this.generateReprompt();
      
      if (repromptMessage && !this.isProcessing) {
        // Send the reprompt audio
        const playbackMs = await this.generateAndSendAudio(repromptMessage);
        
        // Track it in conversation
        this.messages.push({
          role: 'assistant',
          content: repromptMessage,
          timestamp: Date.now(),
        });
        this.config.onTranscript(repromptMessage, true, 'agent');
        
        // Update last response
        this.lastAiResponse = repromptMessage;
        
        // Start timer again for another potential reprompt (after audio plays)
        this.startDeadAirTimer(playbackMs);
      }
    } catch (error) {
      logger.error('[Pipeline] Error handling dead air:', error);
    }
  }

  /**
   * Generate a rephrased follow-up message
   */
  private async generateReprompt(): Promise<string> {
    // Simple reprompt phrases for first attempt
    if (this.deadAirCount === 1) {
      const simpleReprompts = [
        "Are you still there?",
        "Hello? Can you hear me?",
        "I'm still here if you have any questions.",
      ];
      return simpleReprompts[Math.floor(Math.random() * simpleReprompts.length)];
    }
    
    // For second attempt, ask LLM to rephrase more helpfully
    try {
      const systemPrompt = 'You are helping rephrase a message because the caller may not have heard or understood. Keep it brief and conversational.';
      const userMessage = `The caller hasn't responded. Your last message was: "${this.lastAiResponse}"\n\nGenerate a brief, slightly rephrased follow-up (1 sentence max) that either:\n1. Asks if they need clarification\n2. Rephrases the key question/information\n3. Offers to help differently\n\nKeep it natural and conversational.`;
      
      const response = await this.llm.generateResponse(
        [{ role: 'user', content: userMessage }],
        systemPrompt,
        0.7,
        100
      );
      return response.trim();
    } catch (error) {
      logger.error('[Pipeline] Error generating reprompt:', error);
      return "Is there anything else I can help you with?";
    }
  }

  async start(): Promise<void> {
    console.log('[Pipeline] start() called');
    console.log('[Pipeline] Call direction:', this.config.callDirection);
    
    // PERF: Start STT and Greeting generation in parallel
    console.log('[Pipeline] Starting Deepgram STT...');
    const sttPromise = this.stt.startStream();

    // Determine which greeting to use based on call direction
    let greeting: string | undefined | null = this.config.agent.greeting;
    if (this.config.callDirection === 'outbound' && this.config.agent.outboundGreeting) {
      greeting = this.config.agent.outboundGreeting;
      console.log('[Pipeline] Using outbound greeting');
    } else if (this.config.callDirection === 'inbound' && this.config.agent.greeting) {
      console.log('[Pipeline] Using inbound greeting');
    }
    
    // Clean up empty string greetings (treat as no greeting)
    if (greeting && greeting.trim() === '') {
      greeting = null;
    }
    
    console.log('[Pipeline] Greeting:', greeting || 'none');

    // Generate greeting promise
    let greetingPromise: Promise<void> = Promise.resolve();

    if (greeting && greeting.trim()) {
      // Use the preset greeting (scripted approach)
      console.log('[Pipeline] Generating preset greeting audio...');
      greetingPromise = this.generateAndSendAudio(greeting).then((playbackMs) => {
          console.log('[Pipeline] ✅ Preset greeting sent');
          this.lastAiResponse = greeting!;
          this.messages.push({
            role: 'assistant',
            content: greeting!,
            timestamp: Date.now(),
          });
          this.startDeadAirTimer(playbackMs);
      });
    } else {
      // No preset greeting - generate an opening from the LLM
      console.log('[Pipeline] No preset greeting - generating dynamic opening from LLM...');
      const openingPrompt = this.config.callDirection === 'outbound'
          ? 'You are starting an outbound call. Introduce yourself briefly and state the purpose of the call. Keep it natural and under 2 sentences.'
          : 'A caller has just connected. Greet them warmly and offer assistance. Keep it natural and under 2 sentences.';

      greetingPromise = this.llm.generateResponse(
          [{ role: 'user', content: openingPrompt }],
          this.config.agent.systemPrompt,
          0.7,
          100
      ).then(async (generatedOpening) => {
         if (generatedOpening && generatedOpening.trim()) {
            console.log('[Pipeline] Generated opening:', generatedOpening);
            const playbackMs = await this.generateAndSendAudio(generatedOpening);
            console.log('[Pipeline] ✅ Dynamic opening sent');
            
            this.lastAiResponse = generatedOpening;
            this.messages.push({
              role: 'assistant',
              content: generatedOpening,
              timestamp: Date.now(),
            });
            this.startDeadAirTimer(playbackMs);
          } else {
            console.log('[Pipeline] ⚠️ LLM returned empty opening - waiting for user');
          }
      }).catch(error => {
          console.error('[Pipeline] Failed to generate opening:', error);
      });
    }

    // Await both
    await Promise.all([sttPromise, greetingPromise]);
    console.log('[Pipeline] ✅ Startup complete');
  }

  async processAudio(audioData: Buffer): Promise<void> {
    this.metrics.mark('audio_received');
    this.stt.sendAudio(audioData);
  }

  private thinkingTimeout: NodeJS.Timeout | null = null;
  private readonly THINKING_DELAY_MS = 1200; // Say "one moment" if processing takes longer than 1.2s
  private readonly THINKING_PHRASES = [
    "One moment.",
    "Let me check.",
    "Just a sec.",
  ];
  
  // Quick acknowledgments sent immediately when processing starts (reduces perceived latency)
  private readonly QUICK_ACKS = [
    "Mm-hmm.",
    "Got it.",
    "Okay.",
    "I see.",
    "Right.",
    "Understood.",
  ];
  private readonly SEND_QUICK_ACK = true; // Enable immediate acknowledgments

  private async processUserInput(text: string): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.state = 'processing';
    this.interrupted = false;

    logger.info('[Pipeline] Processing user input:', text);
    logger.info('[Pipeline] Calendar access:', this.hasCalendarAccess);

    // For tool calls (calendar), send immediate acknowledgment to reduce perceived latency
    // This lets the user know we heard them while LLM processes
    let quickAckSent = false;
    if (this.SEND_QUICK_ACK && this.hasCalendarAccess) {
      const ack = this.QUICK_ACKS[Math.floor(Math.random() * this.QUICK_ACKS.length)];
      logger.info('[Pipeline] Sending quick acknowledgment:', ack);
      // Fire and forget - don't await to avoid blocking
      this.generateAndSendAudio(ack).catch(err => 
        logger.error('[Pipeline] Quick ack error:', err)
      );
      quickAckSent = true;
    }

    // Start a "thinking" timer - if processing takes too long, say something more
    let thinkingMessageSent = false;
    this.thinkingTimeout = setTimeout(async () => {
      if (this.isProcessing && !this.interrupted && !thinkingMessageSent && !quickAckSent) {
        thinkingMessageSent = true;
        const phrase = this.THINKING_PHRASES[Math.floor(Math.random() * this.THINKING_PHRASES.length)];
        logger.info('[Pipeline] Sending thinking message:', phrase);
        await this.generateAndSendAudio(phrase);
      }
    }, this.THINKING_DELAY_MS);

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
        
        // Track last response for dead air reprompting
        this.lastAiResponse = fullResponse.trim();
        
        // Start dead air detection timer (accounting for audio playback time)
        this.startDeadAirTimer(this.lastAudioPlaybackMs);
      }

      // Report latency metrics
      const metrics = this.metrics.getLatencyMetrics();
      this.config.onLatencyMetrics(metrics);
      logger.debug('[Pipeline] Latency metrics:', metrics);

    } catch (error) {
      logger.error('[Pipeline] Process error:', error);
      this.config.onError(error as Error);
    } finally {
      // Clear thinking timeout
      if (this.thinkingTimeout) {
        clearTimeout(this.thinkingTimeout);
        this.thinkingTimeout = null;
      }
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
- Use book_appointment to confirm bookings after collecting: name, email (REQUIRED), and preferred time.
- If the caller asks "what times are available" or similar, call check_calendar_availability with today's date or the date they mention.
- You MUST collect the caller's email address before booking - it is required for confirmation.

EMAIL CONFIRMATION (IMPORTANT):
- When you receive an email address, ALWAYS read it back using the phonetic alphabet for clarity.
- Example: For "codebymv@gmail.com", say: "Just to confirm, that's C as in Charlie, O as in Oscar, D as in Delta, E as in Echo, B as in Bravo, Y as in Yankee, M as in Mike, V as in Victor, at gmail dot com. Is that correct?"
- Common phonetic letters: A-Alpha, B-Bravo, C-Charlie, D-Delta, E-Echo, F-Foxtrot, G-Golf, H-Hotel, I-India, J-Juliet, K-Kilo, L-Lima, M-Mike, N-November, O-Oscar, P-Papa, Q-Quebec, R-Romeo, S-Sierra, T-Tango, U-Uniform, V-Victor, W-Whiskey, X-X-ray, Y-Yankee, Z-Zulu.
- Wait for the caller to confirm the email is correct before proceeding.

BOOKING CONFIRMATION:
- Before calling book_appointment, read back ALL details: "So that's [Name], email [spell phonetically], for [day] at [time]. Should I go ahead and book that?"
- Only call book_appointment AFTER the caller confirms.
- After successful booking, confirm: "Your appointment is confirmed for [details]. You'll receive a confirmation email shortly."`;

    logger.info('[Pipeline] Calling LLM with tools...');
    
    // First, try to get a response with potential tool calls
    // PERF: Reduced max_tokens (150) and temperature (0.5) for faster voice responses
    const response = await this.llm.generateResponseWithTools(
      this.getContextMessages(), // Use limited context for performance
      enhancedPrompt,
      CALENDAR_TOOLS,
      0.5,  // Lower temperature = faster, more deterministic
      150   // Reduced from 300 - voice responses should be concise
    );

    logger.info('[Pipeline] LLM response:', { hasContent: !!response.content, hasToolCalls: !!response.toolCalls?.length });

    // If there are tool calls, execute them
    if (response.toolCalls && response.toolCalls.length > 0) {
      logger.info('[Pipeline] Tool calls detected:', response.toolCalls.map(tc => tc.name));
      
      for (const toolCall of response.toolCalls) {
        const toolResult = await this.executeToolCall(toolCall);
        
        logger.info('[Pipeline] Tool result:', toolResult.substring(0, 100));
        
        // Get natural language response incorporating tool results
        // PERF: Reduced max_tokens (100) for faster responses
        const naturalResponse = await this.llm.continueAfterToolCall(
          this.getContextMessages(), // Use limited context for performance
          enhancedPrompt,
          toolCall, // Pass full toolCall object
          toolResult,
          0.5,  // Lower temperature = faster
          100   // Reduced from 200 - keep it concise
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
          
          // Check cache first (PERF: Avoid expensive API calls)
          const cacheKey = `calendar:availability:${this.config.agent.id}:${this.calendarProvider}:${date}`;
          const cachedSlots = await cacheGet<string>(cacheKey);
          if (cachedSlots) {
            logger.info('[Pipeline] Cache hit for calendar availability');
            return cachedSlots;
          }

          // Check if agent has read_calendar scope
          const calendarScopes = this.config.agent.calendarScopes || [];
          if (!calendarScopes.includes('read_calendar')) {
            logger.warn('[Pipeline] Agent does not have read_calendar scope');
            return 'Calendar access is not enabled for this agent. Please collect preferred times and someone will follow up.';
          }
          
          let result = 'Calendar is not properly configured. Please collect preferred times and let them know someone will confirm.';

          // Google Calendar provider
          if (this.calendarProvider === 'google' && this.googleService) {
            const endDate = date; // Check single day
            const slots = await this.googleService.getAvailableSlots(date, endDate, 60);

            if (slots.length === 0) {
              result = `No available time slots found for ${date}. You may want to suggest checking another date.`;
            } else {
              result = this.googleService.formatSlotsForVoice(slots);
            }
          }
          
          // Cal.com provider
          else if (this.calendarProvider === 'calcom' && this.calcomService) {
            const eventTypeId = this.config.calendarIntegration?.calcomEventTypeId;
            if (eventTypeId) {
              const slots = await this.calcomService.getAvailableSlots(eventTypeId, date);
              if (slots.length === 0) {
                result = `No available time slots found for ${date}. You may want to suggest checking another date.`;
              } else {
                result = this.calcomService.formatSlotsForVoice(slots, 5);
              }
            }
          }
          
          // Calendly provider (fallback)
          else if (this.calendarProvider === 'calendly' && this.calendlyService) {
            const eventTypeUri = this.config.calendarIntegration?.calendlyEventTypeUri;
            if (eventTypeUri) {
              const slots = await this.calendlyService.getAvailableSlots(eventTypeUri, date);
              if (slots.length === 0) {
                result = `No available time slots found for ${date}. You may want to suggest checking another date.`;
              } else {
                result = this.calendlyService.formatSlotsForVoice(slots, 5);
              }
            }
          }

          // Cache the result for 60 seconds (short TTL to avoid stale data)
          await cacheSet(cacheKey, result, 60);
          return result;
        }

        case 'book_appointment': {
          const { datetime, name, email, phone, notes } = toolCall.arguments;
          
          // Check if agent has create_events scope
          const bookingScopes = this.config.agent.calendarScopes || [];
          if (!bookingScopes.includes('create_events')) {
            logger.warn('[Pipeline] Agent does not have create_events scope');
            return `Thank you ${name}. I've collected your appointment request for ${new Date(datetime).toLocaleString('en-US', { 
              timeZone: this.config.calendarIntegration?.timezone,
              weekday: 'long',
              month: 'long', 
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true 
            })}. Someone from our team will confirm your booking shortly.`;
          }
          
          // Google Calendar provider - DIRECT BOOKING!
          if (this.calendarProvider === 'google' && this.googleService) {
            // Email is optional for Google Calendar
            const cleanedEmail = email
              ? email
                  .toLowerCase()
                  .replace(/\s+at\s+/gi, '@')
                  .replace(/\s+dot\s+/gi, '.')
                  .replace(/\s/g, '')
                  .trim()
              : undefined;

            try {
              const startTime = new Date(datetime);
              const endTime = new Date(startTime);
              endTime.setHours(endTime.getHours() + 1); // Default 1 hour duration

              const event = await this.googleService.createEvent({
                summary: `Appointment with ${name}`,
                start: startTime.toISOString(),
                end: endTime.toISOString(),
                attendeeEmail: cleanedEmail,
                attendeeName: name,
                description: notes || (phone ? `Phone: ${phone}` : undefined),
                timeZone: this.config.calendarIntegration?.timezone,
              });

              logger.info('[Pipeline] Google Calendar event created:', event.id);
              
              return `Appointment successfully booked for ${name} on ${new Date(startTime).toLocaleString('en-US', {
                timeZone: this.config.calendarIntegration?.timezone,
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}. ${cleanedEmail ? `A confirmation email has been sent to ${cleanedEmail}.` : ''} Event ID: ${event.id.substring(0, 8)}.`;
            } catch (error: any) {
              logger.error('[Pipeline] Google Calendar booking error:', error);
              return `I encountered an issue booking the appointment. I've noted the details for ${name} at ${datetime}. Someone from our team will confirm the appointment shortly.`;
            }
          }
          
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
    // PERF: Lower temperature (0.5) for faster responses
    for await (const { sentence, isComplete } of this.llm.streamSentences(
      this.getContextMessages(), // Use limited context for performance
      this.config.agent.systemPrompt,
      0.5, // Lower temperature = faster, more deterministic
      100  // Reduced from 150 - keep voice responses concise
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

  /**
   * Generate TTS audio and send it to Twilio
   * Uses streaming for lower latency when enabled
   * @returns The estimated playback duration in milliseconds
   */
  private async generateAndSendAudio(text: string): Promise<number> {
    if (!text.trim()) {
      console.log('[Pipeline] generateAndSendAudio: text is empty, skipping');
      return 0;
    }

    try {
      this.state = 'speaking';
      const ttsStart = Date.now();

      console.log('[Pipeline] Generating TTS for text:', text.substring(0, 50) + '...');
      
      // Get voice settings
      const voiceSettings = this.config.agent.voiceSettings as any;
      const elevenLabsVoiceId = getElevenLabsVoiceId(this.config.agent.voice);
      
      console.log('[Pipeline] Using voice:', this.config.agent.voice, '-> ElevenLabs ID:', elevenLabsVoiceId);
      
      let playbackDurationMs: number;

      if (this.USE_STREAMING_TTS) {
        // STREAMING MODE: Send audio chunks as they're generated (lower latency)
        console.log('[Pipeline] 🚀 Using STREAMING TTS for lower latency');
        
        let firstChunkTime: number | null = null;
        
        const result = await this.tts.streamTTSForTwilio(
          text,
          elevenLabsVoiceId,
          {
            stability: voiceSettings?.stability ?? 0.5,
            similarity_boost: voiceSettings?.similarity_boost ?? 0.75,
          },
          (chunk) => {
            // Stream each chunk to Twilio immediately
            if (!this.interrupted) {
              if (!firstChunkTime) {
                firstChunkTime = Date.now();
                // console.log(`[Pipeline] ⚡ First audio chunk in ${firstChunkTime - ttsStart}ms`);
              }
              // PERF: Ensure this is non-blocking
              setImmediate(() => this.config.onAudio(chunk));
            }
          }
        );
        
        playbackDurationMs = result.durationMs;
        // console.log(`[Pipeline] ✅ Streaming TTS complete, total: ${result.totalBuffer.length} bytes, ${playbackDurationMs}ms`);
        
      } else {
        // BATCH MODE: Wait for full audio then send (original behavior)
        console.log('[Pipeline] Using BATCH TTS (waiting for full audio)');
        
        const audioBuffer = await this.tts.textToSpeechForTwilio(
          text,
          elevenLabsVoiceId,
          {
            stability: voiceSettings?.stability ?? 0.5,
            similarity_boost: voiceSettings?.similarity_boost ?? 0.75,
          }
        );

        playbackDurationMs = Math.ceil((audioBuffer.length / 8000) * 1000);
        
        console.log('[Pipeline] ✅ TTS generated, ulaw_8000 buffer size:', audioBuffer.length, 'bytes, playback:', playbackDurationMs, 'ms');

        if (!this.interrupted) {
          console.log('[Pipeline] Sending audio to client via onAudio callback');
          this.config.onAudio(audioBuffer);
        } else {
          console.log('[Pipeline] ⚠️ Audio generation interrupted, not sending');
        }
      }

      // Track last playback duration for dead air timing
      this.lastAudioPlaybackMs = playbackDurationMs;
      this.metrics.mark('audio_sent');

      return playbackDurationMs;

    } catch (error) {
      console.error('[Pipeline] ❌ TTS error:', error);
      logger.error('[Pipeline] TTS error:', error);
      // Continue without audio on error - fall back to batch mode
      return this.generateAndSendAudioBatch(text);
    }
  }

  /**
   * Fallback batch TTS (in case streaming fails)
   */
  private async generateAndSendAudioBatch(text: string): Promise<number> {
    try {
      const voiceSettings = this.config.agent.voiceSettings as any;
      const elevenLabsVoiceId = getElevenLabsVoiceId(this.config.agent.voice);
      
      const audioBuffer = await this.tts.textToSpeechForTwilio(
        text,
        elevenLabsVoiceId,
        {
          stability: voiceSettings?.stability ?? 0.5,
          similarity_boost: voiceSettings?.similarityBoost ?? 0.75,
        }
      );

      const playbackDurationMs = Math.ceil((audioBuffer.length / 8000) * 1000);
      this.lastAudioPlaybackMs = playbackDurationMs;

      if (!this.interrupted) {
        this.config.onAudio(audioBuffer);
      }

      return playbackDurationMs;
    } catch (error) {
      logger.error('[Pipeline] Batch TTS fallback also failed:', error);
      return 0;
    }
  }

  async stop(): Promise<void> {
    // Clear all timers
    if (this.utteranceTimeout) {
      clearTimeout(this.utteranceTimeout);
      this.utteranceTimeout = null;
    }
    if (this.deadAirTimeout) {
      clearTimeout(this.deadAirTimeout);
      this.deadAirTimeout = null;
    }
    if (this.thinkingTimeout) {
      clearTimeout(this.thinkingTimeout);
      this.thinkingTimeout = null;
    }
    
    await this.stt.close();
    this.removeAllListeners();
  }

  getMessages(): ConversationMessage[] {
    return [...this.messages];
  }

  /**
   * Get limited conversation context for LLM (reduces latency & cost)
   * Only sends the most recent messages to keep payload small
   */
  private getContextMessages(): Array<{ role: string; content: string }> {
    const recentMessages = this.messages.slice(-this.MAX_CONTEXT_MESSAGES);
    return recentMessages.map((m) => ({ role: m.role, content: m.content }));
  }

  getState(): string {
    return this.state;
  }
}
