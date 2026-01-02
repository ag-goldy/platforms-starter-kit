import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function OrganizationsPage() {
  await requireInternalRole();

  const orgList = await db.query.organizations.findMany({
    orderBy: (orgs, { asc }) => [asc(orgs.name)],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <Link href="/app/organizations/new">
          <Button>New Organization</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          {orgList.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              No organizations yet. Create one to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {orgList.map((org) => (
                <Link
                  key={org.id}
                  href={`/app/organizations/${org.id}`}
                  className="block rounded-lg border bg-white p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{org.name}</h3>
                      <p className="text-sm text-gray-600">
                        {org.subdomain}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
