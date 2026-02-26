'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Ticket,
  BookOpen,
  Users,
  Plus,
  X,
  MessageSquare,
  Activity,
} from 'lucide-react';
import { useCustomerPortal } from '@/components/customer/CustomerPortalContext';
import { useRouter, useSearchParams } from 'next/navigation';

interface MobileNavProps {
  subdomain: string;
  org: any;
}

export function MobileNav({ subdomain, org }: MobileNavProps) {
  const [isFabOpen, setIsFabOpen] = useState(false);
  const { openSlideOver } = useCustomerPortal();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = searchParams.get('view') || 'dashboard';

  const features = org.features || {};

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'tickets', label: 'Tickets', icon: Ticket },
    { id: 'kb', label: 'KB', icon: BookOpen },
    { id: 'team', label: 'Team', icon: Users },
  ];

  const fabActions = [
    {
      id: 'ticket',
      label: 'New Ticket',
      icon: MessageSquare,
      color: 'bg-brand-500',
      onClick: () => {
        openSlideOver('ticket', { mode: 'create' });
        setIsFabOpen(false);
      },
    },
    {
      id: 'status',
      label: 'Status',
      icon: Activity,
      color: 'bg-emerald-500',
      onClick: () => {
        const currentView = searchParams.get('view') || 'dashboard';
        if (currentView !== 'status') {
          router.push(`/s/${subdomain}?view=status`);
        }
        setIsFabOpen(false);
      },
    },
  ];

  const handleNavClick = (itemId: string) => {
    if (itemId === 'team') {
      openSlideOver('team');
    } else {
      // Guard against navigating to same view
      const currentView = searchParams.get('view') || 'dashboard';
      if (currentView !== itemId) {
        router.push(`/s/${subdomain}?view=${itemId}`);
      }
    }
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface-elevated border-t border-stone-200 z-40 md:hidden">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                currentView === item.id
                  ? 'text-brand-600'
                  : 'text-stone-500'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}

          {/* FAB Trigger */}
          <button
            onClick={() => setIsFabOpen(!isFabOpen)}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all ${
              isFabOpen ? 'bg-stone-800 rotate-45' : 'bg-brand-500'
            }`}
          >
            <Plus className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Safe area padding for iOS */}
        <div className="h-safe-area-inset-bottom" />
      </nav>

      {/* FAB Menu Overlay */}
      <AnimatePresence>
        {isFabOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFabOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
            />

            {/* FAB Menu */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="fixed bottom-24 right-4 z-50 flex flex-col gap-3 md:hidden"
            >
              {fabActions.map((action, index) => (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={action.onClick}
                  className="flex items-center gap-3"
                >
                  <span className="px-3 py-1.5 bg-stone-800 text-white text-xs font-medium rounded-lg">
                    {action.label}
                  </span>
                  <div
                    className={`w-12 h-12 ${action.color} rounded-full flex items-center justify-center shadow-lg`}
                  >
                    <action.icon className="w-5 h-5 text-white" />
                  </div>
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
