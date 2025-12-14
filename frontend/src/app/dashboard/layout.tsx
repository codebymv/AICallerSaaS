'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Phone,
  PhoneCall,
  Bot,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Loader2,
  LayoutDashboard,
  Hash,
  AudioLines,
  Users,
  MessageSquare,
  Flag,
  Search,
  User,
  Zap,
  Crown,
  Building2,
  ShieldCheck,
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlobalSearch } from '@/components/GlobalSearch';
import { api } from '@/lib/api';
import { useCallEvents } from '@/hooks/use-call-events';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/agents', label: 'Agents', icon: Bot },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: Flag },
  { href: '/dashboard/voices', label: 'Voices', icon: AudioLines },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users },
  { href: '/dashboard/dialpad', label: 'Dialpad', icon: Hash },
  { href: '/dashboard/calls', label: 'Call Logs', icon: PhoneCall },
  { href: '/dashboard/messaging', label: 'Messaging', icon: MessageSquare },
  { href: '/dashboard/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
];

const PLAN_ICONS = {
  FREE: { icon: User, bgColor: 'bg-slate-500', borderColor: 'border-slate-400' },
  STARTER: { icon: Zap, bgColor: 'bg-teal-500', borderColor: 'border-teal-400' },
  PROFESSIONAL: { icon: Crown, bgColor: 'bg-amber-500', borderColor: 'border-amber-400' },
  ENTERPRISE: { icon: Building2, bgColor: 'bg-slate-800', borderColor: 'border-slate-600' },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'>('FREE');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Subscribe to real-time call events (shows toast for call started/ended)
  useCallEvents(user?.id || null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const [userResponse, billingResponse] = await Promise.all([
          api.getMe(),
          api.getBillingStatus()
        ]);
        setUser(userResponse.data);
        if (billingResponse.data?.plan) {
          setUserPlan(billingResponse.data.plan);
        }
      } catch (error) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [router]);

  const handleLogout = () => {
    api.logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="bg-slate-50">
      {/* Mobile header with menu button and logo */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b px-4 py-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="-ml-2"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <div className="flex items-center gap-3 absolute left-1/2 transform -translate-x-1/2">
          <Image
            src="/gleam-logo-icon.png"
            alt="Gleam"
            width={28}
            height={28}
            priority
            className="h-7 w-7"
          />
          <Image
            src="/gleam-logo-text.png"
            alt="Gleam"
            width={80}
            height={24}
            priority
            className="h-6 w-auto"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSearchOpen(true)}
          className="-mr-2"
        >
          <Search className="h-5 w-5 text-slate-600" />
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed top-[60px] lg:top-0 bottom-0 left-0 z-40 w-64 bg-slate-50/90 backdrop-blur-xl border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo - Subtle gradient header with inverted icon and text (Desktop only) */}
          <div className="hidden lg:flex items-center gap-3 px-6 py-5 bg-gradient-to-b from-[#0fa693] to-teal-600">
            <Image
              src="/logo-icon-transparent-inverted.png"
              alt="Gleam Icon"
              width={32}
              height={32}
              priority
              className="h-8 w-8"
            />
            <Image
              src="/gleam-logo-text-inverted.png"
              alt="Gleam"
              width={100}
              height={32}
              priority
              className="h-7 w-auto"
            />
          </div>

          {/* Search Trigger (Desktop) */}
          <div className="hidden lg:block px-4 py-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 bg-white border rounded-lg hover:border-teal-300 hover:text-slate-700 transition-all shadow-sm group"
            >
              <Search className="h-4 w-4 group-hover:text-teal-500 transition-colors" />
              <span>Search...</span>
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-400 opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              // For Dashboard, only match exact path. For others, match if starts with the path.
              const isActive = item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                    ? 'bg-gradient-to-b from-[#0fa693] to-teal-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className={`h-5 w-5 transition-colors ${!isActive ? 'group-hover:text-teal-600' : ''}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Settings */}
          <div className="px-4 pb-4">
            <Link
              href="/dashboard/settings"
              className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${pathname.startsWith('/dashboard/settings')
                ? 'bg-gradient-to-b from-[#0fa693] to-teal-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
                }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Settings className={`h-5 w-5 transition-colors ${!pathname.startsWith('/dashboard/settings') ? 'group-hover:text-teal-600' : ''}`} />
              Settings
            </Link>
          </div>

          {/* User info */}
          <div className="p-4 bg-teal-600">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
                  {/* Admin Badge */}
                  {user?.role === 'ADMIN' && (
                    <ShieldCheck className="w-3.5 h-3.5 text-white/90 flex-shrink-0" />
                  )}
                  {/* Subscription Badge */}
                  {userPlan !== 'FREE' && (() => {
                    const planConfig = PLAN_ICONS[userPlan];
                    const PlanIcon = planConfig.icon;
                    return <PlanIcon className="w-3.5 h-3.5 text-white/90 flex-shrink-0" />;
                  })()}
                </div>
                <p className="text-xs text-white/80 truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start mt-2 text-white/80 hover:bg-white/10 hover:text-white"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:pl-64 relative min-h-screen">
        {/* Subtle background gradients to reduce eye strain */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-teal-50/20 to-slate-100/50" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-teal-100/30 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-slate-200/30 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] bg-gradient-to-r from-teal-50/40 to-transparent rounded-full blur-3xl" />
        </div>
        <div className="relative p-4 sm:p-6 pt-20 lg:pt-6">
          {children}
        </div>
      </main>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

