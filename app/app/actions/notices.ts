'use server';

import { db } from '@/db';
import { notices, sites } from '@/db/schema';
import { requireInternalRole } from '@/lib/auth/permissions';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const noticeSchema = z.object({
  siteId: z.string().uuid().optional().nullable(),
  type: z.enum(['MAINTENANCE', 'INCIDENT', 'KNOWN_ISSUE']),
  severity: z.enum(['INFO', 'WARN', 'CRITICAL']),
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function getNoticesAction(orgId: string) {
  await requireInternalRole();
  return db.query.notices.findMany({
    where: eq(notices.orgId, orgId),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
    with: {
      site: true,
    },
  });
}

export async function createNoticeAction(orgId: string, data: z.input<typeof noticeSchema>) {
  const user = await requireInternalRole();
  const validated = noticeSchema.parse(data);

  if (validated.siteId) {
    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, validated.siteId), eq(sites.orgId, orgId)),
    });
    if (!site) {
      throw new Error('Site not found');
    }
  }

  const [created] = await db
    .insert(notices)
    .values({
      orgId,
      siteId: validated.siteId || null,
      type: validated.type,
      severity: validated.severity,
      title: validated.title,
      body: validated.body,
      startsAt: parseDate(validated.startsAt),
      endsAt: parseDate(validated.endsAt),
      isActive: validated.isActive ?? true,
      createdByUserId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  revalidatePath(`/app/organizations/${orgId}/notices`);
  return { notice: created };
}

export async function updateNoticeAction(
  orgId: string,
  noticeId: string,
  data: z.input<typeof noticeSchema>
) {
  await requireInternalRole();
  const validated = noticeSchema.parse(data);

  if (validated.siteId) {
    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, validated.siteId), eq(sites.orgId, orgId)),
    });
    if (!site) {
      throw new Error('Site not found');
    }
  }

  const [updated] = await db
    .update(notices)
    .set({
      siteId: validated.siteId || null,
      type: validated.type,
      severity: validated.severity,
      title: validated.title,
      body: validated.body,
      startsAt: parseDate(validated.startsAt),
      endsAt: parseDate(validated.endsAt),
      isActive: validated.isActive ?? true,
      updatedAt: new Date(),
    })
    .where(and(eq(notices.id, noticeId), eq(notices.orgId, orgId)))
    .returning();

  if (!updated) {
    throw new Error('Notice not found');
  }

  revalidatePath(`/app/organizations/${orgId}/notices`);
  return { notice: updated };
}

export async function toggleNoticeActiveAction(orgId: string, noticeId: string, isActive: boolean) {
  await requireInternalRole();
  const [updated] = await db
    .update(notices)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(notices.id, noticeId), eq(notices.orgId, orgId)))
    .returning();

  if (!updated) {
    throw new Error('Notice not found');
  }

  revalidatePath(`/app/organizations/${orgId}/notices`);
  return { notice: updated };
}
