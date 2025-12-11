// ============================================
// Asset Routes - Media files for messaging agents
// ============================================
// 
// Assets are pre-uploaded media files (images, documents, videos) that agents
// can send during messaging conversations. Currently URL-based storage.
//
// TODO: S3 Integration
// When S3 is configured, add file upload functionality:
// 1. Install multer and @aws-sdk/client-s3
// 2. Add upload middleware for file handling
// 3. Create S3 upload service in /services/storage.service.ts
// 4. Update POST route to accept file uploads instead of just URLs
// 5. Add presigned URL generation for secure file access
// 6. Consider separate buckets for different asset types
//
// For now, assets are stored as external URLs that must be publicly accessible
// for Twilio to fetch them when sending MMS messages.

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error-handler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createAssetSchema, updateAssetSchema } from '../lib/validators';

const router = Router();

// Apply auth to all routes
router.use(authenticate);

// GET /api/assets - List all assets for the user
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { category, agentId } = req.query;
    
    const where: any = { userId: req.user!.id };
    
    // Filter by category if provided
    if (category && ['IMAGE', 'DOCUMENT', 'VIDEO', 'OTHER'].includes(category as string)) {
      where.category = category;
    }
    
    // Filter by agent if provided (null = unassigned/global assets)
    if (agentId) {
      where.agentId = agentId === 'global' ? null : agentId;
    }
    
    const assets = await prisma.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        agent: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(assets);
  } catch (error) {
    next(error);
  }
});

// GET /api/assets/:id - Get a single asset
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    
    const asset = await prisma.asset.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
      include: {
        agent: {
          select: { id: true, name: true },
        },
      },
    });
    
    if (!asset) {
      throw createError('Asset not found', 404, 'ASSET_NOT_FOUND');
    }

    res.json(asset);
  } catch (error) {
    next(error);
  }
});

// POST /api/assets - Create a new asset (URL-based for now)
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createAssetSchema.parse(req.body);
    
    // If agentId provided, verify the user owns that agent
    if (data.agentId) {
      const agent = await prisma.agent.findFirst({
        where: { id: data.agentId, userId: req.user!.id },
      });
      if (!agent) {
        throw createError('Agent not found', 404, 'AGENT_NOT_FOUND');
      }
    }
    
    const asset = await prisma.asset.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        url: data.url,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        userId: req.user!.id,
        agentId: data.agentId || null,
      },
      include: {
        agent: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json(asset);
  } catch (error) {
    next(error);
  }
});

// TODO: POST /api/assets/upload - Upload a file directly
// This endpoint will be implemented when S3 is configured
// router.post('/upload', upload.single('file'), async (req: AuthRequest, res, next) => {
//   try {
//     // 1. Validate file type against category
//     // 2. Upload to S3 with appropriate bucket/key
//     // 3. Generate public URL
//     // 4. Create asset record with storage info
//     // 5. Return asset with URL
//   } catch (error) {
//     next(error);
//   }
// });

// PUT /api/assets/:id - Update an asset
router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const data = updateAssetSchema.parse(req.body);
    
    // Verify ownership
    const existing = await prisma.asset.findFirst({
      where: { id, userId: req.user!.id },
    });
    
    if (!existing) {
      throw createError('Asset not found', 404, 'ASSET_NOT_FOUND');
    }
    
    // If changing agentId, verify ownership
    if (data.agentId) {
      const agent = await prisma.agent.findFirst({
        where: { id: data.agentId, userId: req.user!.id },
      });
      if (!agent) {
        throw createError('Agent not found', 404, 'AGENT_NOT_FOUND');
      }
    }
    
    const asset = await prisma.asset.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        url: data.url,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        agentId: data.agentId,
      },
      include: {
        agent: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(asset);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/assets/:id - Delete an asset
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const asset = await prisma.asset.findFirst({
      where: { id, userId: req.user!.id },
    });
    
    if (!asset) {
      throw createError('Asset not found', 404, 'ASSET_NOT_FOUND');
    }
    
    // TODO: When S3 is implemented, delete the file from storage
    // if (asset.storageKey) {
    //   await s3Service.deleteObject(asset.storageKey);
    // }
    
    await prisma.asset.delete({ where: { id } });

    res.json({ success: true, message: 'Asset deleted' });
  } catch (error) {
    next(error);
  }
});

// GET /api/assets/categories/stats - Get asset counts by category
router.get('/categories/stats', async (req: AuthRequest, res, next) => {
  try {
    const stats = await prisma.asset.groupBy({
      by: ['category'],
      where: { userId: req.user!.id },
      _count: { id: true },
    });
    
    const categoryStats = {
      IMAGE: 0,
      DOCUMENT: 0,
      VIDEO: 0,
      OTHER: 0,
    };
    
    stats.forEach((stat) => {
      categoryStats[stat.category as keyof typeof categoryStats] = stat._count.id;
    });

    res.json(categoryStats);
  } catch (error) {
    next(error);
  }
});

export default router;
