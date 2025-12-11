// ============================================
// Contact Routes
// ============================================

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error-handler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ERROR_CODES } from '../lib/constants';

const router = Router();

// Apply auth to all routes
router.use(authenticate);

// GET /api/contacts - List all contacts
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { search, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { userId: req.user!.id };

    // Search by name or phone number
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limitNum,
      }),
      prisma.contact.count({ where }),
    ]);

    res.json({
      success: true,
      data: contacts,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        hasMore: skip + contacts.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/contacts/by-phone/:phone - Lookup contact by phone number
router.get('/by-phone/:phone', async (req: AuthRequest, res, next) => {
  try {
    const { phone } = req.params;
    
    // Normalize phone number - remove all non-digits
    const normalizedPhone = phone.replace(/\D/g, '');
    
    // Try to find contact with exact match or normalized match
    const contact = await prisma.contact.findFirst({
      where: {
        userId: req.user!.id,
        OR: [
          { phoneNumber: phone },
          { phoneNumber: normalizedPhone },
          { phoneNumber: `+${normalizedPhone}` },
          { phoneNumber: `+1${normalizedPhone}` },
        ],
      },
    });

    if (!contact) {
      return res.json({
        success: true,
        data: null,
      });
    }

    res.json({
      success: true,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/contacts/batch - Lookup multiple contacts by phone numbers
router.post('/batch', async (req: AuthRequest, res, next) => {
  try {
    const { phoneNumbers } = req.body;

    if (!Array.isArray(phoneNumbers)) {
      throw createError('phoneNumbers must be an array', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Normalize all phone numbers
    const normalizedNumbers = phoneNumbers.map(phone => {
      const normalized = phone.replace(/\D/g, '');
      return [phone, normalized, `+${normalized}`, `+1${normalized}`];
    }).flat();

    const contacts = await prisma.contact.findMany({
      where: {
        userId: req.user!.id,
        phoneNumber: { in: normalizedNumbers },
      },
    });

    // Create a map of phone number to contact for easy lookup
    const contactMap: Record<string, typeof contacts[0]> = {};
    for (const contact of contacts) {
      const normalized = contact.phoneNumber.replace(/\D/g, '');
      contactMap[contact.phoneNumber] = contact;
      contactMap[normalized] = contact;
      contactMap[`+${normalized}`] = contact;
      contactMap[`+1${normalized}`] = contact;
    }

    res.json({
      success: true,
      data: contactMap,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/contacts/:id - Get single contact
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const contact = await prisma.contact.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!contact) {
      throw createError('Contact not found', 404, ERROR_CODES.NOT_FOUND);
    }

    res.json({
      success: true,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/contacts - Create contact
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { name, phoneNumber, notes } = req.body;

    if (!name || !phoneNumber) {
      throw createError('Name and phone number are required', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Normalize phone number for storage
    const normalizedPhone = phoneNumber.replace(/\D/g, '');
    const formattedPhone = normalizedPhone.startsWith('1') && normalizedPhone.length === 11
      ? `+${normalizedPhone}`
      : normalizedPhone.length === 10
        ? `+1${normalizedPhone}`
        : phoneNumber;

    // Check if contact already exists
    const existing = await prisma.contact.findFirst({
      where: {
        userId: req.user!.id,
        phoneNumber: formattedPhone,
      },
    });

    if (existing) {
      throw createError('A contact with this phone number already exists', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const contact = await prisma.contact.create({
      data: {
        name,
        phoneNumber: formattedPhone,
        notes: notes || null,
        userId: req.user!.id,
      },
    });

    res.status(201).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/contacts/:id - Update contact
router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, notes } = req.body;

    // Verify ownership
    const existing = await prisma.contact.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!existing) {
      throw createError('Contact not found', 404, ERROR_CODES.NOT_FOUND);
    }

    // If phone number is changing, check for duplicates
    if (phoneNumber && phoneNumber !== existing.phoneNumber) {
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      const formattedPhone = normalizedPhone.startsWith('1') && normalizedPhone.length === 11
        ? `+${normalizedPhone}`
        : normalizedPhone.length === 10
          ? `+1${normalizedPhone}`
          : phoneNumber;

      const duplicate = await prisma.contact.findFirst({
        where: {
          userId: req.user!.id,
          phoneNumber: formattedPhone,
          id: { not: id },
        },
      });

      if (duplicate) {
        throw createError('A contact with this phone number already exists', 400, ERROR_CODES.VALIDATION_ERROR);
      }
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        phoneNumber: phoneNumber ?? existing.phoneNumber,
        notes: notes !== undefined ? notes : existing.notes,
      },
    });

    res.json({
      success: true,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/contacts/:id - Delete contact
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.contact.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!existing) {
      throw createError('Contact not found', 404, ERROR_CODES.NOT_FOUND);
    }

    await prisma.contact.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Contact deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;

