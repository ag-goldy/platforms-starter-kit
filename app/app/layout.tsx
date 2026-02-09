import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut } from '@/auth';
import { getDefaultRedirectUrl } from '@/lib/auth/redirect';
import { ErrorBoundary } from '@/components/error-boundary';
import { MobileNav } from '@/components/layouts/mobile-nav';
import { OrganizedNav } from '@/components/layouts/organized-nav';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ThemeToggle } from '@/components/theme-toggle';
import { NavigationLoader } from '@/components/navigation-loader';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  
  try {
    // Get session - this will fail if JWT can't be decrypted
    session = await auth();
  } catch (error) {
    // Session is invalid - redirect to login
    console.error('[App Layout] Auth error:', error);
    redirect('/login?error=SessionExpired');
  }
  
  if (!session?.user) {
    redirect('/login');
  }

  // Redirect customer users to their portal
  if (session.user && !session.user.isInternal) {
    const redirectUrl = await getDefaultRedirectUrl(session.user.id, false);
    redirect(redirectUrl);
  }

  // Note: Authentication is already verified by middleware checking the session cookie
  // The session.user.isInternal flag comes from the JWT token (set at login)
  // No need for additional DB lookup on every page navigation

  const navLinks = [
    { href: '/app', label: 'Dashboard' },
    { href: '/app/tickets', label: 'Tickets' },
    { href: '/app/kb', label: 'Knowledge Base' },
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
    { href: '/app/admin/zabbix', label: 'Zabbix' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <NavigationLoader />
      <nav className="border-b bg-card">
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4 md:gap-8">
            <Link href="/app" className="flex items-center gap-3">
              <img 
                src="/logo/AGR_logo.png" 
                alt="AGR Networks" 
                className="h-8 w-auto"
              />
              <span className="text-gray-300">|</span>
              <img 
                src="/logo/atlas-logo.png" 
                alt="Atlas" 
                className="h-7 w-auto"
              />
            </Link>
            <OrganizedNav />
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <span className="hidden md:inline text-sm text-gray-600">
              {session?.user?.email}
            </span>
            <ThemeToggle />
            <NotificationBell />
            <MobileNav links={navLinks} userEmail={session?.user?.email} />
            <form
              className="hidden lg:block"
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
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
