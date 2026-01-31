import { requireAuth } from '@/lib/auth/permissions';
import { get2FAStatusAction } from '@/app/app/actions/2fa';
import { TwoFactorSetup } from '@/components/settings/two-factor-setup';

export default async function SecuritySettingsPage() {
  await requireAuth();
  const status = await get2FAStatusAction();
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your two-factor authentication and security preferences
        </p>
      </div>
      
      <TwoFactorSetup initialStatus={status} />
    </div>
  );
}

