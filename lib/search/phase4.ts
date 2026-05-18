import { db } from '@/db';
import { assets, kbArticles } from '@/db/schema';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { withOrgScope } from '@/lib/db/with-org-scope';

export type Phase4SearchResult =
  | {
      type: 'kb_article';
      id: string;
      title: string;
      excerpt: string | null;
      href: string;
      updatedAt: Date;
    }
  | {
      type: 'asset';
      id: string;
      title: string;
      excerpt: string | null;
      href: string;
      updatedAt: Date;
    };

export async function searchKnowledgeAndAssets(
  orgId: string,
  query: string,
  options?: {
    subdomain?: string | null;
    limit?: number;
    includeInternalKb?: boolean;
    includeArchivedAssets?: boolean;
  }
): Promise<Phase4SearchResult[]> {
  const term = query.trim();
  if (!term) return [];

  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50);
  const pattern = `%${term}%`;
  const subdomain = options?.subdomain ?? '';

  return withOrgScope(orgId, async (scopedOrgId) => {
    const [articleRows, assetRows] = await Promise.all([
      db.query.kbArticles.findMany({
        where: and(
          eq(kbArticles.orgId, scopedOrgId),
          eq(kbArticles.status, 'published'),
          options?.includeInternalKb ? undefined : eq(kbArticles.visibility, 'public'),
          or(
            ilike(kbArticles.title, pattern),
            ilike(kbArticles.excerpt, pattern),
            ilike(kbArticles.content, pattern)
          )
        ),
        orderBy: [desc(kbArticles.updatedAt)],
        limit,
      }),
      db.query.assets.findMany({
        where: and(
          eq(assets.orgId, scopedOrgId),
          options?.includeArchivedAssets ? undefined : eq(assets.archived, false),
          or(
            ilike(assets.name, pattern),
            ilike(assets.hostname, pattern),
            ilike(assets.serialNumber, pattern),
            ilike(assets.model, pattern),
            ilike(assets.vendor, pattern),
            ilike(assets.ipAddress, pattern)
          )
        ),
        orderBy: (table, { desc }) => [desc(table.updatedAt)],
        limit,
      }),
    ]);

    const articleResults: Phase4SearchResult[] = articleRows.map((article) => ({
      type: 'kb_article',
      id: article.id,
      title: article.title,
      excerpt: article.excerpt,
      href: subdomain ? `/s/${subdomain}/kb/${article.slug}` : `/kb-public/${scopedOrgId}/${article.slug}`,
      updatedAt: article.updatedAt,
    }));

    const assetResults: Phase4SearchResult[] = assetRows.map((asset) => ({
      type: 'asset',
      id: asset.id,
      title: asset.name,
      excerpt: [asset.hostname, asset.ipAddress, asset.serialNumber, asset.model]
        .filter(Boolean)
        .join(' | ') || null,
      href: subdomain ? `/s/${subdomain}?view=assets&asset=${asset.id}` : `/app/organizations/${scopedOrgId}/assets/${asset.id}`,
      updatedAt: asset.updatedAt,
    }));

    return [...articleResults, ...assetResults]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  });
}
