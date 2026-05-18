import Link from 'next/link';
import { ReactNode } from 'react';
import { Shield, Search } from 'lucide-react';
import { getImpersonationState, requirePlatformAdmin } from '@/lib/admin/platform';
import { stopImpersonationAction } from './actions';
import { Button } from '@/components/ui/button';
import { EnterpriseAdminSidebar } from '@/components/layouts/enterprise-sidebar';
import { platformNavSections } from '@/lib/navigation/enterprise';

export default async function PlatformAdminLayout({ children }: { children: ReactNode }) {
  const [admin, impersonation] = await Promise.all([
    requirePlatformAdmin(),
    getImpersonationState(),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {impersonation && (
        <div className="border-b border-amber-500/40 bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <span>
              Impersonating tenant user {impersonation.userId} for {impersonation.reason}. Expires {new Date(impersonation.expiresAt).toLocaleTimeString()}. Platform actions are still audited as {admin.email}.
            </span>
            <form action={stopImpersonationAction}>
              <Button type="submit" size="sm" variant="outline" className="border-zinc-900 text-zinc-950 hover:bg-amber-300">
                Exit impersonation
              </Button>
            </form>
          </div>
        </div>
      )}

      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-slate-800 bg-slate-950 p-5 lg:block">
          <Link href="/admin" className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-orange-500 text-slate-950">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Atlas Platform</div>
              <div className="text-xs text-slate-500">{admin.email}</div>
            </div>
          </Link>

          <EnterpriseAdminSidebar sections={platformNavSections} />

          <div className="mt-8 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            Destructive tenant controls require audit context and confirmation.
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 px-4 py-4 backdrop-blur md:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-orange-500 text-slate-950 lg:hidden">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-sm font-semibold">Platform control plane</h1>
                  <p className="truncate text-xs text-slate-500">{admin.email}</p>
                </div>
              </div>
              <div className="hidden h-10 w-full max-w-xl items-center gap-3 rounded-md border border-slate-800 bg-slate-900 px-3 text-sm text-slate-500 md:flex">
                <Search className="h-4 w-4" />
                Search tenants, audit events, jobs, health checks
              </div>
            </div>
          </header>

          <div className="px-4 py-6 md:px-8">
            <div className="mb-6 flex items-center justify-between lg:hidden">
            <Link href="/admin" className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="h-5 w-5 text-orange-500" />
              Atlas Platform
            </Link>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
