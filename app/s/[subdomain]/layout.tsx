'use client';

import { notFound } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, LayoutDashboard, LogOut } from 'lucide-react';
import { CommandBar } from './components/CommandBar';
import { ContextSidebar } from './components/ContextSidebar';
import { SlideOver } from './components/SlideOver';
import { MobileNav } from './components/MobileNav';
import { useHotkeys } from '@/hooks/use-hotkeys';
import { CustomerPortalProvider, useCustomerPortal } from '@/components/customer/CustomerPortalContext';

interface SubdomainLayoutProps {
  children: React.ReactNode;
  modal: React.ReactNode;
}

function LayoutContent({ children, modal }: SubdomainLayoutProps) {
  const params = useParams();
  const subdomain = params?.subdomain as string;
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { isSlideOverOpen, closeSlideOver } = useCustomerPortal();

  useEffect(() => {
    async function fetchOrg() {
      try {
        const res = await fetch(`/api/org/${subdomain}`);
        if (!res.ok) throw new Error('Org not found');
        const data = await res.json();
        setOrg(data);
      } catch (error) {
        console.error('Failed to fetch org:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchOrg();
  }, [subdomain]);

  // Keyboard shortcuts
  useHotkeys('esc', () => {
    closeSlideOver();
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-stone-500">Loading...</span>
        </motion.div>
      </div>
    );
  }

  if (!org) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-surface text-stone-900 font-sans antialiased">
      {/* Floating Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-surface-elevated/80 backdrop-blur-xl border-b border-stone-200/50">
        <div className="h-full flex items-center justify-between px-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-stone-900 rounded-lg flex items-center justify-center">
              <span className="text-brand-500 font-bold text-sm">A</span>
            </div>
            <span className="hidden sm:block font-semibold text-sm tracking-tight text-stone-900">
              {org.name}
            </span>
          </div>

          {/* Centered Command Bar - Hidden on mobile */}
          <div className="hidden md:block flex-1 max-w-xl mx-4">
            <CommandBar subdomain={subdomain} org={org} />
          </div>

          {/* Right Side - Status & User */}
          <div className="flex items-center gap-3">
            <StatusIndicator orgId={org.id} />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="pt-14 flex min-h-screen pb-16 md:pb-0">
        {/* Contextual Sidebar - Hidden on mobile */}
        <div className="hidden md:block">
          <ContextSidebar subdomain={subdomain} org={org} />
        </div>

        {/* Main Surface */}
        <main className="flex-1 overflow-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="p-4 md:p-6"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile Navigation */}
      <MobileNav subdomain={subdomain} org={org} />

      {/* Modal Container for Parallel Routes */}
      <AnimatePresence>{modal}</AnimatePresence>

      {/* Slide-Over Container */}
      <SlideOver />
    </div>
  );
}

export default function CustomerPortalLayout({ children, modal }: SubdomainLayoutProps) {
  return (
    <CustomerPortalProvider>
      <LayoutContent children={children} modal={modal} />
    </CustomerPortalProvider>
  );
}

// Status Indicator Component
function StatusIndicator({ orgId }: { orgId: string }) {
  const [status, setStatus] = useState<'operational' | 'warning' | 'critical'>('operational');
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch(`/api/status/${orgId}`);
        const data = await res.json();
        setStatus(data.overallStatus);
      } catch (error) {
        console.error('Failed to fetch status:', error);
      }
    }
    fetchStatus();
  }, [orgId]);

  const statusColors = {
    operational: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
  };

  return (
    <div className="relative hidden sm:block">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 transition-colors"
      >
        <span className={`w-2 h-2 rounded-full ${statusColors[status]} animate-pulse`} />
        <span className="text-xs font-medium text-stone-600 capitalize">{status}</span>
      </button>

      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-64 bg-surface-elevated rounded-xl shadow-xl border border-stone-200 p-4 z-50"
          >
            <StatusPanel orgId={orgId} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Status Panel
function StatusPanel({ orgId }: { orgId: string }) {
  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    async function fetchServices() {
      try {
        const res = await fetch(`/api/services/org/${orgId}`);
        const data = await res.json();
        setServices(data.services || []);
      } catch (error) {
        console.error('Failed to fetch services:', error);
      }
    }
    fetchServices();
  }, [orgId]);

  const operational = services.filter((s) => s.status === 'OPERATIONAL').length;
  const total = services.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-stone-900">Service Status</span>
        <span className="text-xs text-stone-500">{operational}/{total} up</span>
      </div>
      <div className="space-y-2">
        {services.slice(0, 5).map((service) => (
          <div key={service.id} className="flex items-center justify-between text-sm">
            <span className="text-stone-600 truncate">{service.name}</span>
            <StatusDot status={service.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    OPERATIONAL: 'bg-emerald-500',
    DEGRADED: 'bg-amber-500',
    DOWN: 'bg-red-500',
  };
  return <span className={`w-2 h-2 rounded-full ${colors[status] || 'bg-stone-400'}`} />;
}

// User Menu
function UserMenu() {
  const [user, setUser] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        setUser(data.user);
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    }
    fetchUser();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  if (!user) {
    return (
      <a
        href="/login"
        className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
      >
        Sign in
      </a>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 p-1 rounded-lg hover:bg-stone-100 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
          <span className="text-xs font-semibold text-brand-700">
            {user.name?.[0] || user.email?.[0] || '?'}
          </span>
        </div>
        <span className="hidden sm:block text-sm font-medium text-stone-700 max-w-[120px] truncate">
          {user.name || user.email}
        </span>
      </button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-56 bg-surface-elevated rounded-xl shadow-xl border border-stone-200 py-2 z-50"
          >
            <div className="px-4 py-3 border-b border-stone-100">
              <p className="font-medium text-sm text-stone-900 truncate">{user.name || 'User'}</p>
              <p className="text-xs text-stone-500 truncate">{user.email}</p>
            </div>

            <div className="py-1">
              <a
                href="/app/settings"
                className="flex items-center gap-3 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Account Settings
              </a>
              <a
                href="/app"
                className="flex items-center gap-3 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                Internal Console
              </a>
            </div>

            <div className="border-t border-stone-100 py-1 mt-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
