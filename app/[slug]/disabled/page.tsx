import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq, or } from 'drizzle-orm';

export default async function TenantDisabledPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  /* eslint-disable no-restricted-syntax -- Disabled page resolves tenant by public slug before tenant-scoped context exists. */
  const org = await db.query.organizations.findFirst({
    where: or(eq(organizations.slug, slug), eq(organizations.subdomain, slug)),
    columns: { name: true },
  });
  /* eslint-enable no-restricted-syntax */

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-md bg-orange-500 text-xl font-bold text-zinc-950">
          !
        </div>
        <h1 className="text-2xl font-semibold">Portal temporarily unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          {org?.name || 'This tenant'} is currently disabled. Contact your support administrator if you believe this is unexpected.
        </p>
      </div>
    </main>
  );
}
