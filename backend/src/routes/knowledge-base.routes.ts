// ============================================
// Knowledge Base Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { knowledgeBaseService } from '../services/knowledge-base.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/error-handler';

const router = Router();

/**
 * GET /api/knowledge-base/structure
 * Returns the documentation structure (folder tree)
 * Public endpoint - but filters content by user role
 */
router.get('/structure', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Try to get user from auth header (optional)
    let isAdmin = false;
    
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        // Attempt to authenticate to get user role
        const tempReq = req as AuthRequest;
        await new Promise<void>((resolve, reject) => {
          authenticate(tempReq, res, (err?: any) => {
            if (err) {
              // Auth failed, treat as non-admin
              resolve();
            } else {
              isAdmin = tempReq.user?.role === 'ADMIN';
              resolve();
            }
          });
        });
      } catch {
        // Auth failed, continue as non-admin
      }
    }

    // Build full structure
    const structure = await knowledgeBaseService.buildDocStructure();

    // Filter by role
    const filteredStructure = knowledgeBaseService.filterStructureByRole(structure, isAdmin);

    res.json({
      success: true,
      data: filteredStructure,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/knowledge-base/content
 * Returns the content of a specific document
 * Query params: path (required)
 * Public endpoint - but validates access based on path
 */
router.get('/content', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: docPath } = req.query;

    if (!docPath || typeof docPath !== 'string') {
      throw createError('Path parameter is required', 400, 'VALIDATION_ERROR');
    }

    // Check if path is admin-only
    const isAdminOnly = knowledgeBaseService.isAdminOnlyPath(docPath);
    
    if (isAdminOnly) {
      // Require authentication for admin-only paths
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        throw createError('Authentication required', 401, 'UNAUTHORIZED');
      }

      // Verify user is admin
      let isAdmin = false;
      const tempReq = req as AuthRequest;
      
      await new Promise<void>((resolve, reject) => {
        authenticate(tempReq, res, (err?: any) => {
          if (err) {
            reject(err);
          } else {
            isAdmin = tempReq.user?.role === 'ADMIN';
            resolve();
          }
        });
      });

      if (!isAdmin) {
        throw createError('Access denied: Admin only content', 403, 'FORBIDDEN');
      }
    }

    // Check if this is a folder
    const isFolder = await knowledgeBaseService.isFolder(docPath);
    
    if (isFolder) {
      // Generate folder index content
      const content = await knowledgeBaseService.generateFolderContent(docPath);
      return res.json({
        success: true,
        data: {
          content,
          path: docPath,
          isFolder: true,
        },
      });
    }

    // Get document content
    try {
      const docContent = await knowledgeBaseService.getDocContent(docPath);
      res.json({
        success: true,
        data: docContent,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        // Return fallback content for missing docs
        const fallbackContent = knowledgeBaseService.getFallbackDocContent(docPath);
        res.status(404).json({
          success: false,
          data: {
            content: fallbackContent,
            path: docPath,
            isFallback: true,
          },
          error: 'Document not found',
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/knowledge-base/search
 * Search documents by query
 * Query params: q (required)
 * Public endpoint - filters results by user role
 */
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q: query } = req.query;

    if (!query || typeof query !== 'string') {
      throw createError('Query parameter (q) is required', 400, 'VALIDATION_ERROR');
    }

    if (query.length < 2) {
      throw createError('Query must be at least 2 characters', 400, 'VALIDATION_ERROR');
    }

    // Try to get user role
    let isAdmin = false;
    const authHeader = req.headers.authorization;
    
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const tempReq = req as AuthRequest;
        await new Promise<void>((resolve) => {
          authenticate(tempReq, res, (err?: any) => {
            if (!err) {
              isAdmin = tempReq.user?.role === 'ADMIN';
            }
            resolve();
          });
        });
      } catch {
        // Continue as non-admin
      }
    }

    // Search documents
    const results = await knowledgeBaseService.searchDocuments(query);

    // Filter results by role
    const filteredResults = isAdmin
      ? results
      : results.filter(result => !knowledgeBaseService.isAdminOnlyPath(result.path));

    res.json({
      success: true,
      data: filteredResults,
      meta: {
        query,
        count: filteredResults.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
