import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { organizations, memberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrganizationMembers } from '@/components/organizations/organization-members';
import Link from 'next/link';

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireInternalRole();
  const { id } = await params;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, id),
  });

  if (!org) {
    notFound();
  }

  const orgMemberships = await db.query.memberships.findMany({
    where: eq(memberships.orgId, id),
    with: {
      user: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/organizations" className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block">
          ← Back to organizations
        </Link>
        <h1 className="text-2xl font-bold">{org.name}</h1>
        <p className="text-sm text-gray-600">
          {org.subdomain}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <OrganizationMembers orgId={id} memberships={orgMemberships} />
        </CardContent>
      </Card>
    </div>
  );
}
