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
import { CollapsibleSidebar } from "@/components/layouts/collapsible-sidebar";
import { adminNavSections } from "@/lib/navigation/enterprise";
import { Search } from "lucide-react";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;

  try {
    session = await auth();
  } catch (error) {
    console.error("[App Layout] Auth error:", error);
    redirect("/login?error=SessionExpired");
  }

  if (!session?.user) {
    redirect("/login");
  }

  const userExists = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { id: true, isInternal: true },
  });

  const platformAdminExists = await db.query.platformAdmins.findFirst({
    where: eq(platformAdmins.id, session.user.id),
    columns: { id: true, role: true },
  });

  if (!userExists && !platformAdminExists) {
    console.error("[App Layout] User not found in DB:", session.user.id);
    redirect("/login?error=SessionInvalid");
  }

  if (userExists && !userExists.isInternal) {
    const redirectUrl = await getDefaultRedirectUrl(session.user.id, false);
    redirect(redirectUrl);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <NavigationLoader />
      <div className="flex min-h-screen">
        <CollapsibleSidebar
          sections={adminNavSections}
          logo={
            <Link href="/app" className="flex items-center gap-2">
              <img
                src="/logo/atlas-logo.png"
                alt="Atlas"
                className="h-7 w-auto"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-tight">
                  Atlas
                </div>
              </div>
            </Link>
          }
        />

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
            <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
              <Link href="/app" className="flex items-center gap-2 lg:hidden">
                <img
                  src="/logo/atlas-logo.png"
                  alt="Atlas"
                  className="h-7 w-auto"
                />
              </Link>

              <div className="hidden min-w-0 flex-1 items-center md:flex">
                <div className="flex h-9 w-full max-w-xl items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  <Search className="h-4 w-4" />
                  <span className="truncate">Search...</span>
                  <kbd className="ml-auto rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                    ⌘K
                  </kbd>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden max-w-48 truncate text-sm text-slate-500 md:inline">
                  {session?.user?.email}
                </span>
                <DarkModeSimpleToggle />
                <NotificationBell />
                <SignOutButton variant="ghost" size="sm" />
              </div>
            </div>
          </header>

          <main className="px-4 py-5 md:px-6 lg:px-8">
            <ErrorBoundary>
              <AppProviders>{children}</AppProviders>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}
