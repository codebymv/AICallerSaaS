// ============================================
// Knowledge Base Service
// ============================================

import { promises as fs } from 'fs';
import * as path from 'path';

export interface DocStructure {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: DocStructure[];
}

export interface DocContent {
  content: string;
  path: string;
  lastModified: string;
  size: number;
}

export interface SearchResult {
  name: string;
  path: string;
  type: 'file' | 'folder';
  excerpt: string;
}

class KnowledgeBaseService {
  private docsBasePath: string;

  constructor() {
    this.docsBasePath = this.findDocsPath();
    console.log(`[KnowledgeBase] Service initialized with base path: ${this.docsBasePath}`);
  }

  /**
   * Find the docs folder with fallback hierarchy:
   * 1. backend/knowledge-base (primary - production)
   * 2. process.cwd()/knowledge-base (deployment fallback)
   */
  private findDocsPath(): string {
    const possiblePaths = [
      // Primary: backend/knowledge-base
      path.join(__dirname, '../../knowledge-base'),
      // Fallback: working directory
      path.join(process.cwd(), 'knowledge-base'),
      // Alternative: from dist folder in production
      path.join(__dirname, '../../../knowledge-base'),
    ];

    for (const docsPath of possiblePaths) {
      try {
        const stats = require('fs').statSync(docsPath);
        if (stats.isDirectory()) {
          console.log(`[KnowledgeBase] Found docs directory at: ${docsPath}`);
          return docsPath;
        }
      } catch (e) {
        continue;
      }
    }

    // Return primary path as fallback (will be created if needed)
    console.log(`[KnowledgeBase] No docs folder found, using default: ${possiblePaths[0]}`);
    return possiblePaths[0];
  }

  /**
   * Get markdown content for a specific document path
   */
  async getDocContent(docPath: string): Promise<DocContent> {
    console.log(`[KnowledgeBase] Requesting doc content for path: ${docPath}`);

    // Construct the full file path
    const fileName = docPath.endsWith('.md') ? docPath : `${docPath}.md`;
    const fullPath = path.join(this.docsBasePath, fileName);

    console.log(`[KnowledgeBase] Full file path: ${fullPath}`);

    // Security check: ensure the path is within the docs directory
    const resolvedPath = path.resolve(fullPath);
    const resolvedDocsPath = path.resolve(this.docsBasePath);

    if (!resolvedPath.startsWith(resolvedDocsPath)) {
      console.error(`[KnowledgeBase] Access denied: Path outside docs directory`);
      throw new Error('Access denied: Path outside docs directory');
    }

    try {
      const content = await fs.readFile(resolvedPath, 'utf-8');
      const stats = await fs.stat(resolvedPath);

      console.log(`[KnowledgeBase] Successfully read doc: ${docPath} (${stats.size} bytes)`);

      return {
        content,
        path: docPath,
        lastModified: stats.mtime.toISOString(),
        size: stats.size,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.error(`[KnowledgeBase] File not found: ${docPath}`);
        throw new Error(`Document not found: ${docPath}`);
      }
      console.error(`[KnowledgeBase] Failed to read doc: ${docPath}`, error);
      throw error;
    }
  }

  /**
   * Recursively build the documentation directory structure
   */
  async buildDocStructure(dirPath?: string, relativePath = ''): Promise<DocStructure[]> {
    const currentPath = dirPath || this.docsBasePath;
    const items: DocStructure[] = [];

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);
        const relativeEntryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          const children = await this.buildDocStructure(entryPath, relativeEntryPath);
          items.push({
            name: this.formatName(entry.name),
            path: relativeEntryPath,
            type: 'folder',
            children,
          });
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const nameWithoutExt = entry.name.replace('.md', '');
          const pathWithoutExt = relativeEntryPath.replace('.md', '');

