import { requireInternalRole } from "@/lib/auth/permissions";
import { db } from "@/db";
import { kbArticles, kbCategories, users, organizations } from "@/db/schema";
import { desc, eq, asc } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Edit,
  Eye,
  FileClock,
  FolderTree,
  Globe2,
  Plus,
  Search,
  ShieldCheck,
  ThumbsUp,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils/date";
import { DeleteArticleButton } from "@/components/kb/delete-article-button";

type ArticleRow = {
  article: typeof kbArticles.$inferSelect;
  category: typeof kbCategories.$inferSelect | null;
  author: typeof users.$inferSelect | null;
  org: typeof organizations.$inferSelect | null;
};

export default async function KBAdminPage() {
  await requireInternalRole();

  const [articles, categories] = await Promise.all([
    db
      .select({
        article: kbArticles,
        category: kbCategories,
        author: users,
        org: organizations,
      })
      .from(kbArticles)
      .leftJoin(kbCategories, eq(kbArticles.categoryId, kbCategories.id))
      .leftJoin(users, eq(kbArticles.authorId, users.id))
      .leftJoin(organizations, eq(kbArticles.orgId, organizations.id))
      .orderBy(desc(kbArticles.updatedAt)),
    db
      .select({
        category: kbCategories,
        org: organizations,
      })
      .from(kbCategories)
      .leftJoin(organizations, eq(kbCategories.orgId, organizations.id))
      .orderBy(asc(kbCategories.name)),
  ]);

  const pendingArticles = articles.filter(
    (row) => row.article.status === "pending_review",
  );
  const publishedArticles = articles.filter(
    (row) => row.article.status === "published",
  );
  const draftArticles = articles.filter((row) => row.article.status === "draft");
  const archivedArticles = articles.filter(
    (row) => row.article.status === "archived",
  );
  const globalArticleCount = articles.filter((row) => !row.article.orgId).length;
  const totalViews = articles.reduce(
    (total, row) => total + Number(row.article.viewCount ?? 0),
    0,
  );
  const totalHelpful = articles.reduce(
    (total, row) => total + Number(row.article.helpfulCount ?? 0),
    0,
  );

  const reviewRows = pendingArticles.length > 0 ? pendingArticles : draftArticles;
  const mainRows = pendingArticles.length > 0
    ? publishedArticles.concat(draftArticles, archivedArticles)
    : articles;

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
              <BookOpen className="h-4 w-4" />
              Knowledge Control
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Knowledge Base
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Govern published answers, customer submissions, category coverage, and article quality across tenants.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/app/kb/categories">
                <FolderTree className="mr-2 h-4 w-4" />
                Categories
              </Link>
            </Button>
            <Button asChild>
              <Link href="/app/kb/new">
                <Plus className="mr-2 h-4 w-4" />
                New Article
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KbMetric icon={ShieldCheck} label="Published" value={publishedArticles.length} detail={`${articles.length} total articles`} />
        <KbMetric icon={FileClock} label="Review queue" value={pendingArticles.length} detail={`${draftArticles.length} drafts`} />
        <KbMetric icon={FolderTree} label="Categories" value={categories.length} detail={`${globalArticleCount} global articles`} />
        <KbMetric icon={Eye} label="Engagement" value={totalViews} detail={`${totalHelpful} helpful votes`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <ArticlePanel
            title={pendingArticles.length > 0 ? "Pending review" : "Drafts ready for review"}
            description="Customer-admin drafts and staff-authored work that needs review before publishing."
            rows={reviewRows}
            empty="No articles are waiting for review."
            actionLabel={pendingArticles.length > 0 ? "Review" : "Edit"}
          />

          <ArticlePanel
            title="Article inventory"
            description="Published, draft, and archived articles across every organization."
            rows={mainRows}
            empty="No knowledge articles yet."
            actionLabel="Edit"
            showCreateEmptyState
          />
        </div>

        <aside className="space-y-5">
          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Search className="h-4 w-4 text-slate-400" />
              Browse by category
            </div>
            {categories.length === 0 ? (
              <p className="text-sm text-slate-500">No categories found.</p>
            ) : (
              <div className="space-y-2">
                {categories.slice(0, 12).map(({ category, org }) => (
                  <Link
                    key={category.id}
                    href={`/app/kb/categories`}
                    className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-950 dark:text-white">
                        {category.name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {org?.name || "Global"}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-300" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Globe2 className="h-4 w-4 text-slate-400" />
              Publishing policy
            </div>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>Customer submissions enter the review queue as pending review.</p>
              <p>Internal agents control public, org-only, internal, and agents-only visibility.</p>
              <p>Published articles appear in customer portals and AI KB retrieval.</p>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function KbMetric({
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
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function ArticlePanel({
  title,
  description,
  rows,
  empty,
  actionLabel,
  showCreateEmptyState = false,
}: {
  title: string;
  description: string;
  rows: ArticleRow[];
  empty: string;
  actionLabel: string;
  showCreateEmptyState?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      {rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500">
          <BookOpen className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p>{empty}</p>
          {showCreateEmptyState && (
            <Button asChild variant="outline" className="mt-4">
              <Link href="/app/kb/new">
                <Plus className="mr-2 h-4 w-4" />
                Create first article
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map(({ article, category, author, org }) => (
            <div
              key={article.id}
              className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_180px]"
            >
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-semibold text-slate-950 dark:text-white">
                    {article.title}
                  </h3>
                  <StatusBadge value={article.status} />
                  <Badge variant="outline">{article.visibility}</Badge>
                </div>
                <p className="line-clamp-2 text-sm text-slate-500">
                  {article.excerpt || article.content.substring(0, 180)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    {category?.name || "Uncategorized"}
                  </span>
                  <span>{org?.name || "Global"}</span>
                  {author && <span>by {author.name || author.email}</span>}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDateTime(article.updatedAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {article.viewCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" />
                    {article.helpfulCount}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 lg:justify-end">
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={
                      org?.subdomain
                        ? `/s/${org.subdomain}/kb/${article.slug}`
                        : `/kb/${article.slug}`
                    }
                  >
                    View
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/app/kb/${article.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    {actionLabel}
                  </Link>
                </Button>
                <DeleteArticleButton
                  articleId={article.id}
                  articleTitle={article.title}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StatusBadge({ value }: { value: string }) {
  const classes: Record<string, string> = {
    draft: "border-slate-200 bg-slate-50 text-slate-700",
    published: "border-emerald-200 bg-emerald-50 text-emerald-700",
    archived: "border-red-200 bg-red-50 text-red-700",
    pending_review: "border-amber-200 bg-amber-50 text-amber-700",
  };

  return (
    <Badge variant="outline" className={classes[value] || undefined}>
      {value.replaceAll("_", " ")}
    </Badge>
  );
}
