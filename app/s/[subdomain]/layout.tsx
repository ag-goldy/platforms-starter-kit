import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { SignOutButton } from "@/components/auth/signout-button";
import { Badge } from "@/components/ui/badge";
import { CustomerPortalNav } from "@/components/layouts/enterprise-sidebar";
import {
  getCustomerNavItems,
  getCustomerPortalCapabilities,
} from "@/lib/navigation/enterprise";
import { CustomerPortalProvider } from "@/components/customer/CustomerPortalContext";
import { requirePortalAccess } from "@/lib/portal/access";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { RealtimeStatus } from "@/components/realtime/realtime-status";

interface SubdomainLayoutProps {
  children: React.ReactNode;
  modal: React.ReactNode;
  params: Promise<{ subdomain: string }>;
}

export default async function CustomerPortalLayout({
  children,
  modal,
  params,
}: SubdomainLayoutProps) {
  const { subdomain } = await params;
  const access = await requirePortalAccess(subdomain);
  if (!access) notFound();

  const orgName = access.org.branding?.nameOverride || access.org.name;
  const capabilities = getCustomerPortalCapabilities(
    access.org,
    Boolean(access.isCustomerAdmin),
  );
  const navItems = getCustomerNavItems(subdomain, capabilities);

  return (
    <CustomerPortalProvider>
      <div className="min-h-screen bg-slate-50 text-slate-950">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link
              href={`/s/${subdomain}`}
              className="flex min-w-0 items-center gap-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-950 text-sm font-semibold text-orange-400">
                {orgName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{orgName}</div>
                <div className="truncate text-xs text-slate-500">
                  Customer service portal
                </div>
              </div>
            </Link>

            <div className="flex min-w-0 items-center gap-3">
              <div className="hidden sm:block">
                <RealtimeStatus orgId={access.org.id} />
              </div>
              <NotificationBell />
              {access.isCustomerAdmin && (
                <Badge
                  variant="outline"
                  className="hidden border-orange-200 bg-orange-50 text-orange-700 md:inline-flex"
                >
                  Customer admin
                </Badge>
              )}
              <span className="hidden max-w-52 truncate text-sm text-slate-500 md:inline">
                {access.user.email}
              </span>
              <SignOutButton variant="ghost" size="sm" />
            </div>
          </div>
        </header>

        <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6">
          <aside className="hidden w-64 shrink-0 md:block">
            <div className="sticky top-24 space-y-4">
              <CustomerPortalNav items={navItems} />
              <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-500 shadow-sm">
                <div className="mb-2 flex items-center gap-2 font-medium text-slate-700">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Admin-controlled ITSM
                </div>
                Request forms, routing, SLA targets, and catalog publishing are
                managed by Atlas admins.
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1 pb-20">{children}</main>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white md:hidden">
          <CustomerPortalNav items={navItems} mobile />
        </nav>

        {modal}
      </div>
    </CustomerPortalProvider>
  );
}
