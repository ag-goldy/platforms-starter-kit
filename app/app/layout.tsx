import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SignOutButton } from '@/components/auth/signout-button';
import { getDefaultRedirectUrl } from '@/lib/auth/redirect';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ErrorBoundary } from '@/components/error-boundary';
import { MobileNav } from '@/components/layouts/mobile-nav';
import { OrganizedNav } from '@/components/layouts/organized-nav';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { AppProviders } from '@/components/providers/app-providers';
import { NavigationLoader } from '@/components/navigation-loader';
import { DarkModeSimpleToggle } from '@/components/ui/dark-mode-toggle';
import { NewUserTour } from '@/components/onboarding/simple-tour';

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

  // Verify user exists in database
  const userExists = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { id: true, isInternal: true },
  });

  if (!userExists) {
    // User in session but not in DB - redirect to login
    // The login page will handle clearing the invalid session
    console.error('[App Layout] User not found in DB:', session.user.id);
    redirect('/login?error=SessionInvalid');
  }

  // Redirect customer users to their portal
  if (session.user && !userExists.isInternal) {
    const redirectUrl = await getDefaultRedirectUrl(session.user.id, false);
    redirect(redirectUrl);
  }

  // Note: Authentication is already verified by middleware checking the session cookie
  // The session.user.isInternal flag comes from the JWT token (set at login)
  // No need for additional DB lookup on every page navigation

  // Simplified nav links for mobile menu
  const navLinks = [
    { href: '/app', label: 'Dashboard' },
    { href: '/app/tickets', label: 'Tickets' },
    { href: '/app/organizations', label: 'Organizations' },
    { href: '/app/users', label: 'Users' },
    { href: '/app/reports', label: 'Reports' },
    { href: '/app/settings/security', label: 'Settings' },
    { href: '/app/admin/audit', label: 'Admin' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <NavigationLoader />
      <nav className="border-b bg-card">
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4 md:gap-8">
            <Link href="/app" className="flex items-center gap-3">
              <img 
                src="/logo/atlas-logo.png" 
                alt="atlas.logo" 
                className="h-8 w-auto"
              />
            </Link>
            <OrganizedNav />
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <span className="hidden md:inline text-sm text-muted-foreground">
              {session?.user?.email}
            </span>
            <DarkModeSimpleToggle />
            <NotificationBell />
            <MobileNav links={navLinks} userEmail={session?.user?.email} />
            <div className="hidden lg:block">
              <SignOutButton variant="ghost" size="sm" />
            </div>
          </div>
        </div>
      </nav>
      <main className="p-4 md:p-6">
        <ErrorBoundary>
          <AppProviders>{children}</AppProviders>
        </ErrorBoundary>
      </main>
      
      {/* Onboarding Tour */}
      <NewUserTour />
      
      {/* Keyboard shortcut hint */}
      <div className="fixed bottom-4 right-4 text-xs text-muted-foreground hidden lg:block bg-background/80 backdrop-blur px-2 py-1 rounded shadow border">
        Press <kbd className="px-1 py-0.5 bg-muted rounded border">⌘</kbd> + <kbd className="px-1 py-0.5 bg-muted rounded border">K</kbd> for commands
      </div>
    </div>
  );
}