          items.push({
            name: this.formatName(nameWithoutExt),
            path: pathWithoutExt,
            type: 'file',
          });
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log(`[KnowledgeBase] Directory not found: ${currentPath}`);
        return [];
      }
      console.error('[KnowledgeBase] Error reading directory:', error);
      return [];
    }

    // Sort items: '!' prefixed first, then folders, then files, then alphabetically
    return this.sortDocStructure(items);
  }

  /**
   * Sort documentation structure
   * - Items with '!' prefix (top of list marker) come first
   * - Then folders before files
   * - Then alphabetically by path
   */
  private sortDocStructure(items: DocStructure[]): DocStructure[] {
    return items
      .map(item => {
        // Recursively sort children if they exist
        if (item.children) {
          return {
            ...item,
            children: this.sortDocStructure(item.children),
          };
        }
        return item;
      })
      .sort((a, b) => {
        // Extract the last segment of the path to check for prefixes
        const aSegment = a.path.split('/').pop() || '';
        const bSegment = b.path.split('/').pop() || '';

        const aHasExclamation = aSegment.startsWith('!');
        const bHasExclamation = bSegment.startsWith('!');

        // Prioritize '!' prefixed items
        if (aHasExclamation && !bHasExclamation) return -1;
        if (!aHasExclamation && bHasExclamation) return 1;

        // Then sort by type (folders before files)
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;

        // Finally, sort alphabetically by name (case-insensitive)
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
  }

  /**
   * Search documentation files by filename and content
   */
  async searchDocuments(
    query: string,
    dirPath?: string,
    relativePath = '',
    results: SearchResult[] = []
  ): Promise<SearchResult[]> {
    const currentPath = dirPath || this.docsBasePath;
    const lowerQuery = query.toLowerCase();

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);
        const relativeEntryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await this.searchDocuments(query, entryPath, relativeEntryPath, results);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const nameWithoutExt = entry.name.replace('.md', '');
          const pathWithoutExt = relativeEntryPath.replace('.md', '');

          try {
            const content = await fs.readFile(entryPath, 'utf-8');
            const lowerContent = content.toLowerCase();

            // Check if filename or content matches
            if (
              nameWithoutExt.toLowerCase().includes(lowerQuery) ||
              lowerContent.includes(lowerQuery)
            ) {
              const excerpt = this.extractExcerpt(content, query);

              results.push({
                name: this.formatName(nameWithoutExt),
                path: pathWithoutExt,
                type: 'file',
                excerpt,
              });
            }
          } catch (error) {
            console.error(`[KnowledgeBase] Error reading file ${entryPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('[KnowledgeBase] Error searching directory:', error);
    }

    return results;
  }

  /**
   * Extract excerpt around search query
   */
  private extractExcerpt(content: string, query: string, contextLength = 150): string {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);

    if (index === -1) {
      // Return beginning of content if query not found in content
      return content.substring(0, contextLength).trim() + '...';
    }

    const start = Math.max(0, index - contextLength / 2);
    const end = Math.min(content.length, index + query.length + contextLength / 2);

    let excerpt = content.substring(start, end).trim();
    if (start > 0) excerpt = '...' + excerpt;
    if (end < content.length) excerpt = excerpt + '...';

    return excerpt;
  }

  /**
   * Format name for display
   * Removes special prefixes:
   * - '!' for sorting (top of list)
   * - '$' for public visibility marker
   */
  private formatName(name: string): string {
    return name
      .replace(/^!+/, '') // Remove leading '!' (used for sorting)
      .replace(/^\$+/, '') // Remove leading '$' (used for public marker)
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  /**
   * Check if a path is admin-only
   * By default, all docs are public for AICallerSaaS knowledge base
   * '$' prefix marks a doc/folder as explicitly public
   * '!' prefix is for sorting (top of list)
   * No prefix = still public (different from AZLMFullStack)
   * 
   * For AICallerSaaS, we keep all KB articles public but could
   * add an 'internal' folder prefix for admin-only content
   */
  isAdminOnlyPath(path: string): boolean {
    const segments = path.split('/');
    
    // Check if any segment starts with 'internal' (admin-only marker for this app)
    for (const segment of segments) {
      const cleanSegment = segment.replace(/^!+/, '').replace(/^\$+/, '');
      if (cleanSegment.toLowerCase() === 'internal' || cleanSegment.startsWith('_')) {
        return true;
      }
    }
    
    // Everything else is public
    return false;
  }

  /**
   * Filter documentation structure based on user role
   * Removes admin-only items for non-admin users
   */
  filterStructureByRole(structure: DocStructure[], isAdmin: boolean): DocStructure[] {
    if (isAdmin) {
      return structure; // Admin sees everything
    }

    return structure
      .map(item => {
        // For folders, recursively filter children first
        if (item.type === 'folder' && item.children) {
          const filteredChildren = this.filterStructureByRole(item.children, isAdmin);

          // Keep the folder if it's public and has visible children
          const isPublic = !this.isAdminOnlyPath(item.path);
          const hasVisibleChildren = filteredChildren.length > 0;

          if (isPublic && hasVisibleChildren) {
            return {
              ...item,
              children: filteredChildren,
            };
          }

          // If folder itself is public even with no children, keep it
          if (isPublic && !this.isAdminOnlyPath(item.path)) {
            return {
              ...item,
              children: filteredChildren,
            };
          }

          return null;
        }

        // For files, keep only if not admin-only
        if (item.type === 'file') {
          return !this.isAdminOnlyPath(item.path) ? item : null;
        }

        return item;
      })
      .filter(item => item !== null) as DocStructure[];
  }

  /**
   * Get fallback content for missing documents
   */
  getFallbackDocContent(docPath: string): string {
    const fileName = docPath
      .split('/')
      .pop()
      ?.replace(/^!+/, '')
      .replace(/^\$+/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase()) || 'Documentation';

    return `# ${fileName}

## Content Not Available

The content for \`${docPath}\` could not be loaded.

Please check back later or contact support if this issue persists.

---
*This is fallback content.*`;
  }

  /**
   * Generate folder index content (when navigating to a folder)
   */
  async generateFolderContent(folderPath: string): Promise<string> {
    const fullPath = path.join(this.docsBasePath, folderPath);
    const folderName = this.formatName(folderPath.split('/').pop() || 'Documentation');

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const items: string[] = [];

      for (const entry of entries) {
        const entryPath = folderPath ? `${folderPath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          const displayName = this.formatName(entry.name);
          items.push(`- 📁 [${displayName}](/dashboard/knowledge-base?path=${encodeURIComponent(entryPath)})`);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const nameWithoutExt = entry.name.replace('.md', '');
          const pathWithoutExt = entryPath.replace('.md', '');
          const displayName = this.formatName(nameWithoutExt);
          items.push(`- 📄 [${displayName}](/dashboard/knowledge-base?path=${encodeURIComponent(pathWithoutExt)})`);
        }
      }

      return `# ${folderName}

## Contents

${items.length > 0 ? items.join('\n') : '*No documents in this folder.*'}
`;
    } catch (error) {
      return this.getFallbackDocContent(folderPath);
    }
  }

  /**
   * Check if a path is a folder
   */
  async isFolder(docPath: string): Promise<boolean> {
    const fullPath = path.join(this.docsBasePath, docPath);
    try {
      const stats = await fs.stat(fullPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const knowledgeBaseService = new KnowledgeBaseService();
