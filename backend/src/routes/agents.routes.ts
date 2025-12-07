// ============================================
// Agent Routes
// ============================================

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error-handler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createAgentSchema, updateAgentSchema } from '../lib/validators';
import { ERROR_CODES, DEFAULT_VOICES, DEFAULT_LLM_MODELS } from '../lib/constants';

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

    res.json({
      success: true,
      data: agents.map((agent) => ({
        ...agent,
        totalCalls: agent._count.calls,
      })),
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

    res.json({
      success: true,
      data: {
        ...agent,
        totalCalls: agent._count.calls,
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
    const voiceId = data.voiceId || DEFAULT_VOICES[data.voiceProvider || 'elevenlabs']?.id;
    const llmModel = data.llmModel || DEFAULT_LLM_MODELS[data.llmProvider || 'openai'];

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

export default router;
