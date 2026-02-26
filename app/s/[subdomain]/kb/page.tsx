import { notFound, redirect } from 'next/navigation';
import { db } from '@/db';
import { organizations, kbCategories } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { ArticleList } from '@/components/kb/article-list';
import type { Metadata } from 'next';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { getCustomerVisibleKBArticlesAction } from '@/app/s/[subdomain]/actions/kb';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Search, BookOpen, Plus } from 'lucide-react';

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
  const org = await getOrgBySubdomain(subdomain);
  if (!org) {
    notFound();
  }

  // Require authentication
  try {
    await requireOrgMemberRole(org.id);
  } catch {
    redirect(`/login?callbackUrl=/s/${subdomain}/kb`);
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

  // Get articles using the customer-visible action
  const articles = await getCustomerVisibleKBArticlesAction(org.id, {
    categoryId: selectedCategory?.id,
    search: searchQuery,
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
      <div className="text-center mb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-orange-500" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              {displayTitle}
            </h1>
          </div>
          <Link href={`/s/${subdomain}/kb/submit`}>
            <Button className="bg-black hover:bg-gray-800 text-white h-11 px-6 rounded-xl shadow-sm hover:shadow-md transition-all">
              <Plus className="w-4 h-4 mr-2 text-orange-500" />
              Submit Article
            </Button>
          </Link>
        </div>
        <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
          {displayDescription}
        </p>
      </div>

      <div className="max-w-2xl mx-auto mb-8">
        <form action={`/s/${subdomain}/kb`} className="relative" method="get">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            name="search"
            defaultValue={searchQuery || ''}
            placeholder="Search knowledge base..."
            className="w-full h-12 pl-12 pr-4 bg-white border border-gray-200 rounded-xl focus:border-black focus:ring-black text-base"
          />
        </form>
      </div>

      {/* Category Filter Pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          <a
            href={`/s/${subdomain}/kb`}
            className={`px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
              !categorySlug 
                ? 'bg-black text-white shadow-sm' 
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
            }`}
          >
            All Articles
          </a>
          {categories.map((category) => (
            <a
              key={category.id}
              href={`/s/${subdomain}/kb?category=${category.slug}`}
              className={`px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
                categorySlug === category.slug 
                  ? 'bg-black text-white shadow-sm' 
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
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
        showSearch={false}
        showFilters={false}
        emptyMessage={selectedCategory 
          ? `No articles found in ${selectedCategory.name}.` 
          : 'No articles available yet. Check back soon!'
        }
      />
    </div>
  );
}
