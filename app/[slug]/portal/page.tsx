import { redirectLegacyPortal } from "@/lib/portal/legacy-redirect";

export default async function LegacyPortalHome({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await redirectLegacyPortal(slug);
}
