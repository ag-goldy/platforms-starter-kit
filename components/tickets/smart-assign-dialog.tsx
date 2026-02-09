'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AssignmentRecommendation, AgentScore } from '@/lib/ai/assignment';
import { Loader2, UserCheck, Users } from 'lucide-react';

interface SmartAssignDialogProps {
  ticketId: string;
  orgId: string;
  category?: string;
  priority?: string;
  onAssign?: () => void;
}

export function SmartAssignDialog({
  ticketId,
  orgId,
  category,
  priority,
  onAssign,
}: SmartAssignDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [recommendation, setRecommendation] = useState<AssignmentRecommendation | null>(null);

  useEffect(() => {
    if (open && !recommendation) {
      loadRecommendation();
    }
  }, [open]);

  async function loadRecommendation() {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, category, priority }),
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendation(data);
      }
    } catch (error) {
      console.error('Failed to load recommendation:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoAssign() {
    setAssigning(true);
    try {
      const response = await fetch('/api/ai/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId }),
      });

      if (response.ok) {
        setOpen(false);
        onAssign?.();
      }
    } catch (error) {
      console.error('Failed to auto-assign:', error);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserCheck className="w-4 h-4 mr-2" />
          Smart Assign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Smart Assignment</DialogTitle>
          <DialogDescription>
            AI-powered agent recommendation based on workload and skills
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : recommendation ? (
          <div className="space-y-4">
            {recommendation.recommendedAgentId ? (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-green-900">
                        {recommendation.recommendedAgentName}
                      </p>
                      <p className="text-sm text-green-700">
                        Confidence: {Math.round(recommendation.confidence * 100)}%
                      </p>
                    </div>
                    <Button 
                      onClick={handleAutoAssign} 
                      disabled={assigning}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {assigning ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Assign'
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-green-700 mt-2">
                    {recommendation.reason}
                  </p>
                </div>

                {recommendation.alternatives.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Alternative agents:
                    </p>
                    <div className="space-y-2">
                      {recommendation.alternatives.map((alt: AgentScore) => (
                        <div
                          key={alt.userId}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{alt.name || alt.email}</p>
                            <p className="text-xs text-gray-500">
                              Score: {Math.round(alt.score)} • 
                              Workload: {alt.workload.openTickets} tickets
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{recommendation.reason}</p>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
