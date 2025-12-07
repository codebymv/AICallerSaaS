import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT, getTokenFromRequest } from './auth';
import { prisma } from './prisma';

export async function authenticateRequest(request: NextRequest) {
  const token = getTokenFromRequest(request);
  
  if (!token) {
    return { authenticated: false, user: null };
  }
  
  const payload = await verifyJWT(token);
  
  if (!payload) {
    return { authenticated: false, user: null };
  }
  
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      creditsBalance: true,
      minutesUsed: true,
    },
  });
  
  if (!user) {
    return { authenticated: false, user: null };
  }
  
  return { authenticated: true, user };
}

export function requireAuth(handler: (request: NextRequest, context: { user: any }) => Promise<Response>) {
  return async (request: NextRequest) => {
    const { authenticated, user } = await authenticateRequest(request);
    
    if (!authenticated || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return handler(request, { user });
  };
}
