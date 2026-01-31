'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { updateOrg2FAPolicyAction } from '@/app/app/actions/organizations';
import { useRouter } from 'next/navigation';

interface Organization2FAPolicyProps {
  orgId: string;
  requireTwoFactor: boolean;
}

export function Organization2FAPolicy({ orgId, requireTwoFactor: initialRequireTwoFactor }: Organization2FAPolicyProps) {
  const router = useRouter();
  const [requireTwoFactor, setRequireTwoFactor] = useState(initialRequireTwoFactor);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const handleToggle = async (checked: boolean) => {
    setIsUpdating(true);
    try {
      const result = await updateOrg2FAPolicyAction(orgId, checked);
      if (result.success) {
        setRequireTwoFactor(checked);
        router.refresh();
      } else {
        alert(`Failed to update 2FA policy: ${result.error}`);
        setRequireTwoFactor(!checked); // Revert
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setRequireTwoFactor(!checked); // Revert
    } finally {
      setIsUpdating(false);
    }
  };
  
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Label htmlFor={`2fa-policy-${orgId}`} className="font-medium cursor-pointer">
              Require Two-Factor Authentication
            </Label>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            When enabled, all internal users (ADMIN, AGENT) in this organization must have 2FA enabled to access the system.
          </p>
        </div>
        <Switch
          checked={requireTwoFactor}
          onCheckedChange={handleToggle}
          disabled={isUpdating}
        />
      </div>
    </div>
  );
}

