import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

// GET /api/calls/[id] - Get single call
async function getHandler(
  request: NextRequest,
  context: { user: any; params: { id: string } }
) {
  try {
    const call = await prisma.call.findFirst({
      where: {
        id: context.params.id,
        userId: context.user.id,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            voice: true,
          },
        },
      },
    });
    
    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ call });
  } catch (error) {
    console.error('[Call GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call' },
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
