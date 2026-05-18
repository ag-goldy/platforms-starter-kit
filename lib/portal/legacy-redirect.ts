import { redirect } from 'next/navigation';
import { getOrgByPortalSlug } from '@/lib/portal/access';

export async function redirectLegacyPortal(slug: string, suffix = ''): Promise<never> {
  const org = await getOrgByPortalSlug(slug);
  const subdomain = org?.subdomain || slug;
  const normalizedSuffix = suffix ? `/${suffix.replace(/^\/+/, '')}` : '';
  redirect(`/s/${subdomain}${normalizedSuffix}`);
}
