import { notFound } from 'next/navigation';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { assets, exportRequests, requestTypes } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { 
  FileText, 
  Download, 
  Users, 
  Server, 
  Settings,
  Ticket,
  BookOpen,
  Activity
} from 'lucide-react';

export default async function OrganizationManagementPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const org = await getOrgBySubdomain(subdomain);

  if (!org) {
    notFound();
  }

  try {
    await requireOrgMemberRole(org.id, ['CUSTOMER_ADMIN']);

    // Fetch counts for modules
    const [assetCountRows, requestTypeCountRows, exportCountRows] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(assets).where(eq(assets.orgId, org.id)),
      db.select({ count: sql<number>`count(*)::int` }).from(requestTypes).where(eq(requestTypes.orgId, org.id)),
      db.select({ count: sql<number>`count(*)::int` }).from(exportRequests).where(eq(exportRequests.orgId, org.id)),
    ]);

    const assetCount = Number(assetCountRows[0]?.count ?? 0);
    const requestTypeCount = Number(requestTypeCountRows[0]?.count ?? 0);
    const exportCount = Number(exportCountRows[0]?.count ?? 0);

    const modules = [
      {
        title: 'Service Catalog',
        description: 'Request types and dynamic forms.',
        href: `/s/${subdomain}/tickets/new`,
        icon: FileText,
        count: requestTypeCount,
        badge: 'New',
      },
      {
        title: 'Exports',
        description: 'Download customer export history.',
        href: `/s/${subdomain}/exports`,
        icon: Download,
        count: exportCount,
        footer: 'Admin only',
      },
      {
        title: 'Team',
        description: 'Manage users and offboarding.',
        href: `/s/${subdomain}/team`,
        icon: Users,
      },
      {
        title: 'Assets',
        description: 'Linked infrastructure inventory.',
        href: `/s/${subdomain}/assets`,
        icon: Server,
        count: assetCount,
      },
      {
        title: 'Tickets',
        description: 'View and manage support tickets.',
        href: `/s/${subdomain}?view=tickets`,
        icon: Ticket,
      },
      {
        title: 'Knowledge Base',
        description: 'Browse help articles and guides.',
        href: `/s/${subdomain}?view=kb`,
        icon: BookOpen,
      },
      {
        title: 'Status Page',
        description: 'Service health and incidents.',
        href: `/s/${subdomain}?view=status`,
        icon: Activity,
      },
      {
        title: 'Settings',
        description: 'Organization configuration.',
        href: `/s/${subdomain}?view=settings`,
        icon: Settings,
      },
    ];

    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Organization Management</h1>
          <p className="text-sm text-gray-600">
            Manage your organization settings and access all portal modules.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Access</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <Link
                    key={module.title}
                    href={module.href}
                    className="flex flex-col rounded-lg border bg-white p-4 transition-colors hover:bg-gray-50 hover:border-gray-300"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-2 rounded-lg bg-gray-100">
                        <Icon className="h-5 w-5 text-gray-600" />
                      </div>
                      {module.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {module.badge}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm">{module.title}</h3>
                    <p className="text-xs text-gray-600 mt-1 flex-1">
                      {module.description}
                    </p>
                    <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                      <span>
                        {typeof module.count === 'number' && module.count > 0
                          ? `${module.count} items`
                          : ''}
                      </span>
                      <span className="text-gray-400">
                        {module.footer || 'Open →'}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Organization Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">{org.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Subdomain</p>
                <p className="font-medium">{org.subdomain}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  } catch {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Customer admins can access organization management.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
}
