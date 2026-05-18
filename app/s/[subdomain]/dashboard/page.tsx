import { redirect } from 'next/navigation';

export default async function CustomerPortalDashboardRoute({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  redirect(`/s/${subdomain}`);
}

