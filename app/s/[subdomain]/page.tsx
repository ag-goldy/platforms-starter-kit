'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useSearchParams } from 'next/navigation';
import { WidgetGrid } from './components/WidgetGrid';
import { TicketInboxWidget } from './components/TicketInboxWidget';
import { KBSuggestionsWidget } from './components/KBSuggestionsWidget';
import { HealthStatusWidget } from './components/HealthStatusWidget';
import { StatusPage } from './components/StatusPage';
import { useCustomerPortal } from '@/components/customer/CustomerPortalContext';
import { BookOpen, Ticket, Activity, LayoutDashboard, Server, HardDrive } from 'lucide-react';

export default function DashboardPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const subdomain = params?.subdomain as string;
  const view = searchParams.get('view') || 'dashboard';
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { openSlideOver } = useCustomerPortal();

  useEffect(() => {
    async function fetchOrg() {
      try {
        const res = await fetch(`/api/org/${subdomain}`);
        if (res.ok) {
          const data = await res.json();
          setOrg(data);
        }
      } catch (error) {
        console.error('Failed to fetch org:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchOrg();
  }, [subdomain]);

  if (loading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
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
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-stone-900 mb-2">Organization not found</h1>
          <p className="text-stone-500">The subdomain &quot;{subdomain}&quot; does not exist.</p>
        </div>
      </div>
    );
  }

  // Render different views based on the view parameter
  const renderContent = () => {
    switch (view) {
      case 'tickets':
        return (
          <div className="h-[calc(100vh-8rem)]">
            <div className="flex items-center gap-3 mb-4">
              <Ticket className="w-6 h-6 text-brand-500" />
              <h1 className="text-2xl font-bold text-stone-900">Tickets</h1>
            </div>
            <div className="h-full bg-surface-elevated rounded-xl border border-stone-200 shadow-sm">
              <TicketInboxWidget subdomain={subdomain} org={org} />
            </div>
          </div>
        );
      
      case 'kb':
        return (
          <div className="h-[calc(100vh-8rem)]">
            <div className="flex items-center gap-3 mb-4">
              <BookOpen className="w-6 h-6 text-blue-500" />
              <h1 className="text-2xl font-bold text-stone-900">Knowledge Base</h1>
            </div>
            <div className="h-full bg-surface-elevated rounded-xl border border-stone-200 shadow-sm">
              <KBSuggestionsWidget subdomain={subdomain} org={org} />
            </div>
          </div>
        );
      
      case 'status':
        return (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-6 h-6 text-emerald-500" />
              <h1 className="text-2xl font-bold text-stone-900">Service Status</h1>
            </div>
            <StatusPage subdomain={subdomain} org={org} />
          </div>
        );

      case 'assets':
        // Redirect to full assets page
        if (typeof window !== 'undefined') {
          window.location.href = `/s/${subdomain}/assets`;
        }
        return (
          <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-stone-500">Redirecting to Assets...</span>
            </motion.div>
          </div>
        );

      case 'infrastructure':
        // Redirect to full infrastructure page
        if (typeof window !== 'undefined') {
          window.location.href = `/s/${subdomain}/infrastructure`;
        }
        return (
          <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-stone-500">Redirecting to Infrastructure...</span>
            </motion.div>
          </div>
        );
      
      case 'management':
        // Redirect to full management page
        if (typeof window !== 'undefined') {
          window.location.href = `/s/${subdomain}/management`;
        }
        return (
          <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-stone-500">Redirecting to Management...</span>
            </motion.div>
          </div>
        );
      
      case 'dashboard':
      default:
        return (
          <div className="space-y-6">
            {/* Welcome Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-6 h-6 text-brand-500" />
                <div>
                  <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Dashboard</h1>
                  <p className="text-sm text-stone-500 mt-1">
                    Welcome back to {org.name} Support Portal
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </motion.div>

            {/* Widget Grid */}
            <WidgetGrid subdomain={subdomain} org={org} />
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {renderContent()}
    </motion.div>
  );
}
