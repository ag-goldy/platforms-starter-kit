import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { organizations, kbCategories } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { ArticleList } from "@/components/kb/article-list";
import type { Metadata } from "next";
import { getOrgBySubdomain } from "@/lib/subdomains/org-lookup";
import { requireOrgMemberRole } from "@/lib/auth/permissions";
import { getCustomerVisibleKBArticlesAction } from "@/app/s/[subdomain]/actions/kb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { BookOpen, FileText, Plus, Search, ShieldCheck, Sparkles, ThumbsUp } from "lucide-react";
import { PortalKBAdminLink } from "@/components/kb/portal-kb-admin-link";

interface KBHomePageProps {
  params: Promise<{ subdomain: string }>;
  searchParams: Promise<{ category?: string; search?: string }>;
}

export async function generateMetadata({
  params,
}: KBHomePageProps): Promise<Metadata> {
  const { subdomain } = await params;
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.subdomain, subdomain),
  });

  return {
    title: `Knowledge Base - ${org?.branding?.nameOverride || org?.name || "Support"}`,
  };
}

export default async function KBHomePage({
  params,
  searchParams,
}: KBHomePageProps) {
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
    where: and(eq(kbCategories.orgId, org.id), eq(kbCategories.isPublic, true)),
    orderBy: [asc(kbCategories.sortOrder), asc(kbCategories.name)],
  });

  // Filter by category if specified
  let selectedCategory = null;
  if (categorySlug) {
    selectedCategory = await db.query.kbCategories.findFirst({
      where: and(
        eq(kbCategories.orgId, org.id),
        eq(kbCategories.slug, categorySlug),
        eq(kbCategories.isPublic, true),
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
    : "Knowledge Base";

  const displayDescription = selectedCategory?.description
    ? selectedCategory.description
    : "Find answers to common questions and learn how to use our services";

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
              <BookOpen className="h-4 w-4" />
              Knowledge
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
              {displayTitle}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {displayDescription}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PortalKBAdminLink orgId={org.id} subdomain={subdomain} />
            <Link href={`/s/${subdomain}/kb/submit`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Submit Article
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <PortalKbMetric icon={FileText} label="Articles" value={articles.length} detail="Visible to your account" />
          <PortalKbMetric icon={BookOpen} label="Categories" value={categories.length} detail="Browse by topic" />
          <PortalKbMetric icon={ThumbsUp} label="Self-service" value={articles.reduce((total, article) => total + Number(article.helpfulCount ?? 0), 0)} detail="Helpful votes" />
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <form action={`/s/${subdomain}/kb`} className="relative" method="get">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            name="search"
            defaultValue={searchQuery || ""}
            placeholder="Search knowledge base..."
            className="h-12 w-full rounded-md border border-slate-200 bg-white pl-12 pr-4 text-base focus:border-orange-500 focus:ring-orange-500"
          />
          {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
        </form>
      </section>

      {categories.length > 0 && (
        <section className="flex flex-wrap gap-2">
          <a
            href={`/s/${subdomain}/kb`}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              !categorySlug
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            All Articles
          </a>
          {categories.map((category) => (
            <a
              key={category.id}
              href={`/s/${subdomain}/kb?category=${category.slug}`}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                categorySlug === category.slug
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {category.name}
            </a>
          ))}
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <ArticleList
          subdomain={subdomain}
          initialArticles={articles}
          categories={categories}
          categorySlug={categorySlug}
          showSearch={false}
          showFilters={false}
          emptyMessage={
            selectedCategory
              ? `No articles found in ${selectedCategory.name}.`
              : "No articles available yet. Check back soon!"
          }
        />

        <aside className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              Knowledge scope
            </div>
            <div className="space-y-2 text-sm text-slate-500">
              <p>Articles shown here are approved for your organization.</p>
              <p>Internal support notes and staff-only articles are excluded.</p>
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-slate-400" />
              Need more help?
            </div>
            <p className="mb-3 text-sm text-slate-500">
              If an article does not resolve the issue, create a request and include the article title.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/s/${subdomain}/tickets/new`}>Create request</Link>
            </Button>
          </div>
          {selectedCategory && (
            <Badge variant="outline" className="w-full justify-center py-2">
              Filtered by {selectedCategory.name}
            </Badge>
          )}
        </aside>
      </section>
    </div>
  );
}

function PortalKbMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}
