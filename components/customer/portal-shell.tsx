import Link from 'next/link';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getServerSession } from '@/lib/auth/session';
import { signOut } from '@/auth';

interface CustomerPortalShellProps {
  subdomain: string;
  children: ReactNode;
}

export async function CustomerPortalShell({
  subdomain,
  children,
}: CustomerPortalShellProps) {
  const session = await getServerSession();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href={`/s/${subdomain}/tickets`} className="text-sm font-semibold">
              Support Portal
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
              New Ticket
            </Link>
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
