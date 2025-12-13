// ============================================
// Authentication Middleware
// ============================================

import { Request, Response, NextFunction } from 'express';
import * as jose from 'jose';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { createError } from './error-handler';
import { ERROR_CODES } from '../lib/constants';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string | null;
    role: 'USER' | 'ADMIN';
  };
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw createError('No token provided', 401, ERROR_CODES.AUTH_UNAUTHORIZED);
    }

    const token = authHeader.substring(7);

    // Check for API key
    if (token.startsWith('sk_')) {
      return authenticateApiKey(req, res, next, token);
    }

    // Verify JWT
    const secret = new TextEncoder().encode(config.jwtSecret);
    const { payload } = await jose.jwtVerify(token, secret);

    if (!payload.sub) {
      throw createError('Invalid token', 401, ERROR_CODES.AUTH_TOKEN_INVALID);
    }

    // Fetch user
    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
      select: { id: true, email: true, name: true, role: true } as any,
    });

    if (!user) {
      throw createError('User not found', 401, ERROR_CODES.USER_NOT_FOUND);
    }

    // Cast user with role (defaults to USER if role not yet in DB)
    const userData = user as any;
    req.user = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role || 'USER',
    };
    next();
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      return next(createError('Token expired', 401, ERROR_CODES.AUTH_TOKEN_EXPIRED));
    }
    if (error instanceof jose.errors.JWTInvalid) {
      return next(createError('Invalid token', 401, ERROR_CODES.AUTH_TOKEN_INVALID));
    }
    next(error);
  }
}

async function authenticateApiKey(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  apiKey: string
) {
  try {
    const key = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { user: { select: { id: true, email: true, name: true, role: true } as any } },
    });

    if (!key) {
      throw createError('Invalid API key', 401, ERROR_CODES.AUTH_UNAUTHORIZED);
    }

    if (key.expiresAt && key.expiresAt < new Date()) {
      throw createError('API key expired', 401, ERROR_CODES.AUTH_TOKEN_EXPIRED);
    }

    // Update last used
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsed: new Date() },
    });

    // Cast user with role (defaults to USER if role not yet in DB)
    const userData = key.user as any;
    req.user = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role || 'USER',
    };
    next();
  } catch (error) {
    next(error);
  }
}

// Generate JWT token
export async function generateToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(config.jwtSecret);

  const token = await new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.jwtExpiresIn)
    .sign(secret);

  return token;
}

// Require admin role middleware
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return next(createError('Authentication required', 401, ERROR_CODES.AUTH_UNAUTHORIZED));
  }

  if (req.user.role !== 'ADMIN') {
    return next(createError('Admin access required', 403, 'FORBIDDEN'));
  }

  next();
}
