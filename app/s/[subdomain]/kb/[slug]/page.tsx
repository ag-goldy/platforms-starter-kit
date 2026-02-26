import { notFound, redirect } from 'next/navigation';
import { db } from '@/db';
import { organizations, kbArticles, kbCategories } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { ArticleView } from '@/components/kb/article-view';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { ChevronRight } from 'lucide-react';

interface KBArticlePageProps {
  params: Promise<{ subdomain: string; slug: string }>;
}

export async function generateMetadata({ params }: KBArticlePageProps): Promise<Metadata> {
  const { subdomain, slug } = await params;
  
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.subdomain, subdomain),
  });

  if (!org) {
    return { title: 'Not Found' };
  }

  const article = await db.query.kbArticles.findFirst({
    where: and(
      eq(kbArticles.orgId, org.id),
      eq(kbArticles.slug, slug),
      eq(kbArticles.status, 'published')
    ),
  });

  return {
    title: article ? `${article.title} - ${org.branding?.nameOverride || org.name}` : 'Not Found',
    description: article?.excerpt || undefined,
  };
}

export default async function KBArticlePage({ params }: KBArticlePageProps) {
  const { subdomain, slug } = await params;

  // Get organization
  const org = await getOrgBySubdomain(subdomain);
  if (!org) {
    notFound();
  }

  // Require authentication
  try {
    await requireOrgMemberRole(org.id);
  } catch {
    redirect(`/login?callbackUrl=/s/${subdomain}/kb/${slug}`);
  }

  // Check if knowledge base is enabled
  if (org.features?.knowledge === false) {
    notFound();
  }

  // Get article with related data
  const article = await db.query.kbArticles.findFirst({
    where: and(
      eq(kbArticles.orgId, org.id),
      eq(kbArticles.slug, slug)
    ),
    with: {
      category: true,
      author: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Article must exist and be published
  if (!article || article.status !== 'published') {
    notFound();
  }

  // Check visibility - public articles are accessible to everyone
  // For internal/agent-only visibility, additional auth checks would be needed
  if (article.visibility !== 'public') {
    // In a real implementation, check if user is authenticated and has access
    // For now, we&apos;ll show not found for non-public articles in public portal
    notFound();
  }

  // Increment view count
  await db
    .update(kbArticles)
    .set({ viewCount: article.viewCount + 1 })
    .where(eq(kbArticles.id, article.id));

  // Get related articles (same category, excluding current)
  const relatedArticles = article.categoryId 
    ? await db.query.kbArticles.findMany({
        where: and(
          eq(kbArticles.orgId, org.id),
          eq(kbArticles.categoryId, article.categoryId),
          eq(kbArticles.status, 'published'),
          eq(kbArticles.visibility, 'public'),
        ),
        limit: 4,
        with: {
          category: true,
        },
      })
    : [];

  // Filter out current article and limit to 3
  const filteredRelated = relatedArticles
    .filter((a) => a.id !== article.id)
    .slice(0, 3);

  return (
    <div className="w-full py-0 px-0">
      <div className="px-0 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {article.category && (
            <>
              <Link href={`/s/${subdomain}/kb?category=${article.category.slug}`}>
                {article.category.name}
              </Link>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </>
          )}
          <span className="text-gray-800">{article.title}</span>
        </div>
      </div>
      <ArticleView
        article={{
          ...article,
          viewCount: article.viewCount + 1, // Optimistic update
        }}
        subdomain={subdomain}
        showBackButton={true}
        showFeedback={true}
      />

      {/* Related Articles */}
      {filteredRelated.length > 0 && (
        <div className="mt-12 pt-8 border-t px-0">
          <h2 className="text-xl font-semibold mb-4">Related Articles</h2>
          <div className="grid md:grid-cols-3 gap-0">
            {filteredRelated.map((related) => (
              <a
                key={related.id}
                href={`/s/${subdomain}/kb/${related.slug}`}
                className="block"
              >
                <h3 className="font-medium line-clamp-2">{related.title}</h3>
                {related.excerpt && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {related.excerpt}
                  </p>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
