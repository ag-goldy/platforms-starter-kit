'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';

interface TourStep {
  title: string;
  description: string;
  target?: string;
}

interface SimpleTourProps {
  tourId: string;
  steps: TourStep[];
}

export function SimpleTour({ tourId, steps }: SimpleTourProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(`tour-${tourId}-completed`);
    const skipped = localStorage.getItem(`tour-${tourId}-skipped`);
    
    // Show tour on first visit (after a short delay)
    if (!completed && !skipped) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [tourId]);

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
    setHasCompleted(true);
    setIsOpen(false);
  };

  const handleSkip = () => {
    localStorage.setItem(`tour-${tourId}-skipped`, 'true');
    setIsOpen(false);
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setIsOpen(true);
  };

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <>
      {/* Tour Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{step.title}</DialogTitle>
              <button
                onClick={handleSkip}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <DialogDescription className="pt-2">
              {step.description}
            </DialogDescription>
          </DialogHeader>

          {/* Progress dots */}
          <div className="flex justify-center gap-1 py-2">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentStep ? 'bg-blue-500' : 'bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>

          <DialogFooter className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Step {currentStep + 1} of {steps.length}
            </div>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button variant="outline" size="sm" onClick={handlePrev}>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restart button (shown after completion) */}
      {hasCompleted && (
        <button
          onClick={handleRestart}
          className="fixed bottom-4 left-4 text-xs text-gray-400 hover:text-gray-600 bg-white/80 backdrop-blur px-3 py-1.5 rounded shadow border"
        >
          Replay Tour
        </button>
      )}
    </>
  );
}

// Predefined tours
export function NewUserTour() {
  return (
    <SimpleTour
      tourId="new-user"
      steps={[
        {
          title: 'Welcome to Atlas Helpdesk!',
          description: 'Let\'s take a quick tour to help you get started with your support platform.',
        },
        {
          title: 'Your Ticket Queue',
          description: 'View and manage all support requests from your customers. Use filters to find specific tickets quickly.',
        },
        {
          title: 'Knowledge Base',
          description: 'Create and manage help articles to reduce support load and help customers find answers faster.',
        },
        {
          title: 'Organizations',
          description: 'Manage your customers, their users, and service configurations in one place.',
        },
        {
          title: 'Quick Actions',
          description: 'Press ⌘+K anytime to access the command palette for quick navigation and actions.',
        },
        {
          title: 'You\'re All Set!',
          description: 'Start by creating your first ticket or inviting team members to collaborate.',
        },
      ]}
    />
  );
}
