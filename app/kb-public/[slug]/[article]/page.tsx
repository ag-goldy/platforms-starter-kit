import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Calendar, ChevronRight, Eye, FolderOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { kbArticles, organizations } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface PublicKbArticlePageProps {
  params: Promise<{ slug: string; article: string }>;
}

async function getPublicArticle(orgSlug: string, articleSlug: string) {
  const org = await db.query.organizations.findFirst({
    where: or(
      eq(organizations.slug, orgSlug),
      eq(organizations.subdomain, orgSlug),
    ),
  });

  if (!org || !org.isActive || org.deletedAt) {
    return null;
  }

  if (org.features?.knowledge === false) {
    return null;
  }

  const article = await db.query.kbArticles.findFirst({
    where: and(
      eq(kbArticles.orgId, org.id),
      eq(kbArticles.slug, articleSlug),
      eq(kbArticles.status, "published"),
      eq(kbArticles.visibility, "public"),
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

  if (!article) {
    return null;
  }

  return { org, article };
}

export async function generateMetadata({
  params,
}: PublicKbArticlePageProps): Promise<Metadata> {
  const { slug, article: articleSlug } = await params;
  const result = await getPublicArticle(slug, articleSlug);

  if (!result) {
    return { title: "Article not found" };
  }

  const orgName = result.org.branding?.nameOverride || result.org.name;
  return {
    title: `${result.article.title} - ${orgName}`,
    description: result.article.excerpt || undefined,
  };
}

export default async function PublicKbArticlePage({
  params,
}: PublicKbArticlePageProps) {
  const { slug, article: articleSlug } = await params;
  const result = await getPublicArticle(slug, articleSlug);

  if (!result) {
    notFound();
  }

  const { org, article } = result;

  await db
    .update(kbArticles)
    .set({ viewCount: article.viewCount + 1 })
    .where(eq(kbArticles.id, article.id));

  const relatedArticles = article.categoryId
    ? await db.query.kbArticles.findMany({
        where: and(
          eq(kbArticles.orgId, org.id),
          eq(kbArticles.categoryId, article.categoryId),
          eq(kbArticles.status, "published"),
          eq(kbArticles.visibility, "public"),
        ),
        orderBy: (table, { desc }) => [desc(table.updatedAt)],
        limit: 4,
        with: {
          category: true,
        },
      })
    : [];

  const orgName = org.branding?.nameOverride || org.name;
  const publishedAt = article.publishedAt || article.createdAt;

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <nav className="mb-8 flex items-center gap-2 text-sm text-gray-600">
          <Link href="/" className="hover:text-gray-950">
            {orgName}
          </Link>
          <ChevronRight className="h-4 w-4 text-gray-400" />
          <span>Knowledge Base</span>
          {article.category && (
            <>
              <ChevronRight className="h-4 w-4 text-gray-400" />
              <span>{article.category.name}</span>
            </>
          )}
        </nav>

        {article.category && (
          <Badge variant="outline" className="mb-4">
            <FolderOpen className="mr-1 h-3 w-3" />
            {article.category.name}
          </Badge>
        )}

        <h1 className="text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">
          {article.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {new Date(publishedAt).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {article.viewCount + 1} views
          </span>
        </div>

        <Separator className="my-8" />

        {article.excerpt && (
          <p className="mb-8 text-lg leading-8 text-gray-600">
            {article.excerpt}
          </p>
        )}

        <article className="prose prose-slate max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {article.content}
          </ReactMarkdown>
        </article>

        {relatedArticles.filter((related) => related.id !== article.id).length >
          0 && (
          <>
            <Separator className="my-10" />
            <section>
              <h2 className="mb-4 text-lg font-semibold text-gray-950">
                Related articles
              </h2>
              <div className="grid gap-3">
                {relatedArticles
                  .filter((related) => related.id !== article.id)
                  .slice(0, 3)
                  .map((related) => (
                    <Link
                      key={related.id}
                      href={`/kb-public/${slug}/${related.slug}`}
                      className="rounded-md border border-gray-200 p-4 hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-950">
                        {related.title}
                      </div>
                      {related.excerpt && (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                          {related.excerpt}
                        </p>
                      )}
                    </Link>
                  ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
