'use server';

import { db } from '@/db';
import { kbArticles, kbArticleVersions, kbArticleTemplates } from '@/db/schema';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { and, eq, desc, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ============================================================================
// KB ARTICLE VERSIONING
// ============================================================================

/**
 * Create a new version of an article
 */
export async function createArticleVersionAction(
  orgId: string,
  articleId: string,
  data: {
    title: string;
    content: string;
    contentType?: string;
    categoryId?: string | null;
    excerpt?: string;
    changeSummary?: string;
  }
) {
  const { user } = await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);

  // Get the current article
  const article = await db.query.kbArticles.findFirst({
    where: and(
      eq(kbArticles.id, articleId),
      eq(kbArticles.orgId, orgId)
    ),
  });

  if (!article) {
    throw new Error('Article not found');
  }

  // Get the latest version number
  const latestVersion = await db.query.kbArticleVersions.findFirst({
    where: eq(kbArticleVersions.articleId, articleId),
    orderBy: [desc(kbArticleVersions.versionNumber)],
  });

  const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;

  // Create the new version
  const [version] = await db
    .insert(kbArticleVersions)
    .values({
      articleId,
      versionNumber: nextVersionNumber,
      title: data.title,
      content: data.content,
      contentType: data.contentType || 'markdown',
      excerpt: data.excerpt || data.content.slice(0, 200) + '...',
      categoryId: data.categoryId || null,
      changeSummary: data.changeSummary || null,
      createdById: user.id,
    })
    .returning();

  // Update the main article
  await db
    .update(kbArticles)
    .set({
      title: data.title,
      content: data.content,
      contentType: data.contentType || 'markdown',
      excerpt: data.excerpt || data.content.slice(0, 200) + '...',
      categoryId: data.categoryId || null,
      updatedAt: new Date(),
    })
    .where(eq(kbArticles.id, articleId));

  revalidatePath(`/s/[subdomain]/kb`);
  revalidatePath(`/s/[subdomain]/kb/${article.slug}`);

  return { version };
}

/**
 * Get all versions of an article
 */
export async function getArticleVersionsAction(orgId: string, articleId: string) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);

  const versions = await db.query.kbArticleVersions.findMany({
    where: eq(kbArticleVersions.articleId, articleId),
    orderBy: [desc(kbArticleVersions.versionNumber)],
    with: {
      createdBy: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return versions;
}

/**
 * Get a specific version
 */
export async function getArticleVersionAction(
  orgId: string,
  articleId: string,
  versionNumber: number
) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);

  const version = await db.query.kbArticleVersions.findFirst({
    where: and(
      eq(kbArticleVersions.articleId, articleId),
      eq(kbArticleVersions.versionNumber, versionNumber)
    ),
    with: {
      createdBy: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return version;
}

/**
 * Revert article to a specific version
 */
export async function revertToVersionAction(
  orgId: string,
  articleId: string,
  versionNumber: number
) {
  const { user } = await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);

  const version = await getArticleVersionAction(orgId, articleId, versionNumber);

  if (!version) {
    throw new Error('Version not found');
  }

  // Create a new version recording the revert
  await createArticleVersionAction(orgId, articleId, {
    title: version.title,
    content: version.content,
    contentType: version.contentType,
    categoryId: version.categoryId,
    excerpt: version.excerpt || undefined,
    changeSummary: `Reverted to version ${versionNumber}`,
  });

  revalidatePath(`/s/[subdomain]/kb`);
  revalidatePath(`/s/[subdomain]/kb/[slug]`);

  return { success: true };
}

// ============================================================================
// KB ARTICLE TEMPLATES
// ============================================================================

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  titleTemplate: z.string().optional(),
  contentTemplate: z.string().min(1),
  categoryId: z.string().uuid().optional().nullable(),
  defaultTags: z.array(z.string()).optional(),
  defaultVisibility: z.enum(['public', 'internal', 'org_only']).default('public'),
  sortOrder: z.number().default(0),
});

/**
 * Create a new article template
 */
export async function createArticleTemplateAction(
  orgId: string,
  data: z.infer<typeof templateSchema>
) {
  const { user } = await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);
  const validated = templateSchema.parse(data);

  const [template] = await db
    .insert(kbArticleTemplates)
    .values({
      orgId,
      name: validated.name,
      description: validated.description || null,
      titleTemplate: validated.titleTemplate || null,
      contentTemplate: validated.contentTemplate,
      categoryId: validated.categoryId || null,
      defaultTags: validated.defaultTags || [],
      defaultVisibility: validated.defaultVisibility,
      sortOrder: validated.sortOrder,
      createdById: user.id,
    })
    .returning();

  revalidatePath(`/s/[subdomain]/kb/templates`);
  return { template };
}

/**
 * Get all templates for an organization
 */
