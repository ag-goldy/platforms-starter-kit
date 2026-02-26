import { notFound, redirect } from 'next/navigation';
import { db } from '@/db';
import { kbCategories } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KBArticleSubmitForm } from '@/components/kb/article-submit-form';

interface KBSubmitPageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function KBSubmitPage({ params }: KBSubmitPageProps) {
  const { subdomain } = await params;
  const org = await getOrgBySubdomain(subdomain);

  if (!org) {
    notFound();
  }

  // Require authentication
  let user;
  try {
    const ctx = await requireOrgMemberRole(org.id);
    user = ctx.user;
  } catch {
    redirect(`/login?callbackUrl=/s/${subdomain}/kb/submit`);
  }

  // Check if knowledge base is enabled
  if (org.features?.knowledge === false) {
    notFound();
  }

  // Get public categories
  const categories = await db.query.kbCategories.findMany({
    where: and(
      eq(kbCategories.orgId, org.id),
      eq(kbCategories.isPublic, true)
    ),
    orderBy: [asc(kbCategories.sortOrder), asc(kbCategories.name)],
  });

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Submit Knowledge Base Article</CardTitle>
          <CardDescription>
            Share your knowledge with the community. Your article will be reviewed before publication.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KBArticleSubmitForm
            orgId={org.id}
            subdomain={subdomain}
            categories={categories}
            userName={user.name || user.email}
          />
        </CardContent>
      </Card>
    </div>
  );
}
