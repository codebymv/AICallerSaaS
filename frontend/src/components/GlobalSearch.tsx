'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Search, X, Loader2, ChevronRight, Bot, Flag, Users, Phone, MessageSquare, Settings, AudioLines, Hash, LayoutDashboard, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

interface SearchResult {
  id: string;
  type: 'agent' | 'campaign' | 'contact' | 'page';
  title: string;
  subtitle?: string;
  icon?: any;
  href: string;
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

const STATIC_PAGES: SearchResult[] = [
  { id: 'page-dashboard', type: 'page', title: 'Dashboard', subtitle: 'Go to Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'page-agents', type: 'page', title: 'Agents', subtitle: 'Manage AI Agents', icon: Bot, href: '/dashboard/agents' },
  { id: 'page-campaigns', type: 'page', title: 'Campaigns', subtitle: 'Manage Campaigns', icon: Flag, href: '/dashboard/campaigns' },
  { id: 'page-contacts', type: 'page', title: 'Contacts', subtitle: 'Manage Contacts', icon: Users, href: '/dashboard/contacts' },
  { id: 'page-voices', type: 'page', title: 'Voices', subtitle: 'Manage Voices', icon: AudioLines, href: '/dashboard/voices' },
  { id: 'page-dialpad', type: 'page', title: 'Dialpad', subtitle: 'Make Calls', icon: Hash, href: '/dashboard/dialpad' },
  { id: 'page-logs', type: 'page', title: 'Call Logs', subtitle: 'View Call History', icon: PhoneCall, href: '/dashboard/calls' },
  { id: 'page-messaging', type: 'page', title: 'Messaging', subtitle: 'View Messages', icon: MessageSquare, href: '/dashboard/messaging' },
  { id: 'page-settings', type: 'page', title: 'Settings', subtitle: 'App Settings', icon: Settings, href: '/dashboard/settings' },
];

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle keyboard navigation (basic) and escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Search logic
  useEffect(() => {
    const search = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const lowerQuery = query.toLowerCase();
        const allResults: SearchResult[] = [];

        // 1. Static Pages (Client-side)
        const matchedPages = STATIC_PAGES.filter(p => 
          p.title.toLowerCase().includes(lowerQuery) || 
          p.subtitle?.toLowerCase().includes(lowerQuery)
        );
        allResults.push(...matchedPages);

        // 2. Agents (Fetch if not too many, or search API)
        // For responsiveness, we'll fetch only if query > 1 char
        if (query.length > 1) {
          try {
             // Parallel fetch for better performance
             const [agentsRes, campaignsRes] = await Promise.allSettled([
               api.getAgents(),
               api.getCampaigns()
             ]);

             // Process Agents
             if (agentsRes.status === 'fulfilled' && agentsRes.value.data) {
               const matchedAgents = agentsRes.value.data
                 .filter((a: any) => a.name.toLowerCase().includes(lowerQuery))
                 .slice(0, 5)
                 .map((a: any) => ({
                   id: `agent-${a.id}`,
                   type: 'agent' as const,
                   title: a.name,
                   subtitle: 'Agent',
                   icon: Bot,
                   href: `/dashboard/agents/${a.id}`
                 }));
               allResults.push(...matchedAgents);
             }

             // Process Campaigns
             if (campaignsRes.status === 'fulfilled' && campaignsRes.value.data) {
               const matchedCampaigns = campaignsRes.value.data
                 .filter((c: any) => c.name.toLowerCase().includes(lowerQuery))
                 .slice(0, 5)
                 .map((c: any) => ({
                   id: `campaign-${c.id}`,
                   type: 'campaign' as const,
                   title: c.name,
                   subtitle: c.status ? `${c.status.charAt(0) + c.status.slice(1).toLowerCase()} Campaign` : 'Campaign',
                   icon: Flag,
                   href: `/dashboard/campaigns/${c.id}`
                 }));
               allResults.push(...matchedCampaigns);
             }
             
             // Contacts search (if query is long enough)
             if (query.length > 2) {
                try {
                  const contactsRes = await api.getContacts({ search: query, limit: 5 });
                  if (contactsRes.data) {
                    const matchedContacts = contactsRes.data.map((c: any) => ({
                      id: `contact-${c.id}`,
                      type: 'contact' as const,
                      title: c.name || c.phoneNumber,
                      subtitle: c.phoneNumber,
                      icon: Users,
                      href: `/dashboard/contacts` // No detail page for contacts yet usually, just list
                    }));
                    allResults.push(...matchedContacts);
                  }
                } catch (e) {
                  // Ignore contact search errors
                }
             }

          } catch (error) {
            console.error("Search API error", error);
          }
        }

        setResults(allResults);
      } catch (error) {
        console.error("Search error", error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    router.push(result.href);
    onClose();
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 sm:pt-32">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header / Input */}
        <div className="flex items-center gap-3 p-4 border-b bg-white">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents, campaigns, pages..."
            className="flex-1 text-lg outline-none placeholder:text-slate-400 text-slate-700 bg-transparent"
          />
          <div className="flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-teal-600" />}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-slate-600">
              <span className="sr-only">Close</span>
              <kbd className="hidden sm:inline-block pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                ESC
              </kbd>
              <X className="h-5 w-5 sm:hidden" />
            </Button>
          </div>
        </div>

        {/* Results */}
        <div className="overflow-y-auto p-2 bg-slate-50/50 min-h-[300px]">
          {!query && (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-lg font-medium text-slate-600">Search for anything</p>
              <p className="text-sm">Type to find agents, campaigns, contacts, and more.</p>
              
              <div className="mt-8 text-left max-w-sm mx-auto">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-3 px-2">Quick Links</p>
                <div className="space-y-1">
                  {STATIC_PAGES.slice(0, 5).map(page => (
                    <button
                      key={page.id}
                      onClick={() => handleSelect(page)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all text-slate-600 group"
                    >
                      <div className="w-8 h-8 rounded-md bg-teal-50 flex items-center justify-center text-teal-600 group-hover:bg-teal-100 transition-colors">
                        <page.icon className="h-4 w-4" />
                      </div>
                      <span className="font-medium">{page.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {query && results.length === 0 && !loading && (
            <div className="p-12 text-center text-muted-foreground">
              <p>No results found for "{query}"</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1">
              {/* Group results if needed, for now flat list with types */}
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-teal-50 hover:text-teal-900 transition-colors group text-left"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    result.type === 'agent' ? 'bg-blue-100 text-blue-600' :
                    result.type === 'campaign' ? 'bg-purple-100 text-purple-600' :
                    result.type === 'contact' ? 'bg-green-100 text-green-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {result.icon ? <result.icon className="h-5 w-5" /> : <Search className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-slate-700 group-hover:text-teal-900">
                      {result.title}
                    </p>
                    {result.subtitle && (
                      <p className="text-xs text-slate-500 truncate group-hover:text-teal-700">
                        {result.subtitle}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-teal-400" />
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t flex items-center justify-between text-xs text-slate-500">
          <div className="flex gap-4">
             <span><kbd className="font-sans border rounded px-1 bg-white">↑</kbd> <kbd className="font-sans border rounded px-1 bg-white">↓</kbd> to navigate</span>
             <span><kbd className="font-sans border rounded px-1 bg-white">↵</kbd> to select</span>
          </div>
          <span><kbd className="font-sans border rounded px-1 bg-white">ESC</kbd> to close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
