import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { eq, asc, desc, isNull } from 'drizzle-orm';

interface OrganizationsPageProps {
  searchParams: Promise<{ showDisabled?: string }>;
}

export default async function OrganizationsPage({ searchParams }: OrganizationsPageProps) {
  await requireInternalRole();
  
  const params = await searchParams;
  const showDisabled = params.showDisabled === 'true';

  // Query organizations - filter out disabled unless showDisabled is true
  let orgList;
  if (showDisabled) {
    // Show all organizations (including disabled)
    orgList = await db.query.organizations.findMany({
      orderBy: (orgs, { asc }) => [asc(orgs.name)],
    });
  } else {
    // Show only active organizations
    orgList = await db.query.organizations.findMany({
      where: eq(organizations.isActive, true),
      orderBy: (orgs, { asc }) => [asc(orgs.name)],
    });
  }

  const disabledCount = await db.$count(
    organizations,
    eq(organizations.isActive, false)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-sm text-gray-600">
            Manage customer organizations and their settings
          </p>
        </div>
        <Link href="/app/organizations/new">
          <Button>New Organization</Button>
        </Link>
      </div>

      {/* Filter Toggle */}
      {disabledCount > 0 && (
        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600">
            {disabledCount} disabled organization{disabledCount !== 1 ? 's' : ''}
          </span>
          <Link
            href={showDisabled ? '/app/organizations' : '/app/organizations?showDisabled=true'}
            className="text-sm text-blue-600 hover:underline"
          >
            {showDisabled ? 'Hide disabled' : 'Show disabled'}
          </Link>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          {orgList.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              {showDisabled 
                ? 'No organizations found.'
                : 'No active organizations. Create one or check disabled organizations.'}
            </div>
          ) : (
            <div className="space-y-2">
              {orgList.map((org) => (
                <Link
                  key={org.id}
                  href={`/app/organizations/${org.id}`}
                  className={`block rounded-lg border p-4 hover:bg-gray-50 transition-colors ${
                    !org.isActive ? 'opacity-60 bg-gray-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{org.name}</h3>
                        {!org.isActive && (
                          <Badge variant="destructive" className="text-xs">
                            Disabled
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {org.subdomain}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN}
                      </p>
                      {!org.isActive && org.disabledAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          Disabled on {new Date(org.disabledAt).toLocaleDateString()}
                        </p>
                      )}
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
