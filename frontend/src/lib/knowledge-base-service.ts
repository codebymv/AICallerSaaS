// ============================================
// Knowledge Base Service (Frontend)
// ============================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface DocStructure {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: DocStructure[];
}

export interface DocContent {
  content: string;
  path: string;
  lastModified?: string;
  size?: number;
  isFolder?: boolean;
  isFallback?: boolean;
}

export interface SearchResult {
  name: string;
  path: string;
  type: 'file' | 'folder';
  excerpt: string;
}

class KnowledgeBaseService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/api/knowledge-base`;
  }

  /**
   * Get auth headers from localStorage token
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Get documentation structure (folder tree)
   */
  async getDocStructure(): Promise<DocStructure[]> {
    try {
      const response = await fetch(`${this.baseUrl}/structure`, {
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[KnowledgeBase] Failed to fetch structure:', data);
        return [];
      }

      return data.data || [];
    } catch (error) {
      console.error('[KnowledgeBase] Error fetching structure:', error);
      return [];
    }
  }

  /**
   * Get content for a specific document path
   */
  async getDocContent(path: string): Promise<DocContent> {
    try {
      const response = await fetch(
        `${this.baseUrl}/content?path=${encodeURIComponent(path)}`,
        {
          headers: this.getHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok && response.status !== 404) {
        throw new Error(data.error || 'Failed to fetch document');
      }

      // Handle 404 with fallback content
      if (response.status === 404 && data.data) {
        return {
          content: data.data.content,
          path: data.data.path,
          isFallback: true,
        };
      }

      return data.data;
    } catch (error) {
      console.error('[KnowledgeBase] Error fetching content:', error);
      throw error;
    }
  }

  /**
   * Search documents by query
   */
  async searchDocuments(query: string): Promise<SearchResult[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/search?q=${encodeURIComponent(query)}`,
        {
          headers: this.getHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('[KnowledgeBase] Search failed:', data);
        return [];
      }

      return data.data || [];
    } catch (error) {
      console.error('[KnowledgeBase] Error searching:', error);
      return [];
    }
  }

  /**
   * Generate folder index content (client-side fallback)
   */
  generateFolderContent(path: string, children?: DocStructure[]): string {
    const folderName = this.formatName(path.split('/').pop() || 'Documentation');

    const items: string[] = [];

    if (children) {
      for (const child of children) {
        if (child.type === 'folder') {
          items.push(`- 📁 **${child.name}**`);
        } else {
          items.push(`- 📄 ${child.name}`);
        }
      }
    }

    return `# ${folderName}

## Contents

${items.length > 0 ? items.join('\n') : '*No documents in this folder.*'}
`;
  }

  /**
   * Format path segment to display name
   */
  formatName(name: string): string {
    return name
      .replace(/^!+/, '')
      .replace(/^\$+/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  /**
   * Find item by path in structure tree
   */
  findItemByPath(items: DocStructure[], path: string): DocStructure | null {
    for (const item of items) {
      if (item.path === path) {
        return item;
      }
      if (item.children) {
        const found = this.findItemByPath(item.children, path);
        if (found) return found;
      }
    }
    return null;
  }
}

// Export singleton instance
export const knowledgeBaseService = new KnowledgeBaseService();
