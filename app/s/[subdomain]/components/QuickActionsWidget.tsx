'use client';

import { motion } from 'framer-motion';
import {
  Plus,
  BookOpen,
  Users,
  FileText,
  MessageSquare,
  HelpCircle,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { useCustomerPortal } from '@/components/customer/CustomerPortalContext';

interface QuickActionsWidgetProps {
  subdomain: string;
  org: any;
}

export function QuickActionsWidget({ subdomain, org }: QuickActionsWidgetProps) {
  const { openSlideOver } = useCustomerPortal();

  const actions = [
    {
      id: 'new-ticket',
      label: 'New Ticket',
      description: 'Create a support request',
      icon: Plus,
      color: 'bg-brand-500',
      onClick: () => openSlideOver('ticket', { mode: 'create' }),
    },
    {
      id: 'browse-kb',
      label: 'Browse KB',
      description: 'Find answers quickly',
      icon: BookOpen,
      color: 'bg-blue-500',
      onClick: () => openSlideOver('kb'),
    },
    {
      id: 'team',
      label: 'Team',
      description: 'Manage members',
      icon: Users,
      color: 'bg-purple-500',
      onClick: () => openSlideOver('team'),
    },
    {
      id: 'docs',
      label: 'Documentation',
      description: 'Platform guides',
      icon: FileText,
      color: 'bg-emerald-500',
      onClick: () => window.open('/docs', '_blank'),
      external: true,
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100">
        <Zap className="w-4 h-4 text-amber-500" />
        <h3 className="font-semibold text-stone-900">Quick Actions</h3>
      </div>

      {/* Actions Grid */}
      <div className="flex-1 p-3">
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action, index) => (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              onClick={action.onClick}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors group text-left"
            >
              <div
                className={`w-10 h-10 ${action.color} rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}
              >
                <action.icon className="w-5 h-5 text-white" />
              </div>
              <div className="text-center">
                <p className="font-medium text-xs text-stone-900 flex items-center gap-1">
                  {action.label}
                  {action.external && <ExternalLink className="w-3 h-3 text-stone-400" />}
                </p>
                <p className="text-[10px] text-stone-500">{action.description}</p>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Help Section */}
        <div className="mt-4 p-3 rounded-xl bg-stone-50">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-stone-200 rounded-lg flex items-center justify-center">
              <HelpCircle className="w-4 h-4 text-stone-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-xs text-stone-900">Need help?</p>
              <p className="text-[10px] text-stone-500 mt-0.5">
                Our support team is available 24/7
              </p>
              <button
                onClick={() => openSlideOver('ticket', { mode: 'create' })}
                className="mt-2 text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                Contact Support →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
