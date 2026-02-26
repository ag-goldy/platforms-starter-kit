'use server';

import { db } from '@/db';
import { kbArticles, kbCategories, organizations, users } from '@/db/schema';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { and, eq, desc, asc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// Simple slugify function
function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')         // Split accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-');  // Replace multiple - with single -
}

// Schema for customer KB article submission
const submitKBArticleSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10),
  categoryId: z.string().uuid().optional().nullable(),
  visibility: z.enum(['public', 'org_only']).default('org_only'),
  isAnonymous: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
});

// Generate a unique slug
async function generateUniqueSlug(title: string, orgId?: string): Promise<string> {
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let counter = 1;
  
  while (true) {
    const existing = await db.query.kbArticles.findFirst({
      where: and(
        eq(kbArticles.slug, slug),
        orgId ? eq(kbArticles.orgId, orgId) : undefined
      ),
    });
    
    if (!existing) {
      return slug;
    }
    
    slug = `${baseSlug}-${counter}`;
    counter++;
    
    if (counter > 100) {
      // Fallback to random suffix
      slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;
      return slug;
    }
  }
}

/**
 * Submit a new KB article (customer)
 * Articles go to pending_review status and need admin approval
 */
export async function submitCustomerKBArticleAction(
  orgId: string,
  data: z.input<typeof submitKBArticleSchema>
) {
  const { user } = await requireOrgMemberRole(orgId);
  const validated = submitKBArticleSchema.parse(data);

  const slug = await generateUniqueSlug(validated.title, orgId);

  const [article] = await db
    .insert(kbArticles)
    .values({
      orgId,
      categoryId: validated.categoryId || null,
      title: validated.title,
      slug,
      content: validated.content,
      excerpt: validated.content.slice(0, 200) + (validated.content.length > 200 ? '...' : ''),
      status: 'pending_review', // Needs admin approval
      visibility: validated.visibility,
      authorId: user.id,
      isAnonymous: validated.isAnonymous,
      submittedById: validated.isAnonymous ? user.id : null,
      tags: validated.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  revalidatePath(`/s/[subdomain]/kb`);
  return { article };
}

/**
 * Get customer's own KB articles
 */
export async function getCustomerKBArticlesAction(orgId: string) {
  const { user } = await requireOrgMemberRole(orgId);

  const articles = await db.query.kbArticles.findMany({
    where: and(
      eq(kbArticles.orgId, orgId),
      eq(kbArticles.authorId, user.id)
    ),
    orderBy: [desc(kbArticles.createdAt)],
    with: {
      category: true,
    },
  });

  return articles;
}

/**
 * Update customer's pending KB article
 */
export async function updateCustomerKBArticleAction(
  orgId: string,
  articleId: string,
  data: z.input<typeof submitKBArticleSchema>
) {
  const { user } = await requireOrgMemberRole(orgId);
  const validated = submitKBArticleSchema.parse(data);

  // Only allow updates if article is still pending review and owned by user
  const existing = await db.query.kbArticles.findFirst({
    where: and(
      eq(kbArticles.id, articleId),
      eq(kbArticles.orgId, orgId),
      eq(kbArticles.authorId, user.id),
      eq(kbArticles.status, 'pending_review')
    ),
  });

  if (!existing) {
    throw new Error('Article not found or cannot be edited');
  }

  const [updated] = await db
    .update(kbArticles)
    .set({
      title: validated.title,
      content: validated.content,
      excerpt: validated.content.slice(0, 200) + (validated.content.length > 200 ? '...' : ''),
      categoryId: validated.categoryId || null,
      visibility: validated.visibility,
      isAnonymous: validated.isAnonymous,
      tags: validated.tags || [],
      updatedAt: new Date(),
    })
    .where(eq(kbArticles.id, articleId))
    .returning();

  revalidatePath(`/s/[subdomain]/kb`);
  return { article: updated };
}

/**
 * Delete customer's pending KB article
 */
export async function deleteCustomerKBArticleAction(orgId: string, articleId: string) {
  const { user } = await requireOrgMemberRole(orgId);

  const existing = await db.query.kbArticles.findFirst({
    where: and(
      eq(kbArticles.id, articleId),
      eq(kbArticles.orgId, orgId),
      eq(kbArticles.authorId, user.id),
      eq(kbArticles.status, 'pending_review')
    ),
  });

  if (!existing) {
    throw new Error('Article not found or cannot be deleted');
  }

  await db.delete(kbArticles).where(eq(kbArticles.id, articleId));

  revalidatePath(`/s/[subdomain]/kb`);
  return { success: true };
}

/**
 * Admin: Approve a customer-submitted KB article
 */
export async function approveKBArticleAction(
  orgId: string,
  articleId: string,
  publishOptions?: {
    categoryId?: string | null;
    visibility?: 'public' | 'internal' | 'org_only';
  }
) {
  const { user } = await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);

  const [updated] = await db
    .update(kbArticles)
    .set({
      status: 'published',
      categoryId: publishOptions?.categoryId ?? undefined,
      visibility: publishOptions?.visibility ?? 'org_only',
      approvedById: user.id,
      approvedAt: new Date(),
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(
      eq(kbArticles.id, articleId),
      eq(kbArticles.orgId, orgId),
      eq(kbArticles.status, 'pending_review')
    ))
    .returning();

  if (!updated) {
    throw new Error('Article not found or not in pending review status');
  }

  revalidatePath(`/s/[subdomain]/kb`);
  return { article: updated };
}

/**
 * Admin: Reject a customer-submitted KB article
 */
export async function rejectKBArticleAction(
  orgId: string,
  articleId: string,
  reason: string
) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);

  const [updated] = await db
    .update(kbArticles)
    .set({
      status: 'archived',
      rejectionReason: reason,
      updatedAt: new Date(),
    })
    .where(and(
      eq(kbArticles.id, articleId),
      eq(kbArticles.orgId, orgId),
      eq(kbArticles.status, 'pending_review')
    ))
    .returning();

  if (!updated) {
    throw new Error('Article not found or not in pending review status');
  }

  revalidatePath(`/s/[subdomain]/kb`);
  return { article: updated };
}

