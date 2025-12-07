import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

// GET /api/calls - List all calls
async function getHandler(request: NextRequest, context: { user: any }) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const where: any = { userId: context.user.id };
    if (agentId) {
      where.agentId = agentId;
    }
    
    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          agent: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.call.count({ where }),
    ]);
    
    return NextResponse.json({ calls, total });
  } catch (error) {
    console.error('[Calls GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calls' },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(getHandler);
