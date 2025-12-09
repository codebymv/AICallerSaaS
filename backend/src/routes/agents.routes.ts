// ============================================
// Agent Routes
// ============================================

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error-handler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createAgentSchema, updateAgentSchema, makeOutboundCallSchema } from '../lib/validators';
import { ERROR_CODES, DEFAULT_VOICES, DEFAULT_LLM_MODELS } from '../lib/constants';
import { decrypt } from '../utils/crypto';

const router = Router();

// Apply auth to all routes
router.use(authenticate);

// GET /api/agents - List all agents
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const agents = await prisma.agent.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { calls: true },
        },
      },
    });

    // Calculate average duration for each agent
    const agentsWithStats = await Promise.all(
      agents.map(async (agent) => {
        const avgDurationResult = await prisma.call.aggregate({
          where: {
            agentId: agent.id,
            status: 'completed',
            duration: { not: null },
          },
          _avg: {
            duration: true,
          },
        });

        return {
          ...agent,
          totalCalls: agent._count.calls,
          avgDuration: Math.round(avgDurationResult._avg.duration || 0),
        };
      })
    );

    res.json({
      success: true,
      data: agentsWithStats,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/agents/:id - Get single agent
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const agent = await prisma.agent.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
      include: {
        _count: {
          select: { calls: true },
        },
      },
    });

    if (!agent) {
      throw createError('Agent not found', 404, ERROR_CODES.AGENT_NOT_FOUND);
    }

    // Calculate average duration of completed calls
    const avgDurationResult = await prisma.call.aggregate({
      where: {
        agentId: agent.id,
        status: 'completed',
        duration: { not: null },
      },
      _avg: {
        duration: true,
      },
    });

    res.json({
      success: true,
      data: {
        ...agent,
        totalCalls: agent._count.calls,
        avgDuration: Math.round(avgDurationResult._avg.duration || 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/agents - Create agent
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createAgentSchema.parse(req.body);

    // Set defaults based on provider
    const provider = data.voiceProvider || 'elevenlabs';
    const voices = DEFAULT_VOICES[provider] || DEFAULT_VOICES['elevenlabs'];
    const voiceId = data.voiceId || (voices.length > 0 ? voices[0].id : 'rachel');
    const llmModel = data.llmModel || 'gpt-4-turbo';

    const agent = await prisma.agent.create({
      data: {
        userId: req.user!.id,
        name: data.name,
        description: data.description,
        systemPrompt: data.systemPrompt,
        voiceProvider: data.voiceProvider || 'elevenlabs',
        voice: voiceId,
        voiceSettings: data.voiceSettings,
        greeting: data.greeting,
        maxCallDuration: data.maxCallDuration || 600,
        interruptible: data.interruptible ?? true,
        webhookUrl: data.webhookUrl || null,
        webhookEvents: data.webhookEvents || [],
        mode: data.mode || 'INBOUND',
        outboundGreeting: data.outboundGreeting,
        callTimeout: data.callTimeout || 600,
        retryAttempts: data.retryAttempts || 0,
        callWindowStart: data.callWindowStart,
        callWindowEnd: data.callWindowEnd,
        calendarEnabled: data.calendarEnabled ?? false,
      },
    });

    res.status(201).json({
      success: true,
      data: agent,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/agents/:id - Update agent
router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = updateAgentSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.agent.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!existing) {
      throw createError('Agent not found', 404, ERROR_CODES.AGENT_NOT_FOUND);
    }

    const agent = await prisma.agent.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        description: data.description,
        systemPrompt: data.systemPrompt,
        voiceProvider: data.voiceProvider,
        voice: data.voiceId,
        voiceSettings: data.voiceSettings,
        greeting: data.greeting,
        maxCallDuration: data.maxCallDuration,
        interruptible: data.interruptible,
        webhookUrl: data.webhookUrl,
        webhookEvents: data.webhookEvents,
        isActive: data.isActive,
        mode: data.mode,
        outboundGreeting: data.outboundGreeting,
        callTimeout: data.callTimeout,
        retryAttempts: data.retryAttempts,
        callWindowStart: data.callWindowStart,
        callWindowEnd: data.callWindowEnd,
        calendarEnabled: data.calendarEnabled,
      },
    });

    res.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/agents/:id - Delete agent
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    // Verify ownership
    const existing = await prisma.agent.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!existing) {
      throw createError('Agent not found', 404, ERROR_CODES.AGENT_NOT_FOUND);
    }

    // Ensure all calls have snapshot fields populated before deleting the agent
    // This preserves the agent info for historical call records
    await prisma.call.updateMany({
      where: { 
        agentId: req.params.id,
        agentName: null,  // Only update calls that don't have snapshot data
      },
      data: {
        agentName: existing.name,
        agentVoice: existing.voice,
        agentVoiceProvider: existing.voiceProvider,
      },
    });

    // Delete the agent - Prisma will set agentId to null on related calls (onDelete: SetNull)
    await prisma.agent.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/agents/:id/test - Test agent with a message
router.post('/:id/test', async (req: AuthRequest, res, next) => {
  try {
    const { testMessage } = req.body;

    if (!testMessage) {
      throw createError('Test message is required', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const agent = await prisma.agent.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!agent) {
      throw createError('Agent not found', 404, ERROR_CODES.AGENT_NOT_FOUND);
    }

    // Import services dynamically to avoid circular dependencies
    const { OpenAIService } = await import('../services/llm/openai.service');
    const { ElevenLabsService } = await import('../services/tts/elevenlabs.service');

    const llmService = new OpenAIService();
    const ttsService = new ElevenLabsService();

    const startTime = Date.now();

    // Generate LLM response
    const llmStart = Date.now();
    const response = await llmService.generateResponse(
      [{ role: 'user', content: testMessage }],
      agent.systemPrompt
    );
    const llmTime = Date.now() - llmStart;

    // Generate TTS (optional)
    const ttsStart = Date.now();
    let audioUrl: string | undefined;
    try {
      const audioBuffer = await ttsService.textToSpeech(response, agent.voice);
      // In production, upload to S3 and return URL
      // For now, we skip the audio URL
      audioUrl = undefined;
    } catch (e) {
      // TTS failed, continue without audio
    }
    const ttsTime = Date.now() - ttsStart;

    const totalTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        response,
        audioUrl,
        latency: {
          llm: llmTime,
          tts: ttsTime,
          total: totalTime,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/agents/:id/call - Make an outbound call
router.post('/:id/call', async (req: AuthRequest, res, next) => {
  try {
    const data = makeOutboundCallSchema.parse(req.body);

    // Get agent and verify ownership
    const agent = await prisma.agent.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!agent) {
      throw createError('Agent not found', 404, ERROR_CODES.AGENT_NOT_FOUND);
    }

    // Verify agent mode allows outbound calls
    if (agent.mode === 'INBOUND') {
      throw createError('Agent is configured for inbound calls only', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Check call window restrictions if configured
    if (agent.callWindowStart && agent.callWindowEnd) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (currentTime < agent.callWindowStart || currentTime > agent.callWindowEnd) {
        throw createError(
          `Calls are only allowed between ${agent.callWindowStart} and ${agent.callWindowEnd}`,
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
    }

    // Get user's Twilio phone number
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        userId: req.user!.id,
        agentId: agent.id,
        isActive: true,
      },
    });

    if (!phoneNumber) {
      throw createError('No active phone number assigned to this agent', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Get user's Twilio credentials
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        twilioAccountSid: true,
        twilioAuthToken: true,
        twilioConfigured: true,
      },
    });

    if (!user?.twilioConfigured || !user.twilioAccountSid || !user.twilioAuthToken) {
      throw createError('Twilio account not configured', 400, ERROR_CODES.TWILIO_NOT_CONFIGURED);
    }

    // Initialize Twilio service with user's credentials
    const { TwilioService } = await import('../services/twilio.service');
    const twilioService = new TwilioService({
      accountSid: user.twilioAccountSid,
      authToken: decrypt(user.twilioAuthToken),
    });

    // Make the outbound call
    const result = await twilioService.makeOutboundCall(
      data.phoneNumber,
      agent.id,
      phoneNumber.phoneNumber
    );

    // Create call record
    const call = await prisma.call.create({
      data: {
        callSid: result.callSid,
        userId: req.user!.id,
        agentId: agent.id,
        phoneNumberId: phoneNumber.id,
        direction: 'outbound',
        from: phoneNumber.phoneNumber,
        to: data.phoneNumber,
        status: 'initiated',
        startTime: new Date(),
        // Agent snapshot - preserve agent config at time of call
        agentName: agent.name,
        agentVoice: agent.voice,
        agentVoiceProvider: agent.voiceProvider,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        callSid: result.callSid,
        callId: call.id,
        status: 'initiated',
        to: data.phoneNumber,
        from: phoneNumber.phoneNumber,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
