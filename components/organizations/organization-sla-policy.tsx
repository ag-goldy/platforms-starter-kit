'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';

interface OrganizationSLAPolicyProps {
  orgId: string;
  currentPolicy: {
    slaResponseHoursP1: number | null;
    slaResponseHoursP2: number | null;
    slaResponseHoursP3: number | null;
    slaResponseHoursP4: number | null;
    slaResolutionHoursP1: number | null;
    slaResolutionHoursP2: number | null;
    slaResolutionHoursP3: number | null;
    slaResolutionHoursP4: number | null;
  };
}

const PRIORITY_LABELS: Record<string, { label: string; description: string }> = {
  P1: { label: 'P1 - Critical', description: 'System down, major impact' },
  P2: { label: 'P2 - High', description: 'Significant degradation' },
  P3: { label: 'P3 - Medium', description: 'Minor impact' },
  P4: { label: 'P4 - Low', description: 'General questions' },
};

export function OrganizationSLAPolicy({ orgId, currentPolicy }: OrganizationSLAPolicyProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [policy, setPolicy] = useState({
    slaResponseHoursP1: currentPolicy.slaResponseHoursP1 ?? '',
    slaResponseHoursP2: currentPolicy.slaResponseHoursP2 ?? '',
    slaResponseHoursP3: currentPolicy.slaResponseHoursP3 ?? '',
    slaResponseHoursP4: currentPolicy.slaResponseHoursP4 ?? '',
    slaResolutionHoursP1: currentPolicy.slaResolutionHoursP1 ?? '',
    slaResolutionHoursP2: currentPolicy.slaResolutionHoursP2 ?? '',
    slaResolutionHoursP3: currentPolicy.slaResolutionHoursP3 ?? '',
    slaResolutionHoursP4: currentPolicy.slaResolutionHoursP4 ?? '',
  });
  const { showToast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/organizations/sla-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          policy: {
            slaResponseHoursP1: policy.slaResponseHoursP1 ? Number(policy.slaResponseHoursP1) : null,
            slaResponseHoursP2: policy.slaResponseHoursP2 ? Number(policy.slaResponseHoursP2) : null,
            slaResponseHoursP3: policy.slaResponseHoursP3 ? Number(policy.slaResponseHoursP3) : null,
            slaResponseHoursP4: policy.slaResponseHoursP4 ? Number(policy.slaResponseHoursP4) : null,
            slaResolutionHoursP1: policy.slaResolutionHoursP1 ? Number(policy.slaResolutionHoursP1) : null,
            slaResolutionHoursP2: policy.slaResolutionHoursP2 ? Number(policy.slaResolutionHoursP2) : null,
            slaResolutionHoursP3: policy.slaResolutionHoursP3 ? Number(policy.slaResolutionHoursP3) : null,
            slaResolutionHoursP4: policy.slaResolutionHoursP4 ? Number(policy.slaResolutionHoursP4) : null,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save SLA policy');
      }

      showToast('SLA policy saved', 'success');
      setIsEditing(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const hasAnyValue = Object.values(policy).some(v => v !== '' && v !== null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>SLA Policy</CardTitle>
          <CardDescription>
            Default SLA targets for tickets created in this organization
          </CardDescription>
        </div>
        {!isEditing && (
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            {hasAnyValue ? 'Edit' : 'Configure'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!isEditing && !hasAnyValue && (
          <p className="text-sm text-gray-500">No SLA policy configured</p>
        )}

        {!isEditing && hasAnyValue && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm font-medium text-gray-500 border-b pb-2">
              <div>Priority</div>
              <div>Response Time</div>
              <div>Resolution Time</div>
            </div>
            {(['P1', 'P2', 'P3', 'P4'] as const).map((priority) => {
              const responseKey = `slaResponseHours${priority}` as keyof typeof policy;
              const resolutionKey = `slaResolutionHours${priority}` as keyof typeof policy;
              const responseVal = policy[responseKey];
              const resolutionVal = policy[resolutionKey];
              
              return (
                <div key={priority} className="grid grid-cols-3 gap-4 text-sm">
                  <div className="font-medium">{PRIORITY_LABELS[priority].label}</div>
                  <div>{responseVal ? `${responseVal}h` : '-'}</div>
                  <div>{resolutionVal ? `${resolutionVal}h` : '-'}</div>
                </div>
              );
            })}
          </div>
        )}

        {isEditing && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 text-sm font-medium text-gray-500 border-b pb-2">
              <div>Priority</div>
              <div>Response (hours)</div>
              <div>Resolution (hours)</div>
            </div>
            {(['P1', 'P2', 'P3', 'P4'] as const).map((priority) => {
              const responseKey = `slaResponseHours${priority}` as keyof typeof policy;
              const resolutionKey = `slaResolutionHours${priority}` as keyof typeof policy;
              
              return (
                <div key={priority} className="grid grid-cols-3 gap-4 items-center">
                  <div>
                    <Label className="font-medium">{PRIORITY_LABELS[priority].label}</Label>
                    <p className="text-xs text-gray-500">{PRIORITY_LABELS[priority].description}</p>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    placeholder="e.g., 4"
                    value={policy[responseKey]}
                    onChange={(e) => setPolicy({ ...policy, [responseKey]: e.target.value })}
                  />
                  <Input
                    type="number"
                    min="0"
                    placeholder="e.g., 24"
                    value={policy[resolutionKey]}
                    onChange={(e) => setPolicy({ ...policy, [resolutionKey]: e.target.value })}
                  />
                </div>
              );
            })}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Policy'}
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
