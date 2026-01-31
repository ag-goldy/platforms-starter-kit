'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import type { RetentionPolicy } from '@/lib/compliance/retention';

interface RetentionPolicyManagerProps {
  orgId: string;
  orgName: string;
  initialPolicy: { policy: RetentionPolicy; days: number | null };
  updateAction: (
    orgId: string,
    policy: RetentionPolicy,
    days: number | null
  ) => Promise<{ success: boolean }>;
}

export function RetentionPolicyManager({
  orgId,
  orgName,
  initialPolicy,
  updateAction,
}: RetentionPolicyManagerProps) {
  const [policy, setPolicy] = useState<RetentionPolicy>(initialPolicy.policy);
  const [days, setDays] = useState<string>(initialPolicy.days?.toString() || '365');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const daysNum = policy === 'KEEP_FOREVER' ? null : parseInt(days, 10);
      if (policy !== 'KEEP_FOREVER' && (!daysNum || daysNum < 1)) {
        showToast('Days must be greater than 0', 'error');
        return;
      }

      await updateAction(orgId, policy, daysNum);
      showToast('Retention policy updated successfully', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update policy', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retention Policy: {orgName}</CardTitle>
        <CardDescription>
          Configure how long to retain data before anonymization or deletion
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="policy">Retention Policy</Label>
          <Select value={policy} onValueChange={(value) => setPolicy(value as RetentionPolicy)}>
            <SelectTrigger id="policy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="KEEP_FOREVER">Keep Forever</SelectItem>
              <SelectItem value="ANONYMIZE_AFTER_DAYS">Anonymize After Days</SelectItem>
              <SelectItem value="DELETE_AFTER_DAYS">Delete After Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {policy !== 'KEEP_FOREVER' && (
          <div className="space-y-2">
            <Label htmlFor="days">Retention Days</Label>
            <Input
              id="days"
              type="number"
              min="1"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="365"
            />
            <p className="text-sm text-gray-500">
              Data older than this many days will be {policy === 'ANONYMIZE_AFTER_DAYS' ? 'anonymized' : 'deleted'}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Policy'}
          </Button>
        </div>

        <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          <p className="font-semibold mb-2">Current Policy:</p>
          <p>
            {policy === 'KEEP_FOREVER'
              ? 'Data will be kept forever'
              : `${policy === 'ANONYMIZE_AFTER_DAYS' ? 'Anonymize' : 'Delete'} data older than ${days} days`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

