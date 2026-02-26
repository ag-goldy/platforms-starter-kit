'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useCustomerPortal } from '@/components/customer/CustomerPortalContext';
import { TicketSlideOver } from './TicketSlideOver';
import { TeamSlideOver } from './TeamSlideOver';
import { KBSlideOver } from './KBSlideOver';
import { SettingsSlideOver } from './SettingsSlideOver';

import { useEffect, useRef } from 'react';

const slideOverVariants = {
  hidden: { x: '100%', opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 200,
    },
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: {
      type: 'spring',
      damping: 30,
      stiffness: 300,
    },
  },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export function SlideOver() {
  const { slideOver, closeSlideOver } = useCustomerPortal();
  const { isOpen, type, data } = slideOver;
  const panelRef = useRef<HTMLDivElement>(null);

  console.log('SlideOver render - isOpen:', isOpen, 'type:', type);
  
  // Debug indicator
  useEffect(() => {
    console.log('SlideOver state changed - isOpen:', isOpen, 'type:', type);
  }, [isOpen, type]);

  // Handle escape key and focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeSlideOver();
      }
      // Simple focus trap
      if (e.key === 'Tab' && isOpen && panelRef.current) {
        const focusableElements = panelRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeSlideOver]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const renderContent = () => {
    switch (type) {
      case 'ticket':
        return <TicketSlideOver data={data} onClose={closeSlideOver} />;
      case 'team':
        return <TeamSlideOver data={data} onClose={closeSlideOver} />;
      case 'kb':
        return <KBSlideOver data={data} onClose={closeSlideOver} />;
      case 'settings':
        return <SettingsSlideOver onClose={closeSlideOver} />;
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={closeSlideOver}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />

          {/* Slide-Over Panel */}
          <motion.div
            ref={panelRef}
            variants={slideOverVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-y-0 right-0 w-full sm:w-[60%] lg:w-[50%] bg-surface-elevated shadow-2xl z-50 flex flex-col outline-none"
            tabIndex={-1}
          >
            {/* Close Button */}
            <button
              onClick={closeSlideOver}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-stone-100 transition-colors z-10"
              aria-label="Close panel"
            >
              <X className="w-5 h-5 text-stone-500" />
            </button>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {renderContent()}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
