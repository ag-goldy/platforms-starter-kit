import { notFound } from 'next/navigation';
import { db } from '@/db';
import { organizations, kbCategories, kbArticles } from '@/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { ArticleList } from '@/components/kb/article-list';
import type { Metadata } from 'next';

interface KBHomePageProps {
  params: Promise<{ subdomain: string }>;
  searchParams: Promise<{ category?: string; search?: string }>;
}

export async function generateMetadata({ params }: KBHomePageProps): Promise<Metadata> {
  const { subdomain } = await params;
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.subdomain, subdomain),
  });

  return {
    title: `Knowledge Base - ${org?.branding?.nameOverride || org?.name || 'Support'}`,
  };
}

export default async function KBHomePage({ params, searchParams }: KBHomePageProps) {
  const { subdomain } = await params;
  const { category: categorySlug, search: searchQuery } = await searchParams;

  // Get organization
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.subdomain, subdomain),
  });

  if (!org) {
    notFound();
  }

  // Check if knowledge base is enabled
  if (org.features?.knowledge === false) {
    notFound();
  }

  // Get categories
  const categories = await db.query.kbCategories.findMany({
    where: and(
      eq(kbCategories.orgId, org.id),
      eq(kbCategories.isPublic, true)
    ),
    orderBy: [asc(kbCategories.sortOrder), asc(kbCategories.name)],
  });

  // Filter by category if specified
  let selectedCategory = null;
  if (categorySlug) {
    selectedCategory = await db.query.kbCategories.findFirst({
      where: and(
        eq(kbCategories.orgId, org.id),
        eq(kbCategories.slug, categorySlug),
        eq(kbCategories.isPublic, true)
      ),
    });
  }

  // Get articles with relations
  const articles = await db.query.kbArticles.findMany({
    where: and(
      eq(kbArticles.orgId, org.id),
      eq(kbArticles.status, 'published'),
      eq(kbArticles.visibility, 'public'),
      selectedCategory ? eq(kbArticles.categoryId, selectedCategory.id) : undefined
    ),
    orderBy: [desc(kbArticles.createdAt)],
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

  const displayTitle = selectedCategory 
    ? `${selectedCategory.name}` 
    : 'Knowledge Base';
  
  const displayDescription = selectedCategory?.description 
    ? selectedCategory.description 
    : 'Find answers to common questions and learn how to use our services';

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-3">{displayTitle}</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          {displayDescription}
        </p>
      </div>

      {/* Category Filter Pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <a
            href={`/s/${subdomain}/kb`}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !categorySlug 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            All Articles
          </a>
          {categories.map((category) => (
            <a
              key={category.id}
              href={`/s/${subdomain}/kb?category=${category.slug}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                categorySlug === category.slug 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {category.name}
            </a>
          ))}
        </div>
      )}

      {/* Article List */}
      <ArticleList
        subdomain={subdomain}
        initialArticles={articles}
        categories={categories}
        categorySlug={categorySlug}
        showSearch={true}
        showFilters={false}
        emptyMessage={selectedCategory 
          ? `No articles found in ${selectedCategory.name}.` 
          : 'No articles available yet. Check back soon!'
        }
      />
    </div>
  );
}
