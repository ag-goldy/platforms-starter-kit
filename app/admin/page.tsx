import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getAllSubdomains } from '@/lib/subdomains';
import type { Metadata } from 'next';
import { AdminDashboard } from './dashboard';
import { rootDomain } from '@/lib/utils';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { users } from '@/db/schema';

export const metadata: Metadata = {
  title: `Admin Dashboard | ${rootDomain}`,
  description: `Manage subdomains for ${rootDomain}`
};

async function checkIsAdmin(userId: string): Promise<boolean> {
  // Check if user is internal/admin
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { isInternal: true }
  });
  return user?.isInternal === true;
}

export default async function AdminPage() {
  // Check authentication
  const session = await auth();
  
  if (!session?.user?.id) {
    // Not logged in - redirect to login
    redirect('/login?callbackUrl=/admin');
  }
  
  // Check if user is admin/internal
  const isAdmin = await checkIsAdmin(session.user.id);
  
  if (!isAdmin) {
    // Logged in but not admin - redirect to app dashboard
    redirect('/app');
  }
  
  // User is authenticated and is admin - show page
  const tenants = await getAllSubdomains();

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <AdminDashboard tenants={tenants} />
    </div>
  );
}
