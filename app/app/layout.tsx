import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { requireInternalRole } from '@/lib/auth/permissions';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut } from '@/auth';
import { getDefaultRedirectUrl } from '@/lib/auth/redirect';
import { ErrorBoundary } from '@/components/error-boundary';
import { MobileNav } from '@/components/layouts/mobile-nav';
import { OrganizedNav } from '@/components/layouts/organized-nav';
import { trackSessionActivity } from '@/lib/auth/session-tracking';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  // Redirect customer users to their portal before checking internal role
  if (session.user && !session.user.isInternal) {
    const redirectUrl = await getDefaultRedirectUrl(session.user.id, false);
    redirect(redirectUrl);
  }

  try {
    await requireInternalRole();
  } catch {
    redirect('/login');
  }

  // Track session activity for authenticated users
  if (session.user?.id) {
    await trackSessionActivity(session.user.id);
  }

  // Flat list for mobile nav
  const navLinks = [
    { href: '/app', label: 'Tickets' },
    { href: '/app/dashboard', label: 'Dashboard' },
    { href: '/app/organizations', label: 'Organizations' },
    { href: '/app/users', label: 'Users' },
    { href: '/app/templates', label: 'Templates' },
    { href: '/app/tags', label: 'Tags' },
    { href: '/app/sla', label: 'SLA' },
    { href: '/app/reports', label: 'Reports' },
    { href: '/app/settings/sessions', label: 'Sessions' },
    { href: '/app/settings/security', label: 'Security' },
    { href: '/app/admin/audit', label: 'Audit Logs' },
    { href: '/app/admin/health', label: 'Health' },
    { href: '/app/admin/compliance', label: 'Compliance' },
    { href: '/app/admin/retention', label: 'Retention' },
    { href: '/app/admin/jobs', label: 'Failed Jobs' },
    { href: '/app/admin/ops', label: 'Ops Dashboard' },
    { href: '/app/admin/internal-groups', label: 'Internal Groups' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white">
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4 md:gap-8">
            <Link href="/app" className="text-lg font-semibold">
              AGR Support
            </Link>
            <OrganizedNav />
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <span className="hidden md:inline text-sm text-gray-600">
              {session?.user?.email}
            </span>
            <MobileNav links={navLinks} userEmail={session?.user?.email} />
            <form
              className="hidden lg:block"
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
          </div>
        </div>
      </nav>
      <main className="p-4 md:p-6">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
