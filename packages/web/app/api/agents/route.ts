import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { getTemplate } from '@/lib/templates';

const createAgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  template: z.string().optional(),
  systemPrompt: z.string().min(10),
  greeting: z.string().optional(),
  voice: z.string().default('rachel'),
  voiceProvider: z.string().default('elevenlabs'),
  maxCallDuration: z.number().default(600),
});

// GET /api/agents - List all agents
async function getHandler(request: NextRequest, context: { user: any }) {
  try {
    const agents = await prisma.agent.findMany({
      where: { userId: context.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { calls: true },
        },
      },
    });
    
    return NextResponse.json({ agents });
  } catch (error) {
    console.error('[Agents GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

// POST /api/agents - Create new agent
async function postHandler(request: NextRequest, context: { user: any }) {
  try {
    const body = await request.json();
    const data = createAgentSchema.parse(body);
    
    // If template is provided, use template defaults
    let systemPrompt = data.systemPrompt;
    let greeting = data.greeting;
    let voice = data.voice;
    
    if (data.template) {
      const template = getTemplate(data.template);
      if (template) {
        systemPrompt = template.systemPrompt;
        greeting = template.greeting;
        voice = template.suggestedVoice;
      }
    }
    
    const agent = await prisma.agent.create({
      data: {
        userId: context.user.id,
        name: data.name,
        description: data.description,
        template: data.template,
        systemPrompt,
        greeting,
        voice,
        voiceProvider: data.voiceProvider,
        maxCallDuration: data.maxCallDuration,
        isActive: true,
      },
    });
    
    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error('[Agents POST] Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(getHandler);
export const POST = requireAuth(postHandler);
