import { redirectLegacyPortal } from '@/lib/portal/legacy-redirect';

export default async function LegacyPortalKbArticle({
  params,
}: {
  params: Promise<{ slug: string; article: string }>;
}) {
  const { slug, article } = await params;
  await redirectLegacyPortal(slug, `kb/${article}`);
}
