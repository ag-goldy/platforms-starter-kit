import { redirectLegacyPortal } from "@/lib/portal/legacy-redirect";

export default async function LegacyPortalTicketDetail({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  await redirectLegacyPortal(slug, `tickets/${id}`);
}
