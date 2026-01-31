import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getServerSession } from '@/lib/auth/session';
import { signOut } from '@/auth';
import { db } from '@/db';
import { memberships } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getActiveNotices, pickPrimaryNotice } from '@/lib/notices/queries';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';

interface CustomerPortalShellProps {
  subdomain: string;
  children: ReactNode;
  siteId?: string | null;
}

async function getUserRole(userId: string, subdomain: string): Promise<string | null> {
  const org = await getOrgBySubdomain(subdomain);
  if (!org) return null;
  
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, userId),
      eq(memberships.orgId, org.id),
      eq(memberships.isActive, true)
    ),
  });
  return membership?.role || null;
}

export async function CustomerPortalShell({
  subdomain,
  children,
  siteId,
}: CustomerPortalShellProps) {
  const session = await getServerSession();
  const userRole = session?.user?.id ? await getUserRole(session.user.id, subdomain) : null;
  const isAdmin = userRole === 'CUSTOMER_ADMIN';
  const org = await getOrgBySubdomain(subdomain);
  const notices = org ? await getActiveNotices(org.id, siteId) : [];
  const primaryNotice = pickPrimaryNotice(notices);
  const noticeStyle =
    primaryNotice?.severity === 'CRITICAL'
      ? { container: 'bg-red-50 text-red-900', badge: 'destructive' as const }
      : primaryNotice?.severity === 'WARN'
      ? { container: 'bg-yellow-50 text-yellow-900', badge: 'secondary' as const }
      : { container: 'bg-blue-50 text-blue-900', badge: 'outline' as const };

  return (
    <div className="min-h-screen bg-gray-50">
      {primaryNotice && (
        <div className={`border-b ${noticeStyle.container}`}>
          <div className="mx-auto flex items-center gap-3 px-6 py-2 text-sm">
            <Badge variant={noticeStyle.badge}>{primaryNotice.severity}</Badge>
            <span className="font-medium">{primaryNotice.title}</span>
            <span>{primaryNotice.body}</span>
          </div>
        </div>
      )}
      <nav className="border-b bg-white">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href={`/s/${subdomain}/tickets`} className="flex items-center gap-2 text-sm font-semibold">
              {org?.branding?.logoUrl ? (
                <Image src={org.branding.logoUrl} alt="Logo" width={24} height={24} className="h-6 w-6 rounded" />
              ) : null}
              <span>{org?.branding?.nameOverride ?? 'Support Portal'}</span>
            </Link>
            <Link
              href={`/s/${subdomain}/tickets`}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Tickets
            </Link>
            <Link
              href={`/s/${subdomain}/tickets/new`}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Create Request
            </Link>
            {session && userRole && (org?.features?.team ?? true) && (
              <Link
                href={`/s/${subdomain}/team`}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Team
              </Link>
            )}
            {session && isAdmin && (org?.features?.assets ?? true) && (
              <Link
                href={`/s/${subdomain}/assets`}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Assets
              </Link>
            )}
            {session && isAdmin && (org?.features?.exports ?? true) && (
              <Link
                href={`/s/${subdomain}/exports`}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Exports
              </Link>
            )}
            {session && (org?.features?.services ?? true) && (
              <Link
                href={`/s/${subdomain}/services`}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Services
              </Link>
            )}
            {session && isAdmin && (
              <Link
                href={`/s/${subdomain}/activity`}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Activity
              </Link>
            )}
          </div>
          <div className="flex items-center gap-4">
            {session?.user?.email && (
              <span className="text-sm text-gray-600">{session.user.email}</span>
            )}
            {session ? (
              <form
                action={async () => {
                  'use server';
                  await signOut();
                  redirect('/login');
                }}
              >
                <Button type="submit" variant="ghost" size="sm">
                  Sign out
                </Button>
              </form>
            ) : (
              <Link href="/login">
                <Button type="button" variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
