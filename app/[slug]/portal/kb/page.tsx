import { redirectLegacyPortal } from '@/lib/portal/legacy-redirect';

export default async function LegacyPortalKb({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await redirectLegacyPortal(slug, 'kb');
}
