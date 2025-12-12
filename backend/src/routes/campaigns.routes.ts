// ============================================
// Campaign Routes
// ============================================

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error-handler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ERROR_CODES } from '../lib/constants';
import { campaignService } from '../services/campaign.service';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';

const router = Router();

// Apply auth to all routes
router.use(authenticate);

// Validation schemas
const createCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  agentId: z.string().min(1, 'Invalid agent ID'), // Removed .uuid() validation to support CUIDs
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  callWindowStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  callWindowEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  dailyCallLimit: z.number().int().min(1).max(1000).default(100),
  callsPerHour: z.number().int().min(1).max(100).optional(),
  minCallInterval: z.number().int().min(10).max(300).default(30),
  maxRetryAttempts: z.number().int().min(0).max(10).default(3),
  retryInterval: z.number().int().min(300).max(86400).default(3600),
});

const updateCampaignSchema = createCampaignSchema.partial();

const addLeadSchema = z.object({
  name: z.string().optional(),
  phoneNumber: z.string().min(10, 'Valid phone number required'),
  email: z.string().email().optional(),
  metadata: z.record(z.any()).optional(),
});

const addLeadsArraySchema = z.array(addLeadSchema);

// GET /api/campaigns - List campaigns
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { userId: req.user!.id };

    if (status && typeof status === 'string') {
      where.status = status.toUpperCase();
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: {
          agent: {
            select: {
              name: true,
              voice: true,
              isActive: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.campaign.count({ where }),
    ]);

    res.json({
      success: true,
      data: campaigns,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        hasMore: skip + campaigns.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/campaigns/:id - Get single campaign
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            voice: true,
            isActive: true,
            voiceProvider: true,
          },
        },
      },
    });

    if (!campaign) {
      throw createError('Campaign not found', 404, ERROR_CODES.NOT_FOUND);
    }

    res.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/campaigns - Create campaign
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createCampaignSchema.parse(req.body);

    // Verify agent ownership
    const agent = await prisma.agent.findFirst({
      where: {
        id: data.agentId,
        userId: req.user!.id,
        isActive: true,
      },
    });

    if (!agent) {
      throw createError('Agent not found or inactive', 404, ERROR_CODES.AGENT_NOT_FOUND);
    }

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        ...data,
        userId: req.user!.id,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
      include: {
        agent: {
          select: {
            name: true,
            voice: true,
            isActive: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/campaigns/:id - Update campaign
router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const data = updateCampaignSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.campaign.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!existing) {
      throw createError('Campaign not found', 404, ERROR_CODES.NOT_FOUND);
    }

    // Can't edit active campaigns
    if (existing.status === 'ACTIVE') {
      throw createError('Cannot edit active campaign. Pause it first.', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // If changing agent, verify new agent
    if (data.agentId && data.agentId !== existing.agentId) {
      const agent = await prisma.agent.findFirst({
        where: {
          id: data.agentId,
          userId: req.user!.id,
          isActive: true,
        },
      });

      if (!agent) {
        throw createError('Agent not found or inactive', 404, ERROR_CODES.AGENT_NOT_FOUND);
      }
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      include: {
        agent: {
          select: {
            name: true,
            voice: true,
            isActive: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/campaigns/:id - Delete campaign
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.campaign.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!existing) {
      throw createError('Campaign not found', 404, ERROR_CODES.NOT_FOUND);
    }

    // Can't delete active campaigns
    if (existing.status === 'ACTIVE') {
      throw createError('Cannot delete active campaign. Pause or cancel it first.', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    await prisma.campaign.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Campaign deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/campaigns/:id/start - Start/resume campaign
router.post('/:id/start', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    await campaignService.startCampaign(id, req.user!.id);

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        agent: {
          select: {
            name: true,
            voice: true,
            isActive: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: campaign,
      message: 'Campaign started successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/campaigns/:id/pause - Pause campaign
router.post('/:id/pause', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    await campaignService.pauseCampaign(id, req.user!.id);

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        agent: {
          select: {
            name: true,
            voice: true,
            isActive: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: campaign,
      message: 'Campaign paused successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/campaigns/:id/cancel - Cancel campaign
router.post('/:id/cancel', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    await campaignService.cancelCampaign(id, req.user!.id);

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        agent: {
          select: {
            name: true,
            voice: true,
            isActive: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: campaign,
      message: 'Campaign cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/campaigns/:id/leads - Add leads manually
router.post('/:id/leads', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const leadsData = addLeadsArraySchema.parse(req.body);

    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!campaign) {
      throw createError('Campaign not found', 404, ERROR_CODES.NOT_FOUND);
    }

    // Normalize phone numbers
    const normalizedLeads = leadsData.map((lead) => ({
      ...lead,
      phoneNumber: lead.phoneNumber.replace(/\D/g, '').replace(/^1/, '+1'),
      campaignId: id,
    }));

    // Create leads (duplicates will be handled by unique constraint)
    const createdLeads = [];
    const errors = [];

    for (const lead of normalizedLeads) {
      try {
        const created = await prisma.campaignLead.create({
          data: lead,
        });
        createdLeads.push(created);
      } catch (error: any) {
        if (error.code === 'P2002') {
          errors.push({ phoneNumber: lead.phoneNumber, error: 'Duplicate phone number' });
        } else {
          errors.push({ phoneNumber: lead.phoneNumber, error: error.message });
        }
      }
    }

    // Update campaign total leads
    await prisma.campaign.update({
      where: { id },
      data: {
        totalLeads: { increment: createdLeads.length },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        created: createdLeads.length,
        errors: errors.length,
        leads: createdLeads,
        errorDetails: errors,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/campaigns/:id/leads/upload - Bulk CSV upload
router.post('/:id/leads/upload', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { csvData } = req.body;

    if (!csvData || typeof csvData !== 'string') {
      throw createError('CSV data is required', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!campaign) {
      throw createError('Campaign not found', 404, ERROR_CODES.NOT_FOUND);
    }

    // Parse CSV
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    // Map CSV records to leads
    const leads = records.map((record: any) => {
      const phoneNumber = (record.phone || record.phoneNumber || record.Phone || record.PhoneNumber || '').replace(/\D/g, '');
      
      if (!phoneNumber || phoneNumber.length < 10) {
        return null; // Skip invalid phone numbers
      }

      return {
        name: record.name || record.Name || null,
        phoneNumber: phoneNumber.startsWith('1') && phoneNumber.length === 11 ? `+${phoneNumber}` : `+1${phoneNumber}`,
        email: record.email || record.Email || null,
        metadata: record,
        campaignId: id,
      };
    }).filter(Boolean);

    // Create leads in batch
    const createdCount = await prisma.campaignLead.createMany({
      data: leads,
      skipDuplicates: true, // This will skip inserting records that would violate a unique constraint (e.g., duplicate phone number in the same campaign)
    });

    // Update campaign total leads
    await prisma.campaign.update({
      where: { id },
      data: {
        totalLeads: { increment: createdCount.count },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        total: records.length,
        created: createdCount.count,
        errors: records.length - createdCount.count,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/campaigns/:id/leads - List leads
router.get('/:id/leads', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { status, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!campaign) {
      throw createError('Campaign not found', 404, ERROR_CODES.NOT_FOUND);
    }

    const where: any = { campaignId: id };

    if (status && typeof status === 'string') {
      where.status = status.toUpperCase();
    }

    const [leads, total] = await Promise.all([
      prisma.campaignLead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.campaignLead.count({ where }),
    ]);

    res.json({
      success: true,
      data: leads,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        hasMore: skip + leads.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/campaigns/:id/leads/:leadId - Update lead
router.patch('/:id/leads/:leadId', async (req: AuthRequest, res, next) => {
  try {
    const { id, leadId } = req.params;
    const { status, notes } = req.body;

    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!campaign) {
      throw createError('Campaign not found', 404, ERROR_CODES.NOT_FOUND);
    }

    // Update lead
    const lead = await prisma.campaignLead.update({
      where: { id: leadId },
      data: {
        status: status || undefined,
        notes: notes !== undefined ? notes : undefined,
      },
    });

    res.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/campaigns/:id/leads/:leadId - Remove lead
router.delete('/:id/leads/:leadId', async (req: AuthRequest, res, next) => {
  try {
    const { id, leadId } = req.params;

    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!campaign) {
      throw createError('Campaign not found', 404, ERROR_CODES.NOT_FOUND);
    }

    await prisma.campaignLead.delete({
      where: { id: leadId },
    });

    // Update campaign total leads
    await prisma.campaign.update({
      where: { id },
      data: {
        totalLeads: { decrement: 1 },
      },
    });

    res.json({
      success: true,
      message: 'Lead removed successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/campaigns/:id/stats - Get campaign statistics
router.get('/:id/stats', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const stats = await campaignService.getCampaignStats(id, req.user!.id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/campaigns/:id/leads/:leadId/convert-to-contact - Convert lead to contact
router.post('/:id/leads/:leadId/convert-to-contact', async (req: AuthRequest, res, next) => {
  try {
    const { id, leadId } = req.params;

    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!campaign) {
      throw createError('Campaign not found', 404, ERROR_CODES.NOT_FOUND);
    }

    // Get lead
    const lead = await prisma.campaignLead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw createError('Lead not found', 404, ERROR_CODES.NOT_FOUND);
    }

    // Check if contact already exists
    const existingContact = await prisma.contact.findFirst({
      where: {
        userId: req.user!.id,
        phoneNumber: lead.phoneNumber,
      },
    });

    if (existingContact) {
      return res.json({
        success: true,
        data: existingContact,
        message: 'Contact already exists',
      });
    }

    // Create contact
    const contact = await prisma.contact.create({
      data: {
        userId: req.user!.id,
        name: lead.name || undefined,
        phoneNumber: lead.phoneNumber,
        email: lead.email || undefined,
        notes: lead.notes ? `Converted from campaign: ${campaign.name}\n${lead.notes}` : `Converted from campaign: ${campaign.name}`,
      },
    });

    res.status(201).json({
      success: true,
      data: contact,
      message: 'Lead converted to contact successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/campaigns/:id/convert-successful-leads - Bulk convert successful leads to contacts
router.post('/:id/convert-successful-leads', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!campaign) {
      throw createError('Campaign not found', 404, ERROR_CODES.NOT_FOUND);
    }

    // Get successful leads (completed with outcome: answered)
    const successfulLeads = await prisma.campaignLead.findMany({
      where: {
        campaignId: id,
        status: 'COMPLETED',
        outcome: 'answered',
      },
    });

    let created = 0;
    let skipped = 0;

    for (const lead of successfulLeads) {
      // Check if contact already exists
      const existingContact = await prisma.contact.findFirst({
        where: {
          userId: req.user!.id,
          phoneNumber: lead.phoneNumber,
        },
      });

      if (existingContact) {
        skipped++;
        continue;
      }

      // Create contact
      await prisma.contact.create({
        data: {
          userId: req.user!.id,
          name: lead.name || undefined,
          phoneNumber: lead.phoneNumber,
          email: lead.email || undefined,
          notes: lead.notes ? `Converted from campaign: ${campaign.name}\n${lead.notes}` : `Converted from campaign: ${campaign.name}`,
        },
      });

      created++;
    }

    res.json({
      success: true,
      data: {
        created,
        skipped,
        total: successfulLeads.length,
      },
      message: `Converted ${created} leads to contacts (${skipped} already existed)`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