export async function getArticleTemplatesAction(orgId: string) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);

  const templates = await db.query.kbArticleTemplates.findMany({
    where: and(
      eq(kbArticleTemplates.orgId, orgId),
      eq(kbArticleTemplates.isActive, true)
    ),
    orderBy: [asc(kbArticleTemplates.sortOrder), asc(kbArticleTemplates.name)],
    with: {
      category: true,
      createdBy: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  return templates;
}

/**
 * Update a template
 */
export async function updateArticleTemplateAction(
  orgId: string,
  templateId: string,
  data: z.infer<typeof templateSchema>
) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);
  const validated = templateSchema.parse(data);

  const [template] = await db
    .update(kbArticleTemplates)
    .set({
      name: validated.name,
      description: validated.description || null,
      titleTemplate: validated.titleTemplate || null,
      contentTemplate: validated.contentTemplate,
      categoryId: validated.categoryId || null,
      defaultTags: validated.defaultTags || [],
      defaultVisibility: validated.defaultVisibility,
      sortOrder: validated.sortOrder,
      updatedAt: new Date(),
    })
    .where(and(
      eq(kbArticleTemplates.id, templateId),
      eq(kbArticleTemplates.orgId, orgId)
    ))
    .returning();

  if (!template) {
    throw new Error('Template not found');
  }

  revalidatePath(`/s/[subdomain]/kb/templates`);
  return { template };
}

/**
 * Delete a template (soft delete)
 */
export async function deleteArticleTemplateAction(
  orgId: string,
  templateId: string
) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);

  const [template] = await db
    .update(kbArticleTemplates)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(and(
      eq(kbArticleTemplates.id, templateId),
      eq(kbArticleTemplates.orgId, orgId)
    ))
    .returning();

  if (!template) {
    throw new Error('Template not found');
  }

  revalidatePath(`/s/[subdomain]/kb/templates`);
  return { success: true };
}

/**
 * Apply template to create a new article
 */
export async function applyTemplateAction(
  orgId: string,
  templateId: string,
  customizations?: {
    title?: string;
    categoryId?: string;
    tags?: string[];
  }
) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);

  const template = await db.query.kbArticleTemplates.findFirst({
    where: and(
      eq(kbArticleTemplates.id, templateId),
      eq(kbArticleTemplates.orgId, orgId),
      eq(kbArticleTemplates.isActive, true)
    ),
  });

  if (!template) {
    throw new Error('Template not found');
  }

  return {
    title: customizations?.title || template.titleTemplate || '',
    content: template.contentTemplate,
    categoryId: customizations?.categoryId || template.categoryId,
    tags: customizations?.tags || template.defaultTags || [],
    visibility: template.defaultVisibility,
  };
}

// ============================================================================
// KB FEEDBACK ANALYTICS
// ============================================================================

export interface KBArticleAnalytics {
  articleId: string;
  title: string;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  feedbackScore: number; // Percentage helpful
  lastUpdated: Date;
}

/**
 * Get analytics for all KB articles
 */
export async function getKBArticleAnalyticsAction(orgId: string): Promise<KBArticleAnalytics[]> {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);

  const articles = await db.query.kbArticles.findMany({
    where: eq(kbArticles.orgId, orgId),
    columns: {
      id: true,
      title: true,
      viewCount: true,
      helpfulCount: true,
      notHelpfulCount: true,
      updatedAt: true,
    },
  });

  return articles.map(article => {
    const totalFeedback = article.helpfulCount + article.notHelpfulCount;
    const feedbackScore = totalFeedback > 0
      ? Math.round((article.helpfulCount / totalFeedback) * 100)
      : 0;

    return {
      articleId: article.id,
      title: article.title,
      viewCount: article.viewCount,
      helpfulCount: article.helpfulCount,
      notHelpfulCount: article.notHelpfulCount,
      feedbackScore,
      lastUpdated: article.updatedAt,
    };
  });
}

/**
 * Get related articles based on tags and category
 */
export async function getRelatedArticlesAction(
  orgId: string,
  articleId: string,
  limit: number = 5
) {
  await requireOrgMemberRole(orgId);

  const article = await db.query.kbArticles.findFirst({
    where: and(
      eq(kbArticles.id, articleId),
      eq(kbArticles.orgId, orgId)
    ),
    columns: {
      id: true,
      categoryId: true,
      tags: true,
    },
  });

  if (!article) {
    return [];
  }

  const articleTags = (article.tags as string[]) || [];

  // Find related articles
  const relatedArticles = await db.query.kbArticles.findMany({
    where: and(
      eq(kbArticles.orgId, orgId),
      eq(kbArticles.status, 'published'),
      sql`${kbArticles.id} != ${articleId}`,
      sql`(
        ${kbArticles.categoryId} = ${article.categoryId}
        OR ${kbArticles.tags} && ${articleTags}::jsonb
      )`
    ),
    orderBy: [desc(kbArticles.helpfulCount), desc(kbArticles.viewCount)],
    limit,
    columns: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      viewCount: true,
      helpfulCount: true,
    },
  });

  return relatedArticles;
}

// Import sql for raw queries
import { sql } from 'drizzle-orm';
