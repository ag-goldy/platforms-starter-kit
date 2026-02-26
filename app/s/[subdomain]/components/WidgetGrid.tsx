'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TicketInboxWidget } from './TicketInboxWidget';
import { HealthStatusWidget } from './HealthStatusWidget';
import { KBSuggestionsWidget } from './KBSuggestionsWidget';
import { TeamActivityWidget } from './TeamActivityWidget';
import { QuickActionsWidget } from './QuickActionsWidget';
import { AssetAlertsWidget } from './AssetAlertsWidget';
import { useCustomerPortal, WidgetConfig } from '@/components/customer/CustomerPortalContext';

interface WidgetGridProps {
  subdomain: string;
  org: any;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const widgetVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      damping: 20,
      stiffness: 100,
    },
  },
};

export function WidgetGrid({ subdomain, org }: WidgetGridProps) {
  const { widgetLayout, updateWidgetLayout } = useCustomerPortal();
  const [isDragging, setIsDragging] = useState(false);

  // For now, use a static grid layout
  // In a full implementation, this would use react-grid-layout
  const renderWidget = (widget: WidgetConfig) => {
    const props = { subdomain, org };

    switch (widget.type) {
      case 'ticket_inbox':
        return <TicketInboxWidget {...props} />;
      case 'health_status':
        return <HealthStatusWidget {...props} />;
      case 'kb_suggestions':
        return <KBSuggestionsWidget {...props} />;
      case 'team_activity':
        return <TeamActivityWidget {...props} />;
      case 'quick_actions':
        return <QuickActionsWidget {...props} />;
      case 'asset_alerts':
        return <AssetAlertsWidget {...props} />;
      default:
        return null;
    }
  };

  const getGridClass = (position: { w: number; h: number }) => {
    // Map widget dimensions to grid classes
    const widthClass = position.w === 2 ? 'col-span-2' : 'col-span-1';
    const heightClass = position.h === 2 ? 'row-span-2' : 'row-span-1';
    return `${widthClass} ${heightClass}`;
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-[minmax(200px,auto)]"
    >
      {widgetLayout.map((widget) => (
        <motion.div
          key={widget.id}
          variants={widgetVariants}
          className={`${getGridClass(widget.position)} ${
            widget.position.w === 2 ? 'md:col-span-2' : ''
          } ${widget.position.h === 2 ? 'min-h-[400px]' : 'min-h-[200px]'}`}
        >
          <div className="h-full bg-surface-elevated rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            {renderWidget(widget)}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
