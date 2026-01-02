import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { requireInternalRole } from '@/lib/auth/permissions';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut } from '@/auth';
import { getDefaultRedirectUrl } from '@/lib/auth/redirect';

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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/app" className="text-lg font-semibold">
              AGR Support
            </Link>
            <div className="flex gap-4">
              <Link
                href="/app"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Tickets
              </Link>
              <Link
                href="/app/organizations"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Organizations
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{session?.user?.email}</span>
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
          </div>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}

