'use server';

import { db } from '@/db';
import { requestTypes } from '@/db/schema';
import { requireInternalRole } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requestFormSchema, type RequestFormSchema } from '@/lib/request-types/validation';
import { slugify } from '@/lib/utils/slug';

const requestTypeSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().optional(),
  description: z.string().optional().nullable(),
  category: z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE_REQUEST']),
  defaultPriority: z.enum(['P1', 'P2', 'P3', 'P4']),
  isActive: z.boolean().default(true),
  requiredAttachments: z.boolean().default(false),
  formSchema: z.unknown().optional(),
});

function parseFormSchema(raw: unknown): RequestFormSchema {
  if (raw === null || raw === undefined || raw === '') {
    return requestFormSchema.parse({ fields: [] });
  }

  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return requestFormSchema.parse(parsed);
}

export async function getRequestTypesAction(orgId: string, includeInactive = true) {
  await requireInternalRole();
  return db.query.requestTypes.findMany({
    where: includeInactive
      ? eq(requestTypes.orgId, orgId)
      : and(eq(requestTypes.orgId, orgId), eq(requestTypes.isActive, true)),
    orderBy: (table, { asc }) => [asc(table.name)],
  });
}

export async function createRequestTypeAction(
  orgId: string,
  data: z.input<typeof requestTypeSchema>
) {
  const user = await requireInternalRole();
  const validated = requestTypeSchema.parse(data);
  const formSchema = parseFormSchema(validated.formSchema);
  const slug = slugify(validated.slug || validated.name);

  if (!slug) {
    throw new Error('Slug is required');
  }

  const [created] = await db
    .insert(requestTypes)
    .values({
      orgId,
      name: validated.name,
      slug,
      description: validated.description || null,
      category: validated.category,
      defaultPriority: validated.defaultPriority,
      isActive: validated.isActive ?? true,
      requiredAttachments: validated.requiredAttachments ?? false,
      formSchema,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  revalidatePath(`/app/organizations/${orgId}`);
  revalidatePath(`/app/organizations/${orgId}/request-types`);

  return { requestType: created, createdBy: user.id };
}

export async function updateRequestTypeAction(
  orgId: string,
  requestTypeId: string,
  data: z.input<typeof requestTypeSchema>
) {
  await requireInternalRole();
  const validated = requestTypeSchema.parse(data);
  const formSchema = parseFormSchema(validated.formSchema);
  const slug = slugify(validated.slug || validated.name);

  if (!slug) {
    throw new Error('Slug is required');
  }

  const [updated] = await db
    .update(requestTypes)
    .set({
      name: validated.name,
      slug,
      description: validated.description || null,
      category: validated.category,
      defaultPriority: validated.defaultPriority,
      isActive: validated.isActive ?? true,
      requiredAttachments: validated.requiredAttachments ?? false,
      formSchema,
      updatedAt: new Date(),
    })
    .where(and(eq(requestTypes.id, requestTypeId), eq(requestTypes.orgId, orgId)))
    .returning();

  if (!updated) {
    throw new Error('Request type not found');
  }

  revalidatePath(`/app/organizations/${orgId}`);
  revalidatePath(`/app/organizations/${orgId}/request-types`);

  return { requestType: updated };
}

export async function toggleRequestTypeActiveAction(
  orgId: string,
  requestTypeId: string,
  isActive: boolean
) {
  await requireInternalRole();

  const [updated] = await db
    .update(requestTypes)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(requestTypes.id, requestTypeId), eq(requestTypes.orgId, orgId)))
    .returning();

  if (!updated) {
    throw new Error('Request type not found');
  }

  revalidatePath(`/app/organizations/${orgId}`);
  revalidatePath(`/app/organizations/${orgId}/request-types`);

  return { requestType: updated };
}
