'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface TourStep {
  target: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface OnboardingTourProps {
  steps: TourStep[];
  tourId: string;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  allowSkip?: boolean;
}

export function OnboardingTour({
  steps,
  tourId,
  isOpen,
  onClose,
  onComplete,
  allowSkip = true,
}: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateTargetPosition = useCallback(() => {
    if (!isOpen) return;
    
    const step = steps[currentStep];
    const target = document.querySelector(step.target);
    
    if (target) {
      const rect = target.getBoundingClientRect();
      setTargetRect(rect);
      
      // Scroll target into view
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStep, steps, isOpen]);

  useEffect(() => {
    updateTargetPosition();
    
    const handleResize = () => updateTargetPosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, [updateTargetPosition]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(`tour-${tourId}-completed`, 'true');
    onComplete?.();
    onClose();
  };

  const handleSkip = () => {
    localStorage.setItem(`tour-${tourId}-skipped`, 'true');
    onClose();
  };

  if (!mounted || !isOpen) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  // Calculate tooltip position
  const getTooltipPosition = () => {
    if (!targetRect) return { top: '50%', left: '50%' };
    
    const position = step.position || 'bottom';
    const tooltipWidth = 320;
    const tooltipHeight = 200;
    const gap = 16;
    
    let top = 0;
    let left = 0;
    
    switch (position) {
      case 'top':
        top = targetRect.top - tooltipHeight - gap;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + gap;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.left - tooltipWidth - gap;
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.right + gap;
        break;
    }
    
    // Keep within viewport
    const padding = 16;
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
    
    return { top: `${top}px`, left: `${left}px` };
  };

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleSkip} />
      
      {/* Highlight */}
      {targetRect && (
        <motion.div
          className="absolute border-2 border-blue-500 rounded-lg pointer-events-none"
          initial={false}
          animate={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
          }}
        />
      )}
      
      {/* Tooltip */}
      <motion.div
        className="absolute w-80 bg-white rounded-lg shadow-xl p-4"
        style={getTooltipPosition()}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-lg">{step.title}</h3>
          {allowSkip && (
            <button
              onClick={handleSkip}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {/* Content */}
        <p className="text-gray-600 text-sm mb-4">{step.content}</p>
        
        {/* Action */}
        {step.action && (
          <Button
            size="sm"
            onClick={step.action.onClick}
            className="mb-4"
          >
            {step.action.label}
          </Button>
        )}
        
        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t">
          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i === currentStep ? "bg-blue-500" : "bg-gray-300 hover:bg-gray-400"
                )}
              />
            ))}
          </div>
          
          {/* Navigation */}
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button variant="ghost" size="sm" onClick={handlePrev}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {isLastStep ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Finish
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Step counter */}
        <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
          {currentStep + 1}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// Hook to manage tour state
export function useTour(tourId: string) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [hasSkipped, setHasSkipped] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(`tour-${tourId}-completed`);
    const skipped = localStorage.getItem(`tour-${tourId}-skipped`);
    setHasCompleted(!!completed);
    setHasSkipped(!!skipped);
  }, [tourId]);

  const startTour = () => setIsOpen(true);
  const closeTour = () => setIsOpen(false);
  const resetTour = () => {
    localStorage.removeItem(`tour-${tourId}-completed`);
    localStorage.removeItem(`tour-${tourId}-skipped`);
    setHasCompleted(false);
    setHasSkipped(false);
  };

  return {
    isOpen,
    hasCompleted,
    hasSkipped,
    startTour,
    closeTour,
    resetTour,
  };
}

// Tour launcher button
export function TourLauncher({
  tourId,
  steps,
  children,
}: {
  tourId: string;
  steps: TourStep[];
  children: React.ReactNode;
}) {
  const { isOpen, startTour, closeTour } = useTour(tourId);

  return (
    <>
      <div onClick={startTour}>{children}</div>
      <OnboardingTour
        steps={steps}
        tourId={tourId}
        isOpen={isOpen}
        onClose={closeTour}
      />
    </>
  );
}