/**
 * Admin: Get pending KB articles for review
 */
export async function getPendingKBArticlesAction(orgId: string) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);

  const articles = await db.query.kbArticles.findMany({
    where: and(
      eq(kbArticles.orgId, orgId),
      eq(kbArticles.status, 'pending_review')
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

  return articles;
}

/**
 * Get public/org KB articles for customer portal
 * Includes both published articles and customer's own pending articles
 */
export async function getCustomerVisibleKBArticlesAction(
  orgId: string,
  options?: {
    categoryId?: string;
    search?: string;
  }
) {
  const { user } = await requireOrgMemberRole(orgId);

  const conditions = [
    eq(kbArticles.orgId, orgId),
    sql`(
      ${kbArticles.status} = 'published' 
      AND (
        ${kbArticles.visibility} = 'public' 
        OR ${kbArticles.visibility} = 'org_only'
      )
    ) OR (
      ${kbArticles.authorId} = ${user.id}
    )`,
  ];

  if (options?.categoryId) {
    conditions.push(eq(kbArticles.categoryId, options.categoryId));
  }

  if (options?.search) {
    conditions.push(
      sql`(
        ${kbArticles.title} ILIKE ${`%${options.search}%`}
        OR ${kbArticles.content} ILIKE ${`%${options.search}%`}
        OR ${kbArticles.tags} @> ${JSON.stringify([options.search])}::jsonb
      )`
    );
  }

  const articles = await db.query.kbArticles.findMany({
    where: and(...conditions),
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

  // Anonymize articles if needed
  return articles.map(article => ({
    ...article,
    author: article.isAnonymous && article.status === 'published' && article.visibility === 'public'
      ? { id: '', name: 'Anonymous', email: '' }
      : article.author,
  }));
}
