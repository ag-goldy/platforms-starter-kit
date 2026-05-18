import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Link from "next/link";

import { SignOutButton } from "@/components/auth/signout-button";
import { getDefaultRedirectUrl } from "@/lib/auth/redirect";
import { db } from "@/db";
import { users, platformAdmins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ErrorBoundary } from "@/components/error-boundary";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { AppProviders } from "@/components/providers/app-providers";
import { NavigationLoader } from "@/components/navigation-loader";
import { DarkModeSimpleToggle } from "@/components/ui/dark-mode-toggle";
import { NewUserTour } from "@/components/onboarding/simple-tour";
import { EnterpriseAdminSidebar } from "@/components/layouts/enterprise-sidebar";
import {
  adminNavSections,
  enterpriseQuickActions,
} from "@/lib/navigation/enterprise";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

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
    console.error("[App Layout] Auth error:", error);
    redirect("/login?error=SessionExpired");
  }

  if (!session?.user) {
    redirect("/login");
  }

  // Verify user exists in database (check both tenant users and platform admins)
  const userExists = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { id: true, isInternal: true },
  });

  // Also check if this is a platform admin
  const platformAdminExists = await db.query.platformAdmins.findFirst({
    where: eq(platformAdmins.id, session.user.id),
    columns: { id: true, role: true },
  });

  if (!userExists && !platformAdminExists) {
    // User in session but not in DB - redirect to login
    // The login page will handle clearing the invalid session
    console.error("[App Layout] User not found in DB:", session.user.id);
    redirect("/login?error=SessionInvalid");
  }

  // Redirect customer users to their portal (only check for tenant users, not platform admins)
  if (userExists && !userExists.isInternal) {
    const redirectUrl = await getDefaultRedirectUrl(session.user.id, false);
    redirect(redirectUrl);
  }

  // Note: Authentication is already verified by middleware checking the session cookie
  // The session.user.isInternal flag comes from the JWT token (set at login)
  // No need for additional DB lookup on every page navigation

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <NavigationLoader />
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-900 lg:block">
          <Link href="/app" className="mb-6 flex items-center gap-3 px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo/atlas-logo.png"
              alt="atlas.logo"
              className="h-8 w-auto"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight">
                Atlas Control
              </div>
              <div className="truncate text-xs text-slate-500">
                Enterprise service desk
              </div>
            </div>
          </Link>
          <EnterpriseAdminSidebar sections={adminNavSections} />
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
            <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
              <Link href="/app" className="flex items-center gap-3 lg:hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo/atlas-logo.png"
                  alt="atlas.logo"
                  className="h-8 w-auto"
                />
              </Link>

              <div className="hidden min-w-0 flex-1 items-center md:flex">
                <div className="flex h-10 w-full max-w-2xl items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  <Search className="h-4 w-4" />
                  <span className="truncate">
                    Search tickets, customers, KB, audit, assets, and
                    integrations
                  </span>
                  <kbd className="ml-auto rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                    ⌘K
                  </kbd>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="hidden border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 sm:inline-flex"
                >
                  Operational
                </Badge>
                <span className="hidden max-w-56 truncate text-sm text-slate-500 md:inline">
                  {session?.user?.email}
                </span>
                <DarkModeSimpleToggle />
                <NotificationBell />
                <SignOutButton variant="ghost" size="sm" />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 dark:border-slate-800 lg:hidden">
              {enterpriseQuickActions.slice(0, 5).map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="inline-flex shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <Icon className="h-3.5 w-3.5 text-orange-500" />
                    {action.label}
                  </Link>
                );
              })}
            </div>
          </header>

          <main className="px-4 py-5 md:px-6 lg:px-8">
            <ErrorBoundary>
              <AppProviders>{children}</AppProviders>
            </ErrorBoundary>
          </main>
        </div>
      </div>

      <NewUserTour />
    </div>
  );
}
