'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronDown,
  Home,
  Search,
  FileText,
  Folder,
  Menu,
  X,
  BookOpen,
  ArrowLeft,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Type fix for react-markdown with React 18
const MarkdownRenderer = Markdown as React.ComponentType<{
  children: string;
  remarkPlugins?: any[];
}>;

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  knowledgeBaseService,
  DocStructure,
} from '@/lib/knowledge-base-service';

interface Breadcrumb {
  name: string;
  path: string;
}

export default function KnowledgeBasePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [docStructure, setDocStructure] = useState<DocStructure[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const mainContentRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get the path from URL search params
  const pathParam = searchParams.get('path') || '';

  // Default to getting-started if no path
  useEffect(() => {
    if (!pathParam) {
      router.replace('/dashboard/knowledge-base?path=getting-started');
    }
  }, [pathParam, router]);

  // Load document structure on mount
  useEffect(() => {
    const loadDocStructure = async () => {
      try {
        const structure = await knowledgeBaseService.getDocStructure();
        setDocStructure(structure);
        // Auto-expand folders for current path
        if (pathParam) {
          expandCurrentPath(pathParam, structure);
        }
      } catch (error) {
        console.error('Failed to load doc structure:', error);
      }
    };
    loadDocStructure();
  }, []);

  // Auto-expand current path when path changes
  useEffect(() => {
    if (docStructure.length > 0 && pathParam) {
      expandCurrentPath(pathParam, docStructure);
    }
  }, [pathParam, docStructure]);

  // Load content when path changes
  useEffect(() => {
    if (!pathParam) return;

    const loadContent = async () => {
      setLoading(true);
      try {
        const docContent = await knowledgeBaseService.getDocContent(pathParam);
        setContent(docContent.content);
      } catch (error) {
        console.error('Failed to load content:', error);
        setContent(`# Error\n\nFailed to load document: ${pathParam}`);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
    updateBreadcrumbs(pathParam);

    // Close sidebar on mobile when navigating
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [pathParam]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchTerm.length >= 2) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await knowledgeBaseService.searchDocuments(searchTerm);
          setSearchResults(results);
        } catch (error) {
          console.error('Search failed:', error);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Auto-expand folders in search results
  useEffect(() => {
    if (searchTerm && searchResults.length > 0) {
      const newExpanded = new Set(expandedFolders);
      searchResults.forEach((result) => {
        const segments = result.path.split('/');
        let path = '';
        for (let i = 0; i < segments.length - 1; i++) {
          path = path ? `${path}/${segments[i]}` : segments[i];
          const item = knowledgeBaseService.findItemByPath(docStructure, path);
          if (item?.type === 'folder') {
            newExpanded.add(path);
          }
        }
      });
      setExpandedFolders(newExpanded);
    }
  }, [searchResults]);

  const expandCurrentPath = (currentPath: string, structure: DocStructure[]) => {
    const segments = currentPath.split('/');
    const newExpanded = new Set(expandedFolders);

    let path = '';
    for (const segment of segments) {
      path = path ? `${path}/${segment}` : segment;
      const item = knowledgeBaseService.findItemByPath(structure, path);
      if (item?.type === 'folder') {
        newExpanded.add(path);
      }
    }

    setExpandedFolders(newExpanded);
  };

  const updateBreadcrumbs = (path: string) => {
    const segments = path.split('/').filter(Boolean);
    const crumbs: Breadcrumb[] = [
      { name: 'Knowledge Base', path: '/dashboard/knowledge-base?path=getting-started' },
    ];

    let currentPath = '';
    segments.forEach((segment) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      crumbs.push({
        name: knowledgeBaseService.formatName(segment),
        path: `/dashboard/knowledge-base?path=${encodeURIComponent(currentPath)}`,
      });
    });

    setBreadcrumbs(crumbs);
  };

  const toggleFolder = (folderPath: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  const navigateTo = (path: string) => {
    router.push(`/dashboard/knowledge-base?path=${encodeURIComponent(path)}`);
  };

  // Filter structure by search term
  const getFilteredStructure = (
    items: DocStructure[],
    term: string
  ): DocStructure[] => {
    if (!term) return items;

    const filtered: DocStructure[] = [];

    items.forEach((item) => {
      if (item.name.toLowerCase().includes(term.toLowerCase())) {
        filtered.push(item);
      } else if (item.children) {
        const filteredChildren = getFilteredStructure(item.children, term);
        if (filteredChildren.length > 0) {
          filtered.push({
            ...item,
            children: filteredChildren,
          });
        }
      }
    });

    return filtered;
  };

  const filteredStructure = getFilteredStructure(docStructure, searchTerm);

  // Render document tree
  const renderDocTree = (items: DocStructure[], level = 0) => {
    return items.map((item) => {
      const isExpanded = expandedFolders.has(item.path);
      const hasChildren = item.children && item.children.length > 0;
      const isActive = pathParam === item.path;

      return (
        <div key={item.path} style={{ marginLeft: `${level * 12}px` }}>
          <div className="flex items-center">
            {item.type === 'folder' ? (
              <button
                onClick={(e) => toggleFolder(item.path, e)}
                className="flex items-center w-full px-3 py-2 rounded-md text-sm transition-colors group hover:bg-slate-100"
              >
                <div className="flex items-center min-w-0 flex-1">
                  {hasChildren && (
                    <div className="mr-1 flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                  )}
                  <Folder className="h-4 w-4 mr-2 flex-shrink-0 text-teal-500" />
                  <span className="truncate text-slate-600 group-hover:text-slate-900">
                    {item.name}
                  </span>
                </div>
              </button>
            ) : (
              <button
                onClick={() => navigateTo(item.path)}
                className={`flex items-center w-full px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <FileText
                  className={`h-4 w-4 mr-2 flex-shrink-0 ${
                    isActive ? 'text-teal-600' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.name}</span>
              </button>
            )}
          </div>

          {item.type === 'folder' && hasChildren && isExpanded && item.children && (
            <div className="ml-2 border-l border-slate-200 pl-2 mt-1">
              {renderDocTree(item.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex w-full">
        {/* Sidebar */}
        <div
          ref={sidebarRef}
          id="kb-sidebar"
          className={`${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 transition-transform duration-300 ease-in-out fixed lg:relative inset-y-0 left-0 z-50 w-full sm:w-80 lg:w-72 max-w-sm bg-white border-r border-slate-200 lg:min-h-screen flex flex-col`}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-teal-600" />
                <h2 className="text-lg font-semibold text-slate-900">Knowledge Base</h2>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-1 rounded-md hover:bg-slate-100"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search docs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
              )}
            </div>

            {/* Search Results */}
            {searchTerm.length >= 2 && searchResults.length > 0 && (
              <div className="mt-2 p-2 bg-slate-50 rounded-md border border-slate-200 max-h-60 overflow-y-auto">
                <p className="text-xs text-slate-500 mb-2">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </p>
                {searchResults.map((result) => (
                  <button
                    key={result.path}
                    onClick={() => {
                      navigateTo(result.path);
                      setSearchTerm('');
                    }}
                    className="w-full text-left p-2 rounded hover:bg-white text-sm"
                  >
                    <div className="font-medium text-slate-700">{result.name}</div>
                    <div className="text-xs text-slate-500 truncate">{result.excerpt}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Navigation Tree */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">{renderDocTree(filteredStructure)}</div>
          </div>
        </div>

        {/* Main Content */}
        <div ref={mainContentRef} className="flex-1 min-h-screen">
          {/* Top Bar */}
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md hover:bg-slate-100"
              >
                <Menu className="h-5 w-5 text-slate-600" />
              </button>

              {/* Back to Dashboard */}
              <Link
                href="/dashboard"
                className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>

              {/* Breadcrumbs */}
              <nav className="flex items-center overflow-x-auto" aria-label="Breadcrumb">
                <ol className="inline-flex items-center space-x-1 whitespace-nowrap">
                  {breadcrumbs.map((crumb, index) => (
                    <li key={crumb.path} className="inline-flex items-center">
                      {index > 0 && (
                        <ChevronRight className="w-4 h-4 text-slate-400 mx-1" />
                      )}
                      {index === 0 && (
                        <Home className="w-4 h-4 text-slate-400 mr-1" />
                      )}
                      <Link
                        href={crumb.path}
                        className={`text-sm ${
                          index === breadcrumbs.length - 1
                            ? 'text-slate-500'
                            : 'text-teal-600 hover:text-teal-700'
                        }`}
                      >
                        {crumb.name}
                      </Link>
                    </li>
                  ))}
                </ol>
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
              </div>
            ) : (
              <article className="prose prose-slate prose-lg max-w-none prose-headings:text-slate-900 prose-p:text-slate-600 prose-a:text-teal-600 prose-a:no-underline hover:prose-a:underline prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-teal-700 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-blockquote:border-l-teal-500 prose-blockquote:bg-teal-50 prose-blockquote:py-1 prose-blockquote:not-italic prose-th:bg-slate-50 prose-table:border prose-table:border-slate-200">
                <MarkdownRenderer remarkPlugins={[remarkGfm]}>
                  {content}
                </MarkdownRenderer>
              </article>
            )}
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
