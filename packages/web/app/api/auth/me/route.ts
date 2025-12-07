import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';

async function handler(request: NextRequest, context: { user: any }) {
  return NextResponse.json({ user: context.user });
}

export const GET = requireAuth(handler);
