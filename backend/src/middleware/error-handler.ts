// ============================================
// Error Handler Middleware
// ============================================

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { ERROR_CODES, ERROR_MESSAGES } from '@aicaller/shared';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, unknown>;
}

export function createError(
  message: string,
  statusCode: number = 500,
  code: string = ERROR_CODES.INTERNAL_ERROR,
  details?: Record<string, unknown>
): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error
  logger.error(`[${req.method}] ${req.path}`, {
    error: err.message,
    code: err.code,
    stack: err.stack,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation failed',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const code = err.code || ERROR_CODES.INTERNAL_ERROR;
  const message = err.message || ERROR_MESSAGES[code] || 'An error occurred';

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(err.details && { details: err.details }),
    },
  });
}
