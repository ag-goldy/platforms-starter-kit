import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db';
import { organizations, memberships } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut } from '@/auth';
import { Ticket, Plus, Users, BookOpen, Activity, Server, FileText } from 'lucide-react';

interface SubdomainLayoutProps {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>;
}

async function getUserRole(userId: string, orgId: string): Promise<string | null> {
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, userId),
      eq(memberships.orgId, orgId),
      eq(memberships.isActive, true)
    ),
  });
  return membership?.role || null;
}

export default async function SubdomainLayout({
  children,
  params,
}: SubdomainLayoutProps) {
  const { subdomain } = await params;

  // Get the organization for this subdomain
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.subdomain, subdomain),
  });

  if (!org) {
    notFound();
  }

  // Check if user is authenticated
  const session = await auth();
  const isAuthenticated = !!session?.user;
  const userRole = session?.user?.id ? await getUserRole(session.user.id, org.id) : null;
  const isAdmin = userRole === 'CUSTOMER_ADMIN';

  // Feature flags
  const features = org.features || {};
  const teamEnabled = features.team ?? true;
  const assetsEnabled = features.assets ?? true;
  const exportsEnabled = features.exports ?? true;
  const servicesEnabled = features.services ?? true;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-6">
            <Link href={`/s/${subdomain}`} className="flex items-center gap-2">
              <img 
                src="/logo/AGR_logo.png" 
                alt="AGR Networks" 
                className="h-6 w-auto"
              />
              <span className="text-gray-300">|</span>
              <img 
                src="/logo/atlas-logo.png" 
                alt="Atlas" 
                className="h-5 w-auto"
              />
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {isAuthenticated && (
                <>
                  <Link
                    href={`/s/${subdomain}/tickets`}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    <Ticket className="h-4 w-4" />
                    Tickets
                  </Link>
                  <Link
                    href={`/s/${subdomain}/tickets/new`}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Create Request
                  </Link>
                  {teamEnabled && (
                    <Link
                      href={`/s/${subdomain}/team`}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                    >
                      <Users className="h-4 w-4" />
                      Team
                    </Link>
                  )}
                  {servicesEnabled && (
                    <Link
                      href={`/s/${subdomain}/services`}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                    >
                      <Server className="h-4 w-4" />
                      Services
                    </Link>
                  )}
                  {isAdmin && assetsEnabled && (
                    <Link
                      href={`/s/${subdomain}/assets`}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                    >
                      <FileText className="h-4 w-4" />
                      Assets
                    </Link>
                  )}
                </>
              )}
              <Link
                href={`/s/${subdomain}/kb`}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                Knowledge Base
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <span className="hidden md:inline text-sm text-gray-600">
                  {session.user.email}
                </span>
                <form
                  action={async () => {
                    'use server';
                    await signOut({ redirectTo: '/login' });
                  }}
                >
                  <Button type="submit" variant="ghost" size="sm">
                    Sign out
                  </Button>
                </form>
              </>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
            )}
          </div>
        </div>
      </nav>
      <main className="p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
