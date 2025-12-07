import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  systemPrompt: z.string().min(10).optional(),
  greeting: z.string().optional(),
  voice: z.string().optional(),
  voiceProvider: z.string().optional(),
  maxCallDuration: z.number().optional(),
  isActive: z.boolean().optional(),
  webhookUrl: z.string().url().optional().nullable(),
  webhookEvents: z.array(z.string()).optional(),
});

// GET /api/agents/[id] - Get single agent
async function getHandler(
  request: NextRequest,
  context: { user: any; params: { id: string } }
) {
  try {
    const agent = await prisma.agent.findFirst({
      where: {
        id: context.params.id,
        userId: context.user.id,
      },
      include: {
        _count: {
          select: { calls: true },
        },
      },
    });
    
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ agent });
  } catch (error) {
    console.error('[Agent GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}

// PATCH /api/agents/[id] - Update agent
async function patchHandler(
  request: NextRequest,
  context: { user: any; params: { id: string } }
) {
  try {
    const body = await request.json();
    const data = updateAgentSchema.parse(body);
    
    // Verify ownership
    const existing = await prisma.agent.findFirst({
      where: {
        id: context.params.id,
        userId: context.user.id,
      },
    });
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    const agent = await prisma.agent.update({
      where: { id: context.params.id },
      data,
    });
    
    return NextResponse.json({ agent });
  } catch (error) {
    console.error('[Agent PATCH] Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id] - Delete agent
async function deleteHandler(
  request: NextRequest,
  context: { user: any; params: { id: string } }
) {
  try {
    // Verify ownership
    const existing = await prisma.agent.findFirst({
      where: {
        id: context.params.id,
        userId: context.user.id,
      },
    });
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    await prisma.agent.delete({
      where: { id: context.params.id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Agent DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return requireAuth((req, ctx) => getHandler(req, { ...ctx, params }))(request);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return requireAuth((req, ctx) => patchHandler(req, { ...ctx, params }))(request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return requireAuth((req, ctx) => deleteHandler(req, { ...ctx, params }))(request);
}
