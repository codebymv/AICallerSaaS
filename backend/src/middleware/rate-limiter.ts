// ============================================
// Rate Limiter Middleware
// ============================================

import { Request, Response, NextFunction } from 'express';
import { ERROR_CODES } from '@aicaller/shared';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Simple in-memory rate limiter
// In production, use Redis for distributed rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per window

export function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const key = req.ip || 'unknown';
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    };
    rateLimitStore.set(key, entry);
  } else {
    entry.count++;
  }

  // Clean up old entries periodically
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetTime) {
        rateLimitStore.delete(k);
      }
    }
  }

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX - entry.count));
  res.setHeader('X-RateLimit-Reset', entry.resetTime);

  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      success: false,
      error: {
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: 'Too many requests, please try again later',
      },
    });
  }

  next();
}
