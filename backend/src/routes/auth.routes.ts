// ============================================
// Auth Routes
// ============================================

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error-handler';
import { authenticate, generateToken, AuthRequest } from '../middleware/auth';
import { loginSchema, registerSchema } from '../lib/validators';
import { ERROR_CODES } from '../lib/constants';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw createError('User already exists', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    // Generate token
    const token = await generateToken(user.id);

    res.status(201).json({
      success: true,
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw createError('Invalid credentials', 401, ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    }

    // Verify password
    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      throw createError('Invalid credentials', 401, ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    }

    // Generate token
    const token = await generateToken(user.id);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        minutesUsed: true,
        minutesLimit: true,
        creditsBalance: true,
        createdAt: true,
        _count: {
          select: {
            agents: true,
            phoneNumbers: true,
          },
        },
      },
    });

    if (!user) {
      throw createError('User not found', 404, ERROR_CODES.USER_NOT_FOUND);
    }

    res.json({
      success: true,
      data: {
        ...user,
        agentCount: user._count.agents,
        phoneNumberCount: user._count.phoneNumbers,
      },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/auth/me
router.put('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { name } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
