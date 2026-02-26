import { requireAuth } from '@/lib/auth/permissions';
import { get2FAStatusAction } from '@/app/app/actions/2fa';
import { TwoFactorSetup } from '@/components/settings/two-factor-setup';

export default async function SecuritySettingsPage() {
  await requireAuth();
  const status = await get2FAStatusAction();
  
  return (
    <TwoFactorSetup initialStatus={status} />
  );
}
