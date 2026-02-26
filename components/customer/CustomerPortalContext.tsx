'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface SlideOverState {
  isOpen: boolean;
  type: 'ticket' | 'kb' | 'team' | 'settings' | null;
  data: any;
}

interface CustomerPortalContextType {
  // Slide-over state
  slideOver: SlideOverState;
  openSlideOver: (type: SlideOverState['type'], data?: any) => void;
  closeSlideOver: () => void;
  isSlideOverOpen: boolean;

  // Widget layout state
  widgetLayout: WidgetConfig[];
  updateWidgetLayout: (layout: WidgetConfig[]) => void;

  // Command palette state
  isCommandOpen: boolean;
  openCommand: () => void;
  closeCommand: () => void;

  // Active filters (URL state)
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  clearFilters: () => void;
}

export interface WidgetConfig {
  id: string;
  type: 'ticket_inbox' | 'health_status' | 'kb_suggestions' | 'team_activity' | 'asset_alerts' | 'quick_actions';
  position: { x: number; y: number; w: number; h: number };
  settings?: Record<string, any>;
}

const defaultLayout: WidgetConfig[] = [
  { id: '1', type: 'ticket_inbox', position: { x: 0, y: 0, w: 2, h: 2 } },
  { id: '2', type: 'health_status', position: { x: 2, y: 0, w: 1, h: 1 } },
  { id: '3', type: 'kb_suggestions', position: { x: 2, y: 1, w: 1, h: 1 } },
  { id: '4', type: 'quick_actions', position: { x: 3, y: 0, w: 1, h: 2 } },
];

const CustomerPortalContext = createContext<CustomerPortalContextType | undefined>(undefined);

export function CustomerPortalProvider({ children }: { children: React.ReactNode }) {
  // Slide-over state
  const [slideOver, setSlideOver] = useState<SlideOverState>({
    isOpen: false,
    type: null,
    data: null,
  });

  const openSlideOver = useCallback((type: SlideOverState['type'], data?: any) => {
    setSlideOver({ isOpen: true, type, data });
  }, []);

  const closeSlideOver = useCallback(() => {
    setSlideOver({ isOpen: false, type: null, data: null });
  }, []);

  // Widget layout state (persisted to localStorage)
  const [widgetLayout, setWidgetLayoutState] = useState<WidgetConfig[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('customer-portal-widgets');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse widget layout:', e);
        }
      }
    }
    return defaultLayout;
  });

  const updateWidgetLayout = useCallback((layout: WidgetConfig[]) => {
    setWidgetLayoutState(layout);
    if (typeof window !== 'undefined') {
      localStorage.setItem('customer-portal-widgets', JSON.stringify(layout));
    }
  }, []);

  // Command palette state
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const openCommand = useCallback(() => setIsCommandOpen(true), []);
  const closeCommand = useCallback(() => setIsCommandOpen(false), []);

  // Filters state
  const [filters, setFiltersState] = useState<Record<string, string>>({});
  const setFilter = useCallback((key: string, value: string) => {
    setFiltersState((prev) => ({ ...prev, [key]: value }));
  }, []);
  const clearFilters = useCallback(() => {
    setFiltersState({});
  }, []);

  const value: CustomerPortalContextType = {
    slideOver,
    openSlideOver,
    closeSlideOver,
    isSlideOverOpen: slideOver.isOpen,
    widgetLayout,
    updateWidgetLayout,
    isCommandOpen,
    openCommand,
    closeCommand,
    filters,
    setFilter,
    clearFilters,
  };

  return (
    <CustomerPortalContext.Provider value={value}>
      {children}
    </CustomerPortalContext.Provider>
  );
}

export function useCustomerPortal() {
  const context = useContext(CustomerPortalContext);
  if (context === undefined) {
    throw new Error('useCustomerPortal must be used within a CustomerPortalProvider');
  }
  return context;
}
