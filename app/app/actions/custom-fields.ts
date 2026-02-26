'use server';

import { db } from '@/db';
import { customFields, customFieldValues } from '@/db/schema';
import { requireInternalRole } from '@/lib/auth/permissions';
import { and, eq, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const optionSchema = z.object({
  label: z.string(),
  value: z.string(),
  color: z.string().optional(),
});

const customFieldSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, {
    message: 'Name must be lowercase with underscores only',
  }),
  label: z.string().min(1).max(100),
  description: z.string().optional(),
  entityType: z.enum(['ticket', 'asset', 'user', 'organization']),
  fieldType: z.enum(['text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'url', 'email']),
  options: z.array(optionSchema).optional(),
  isRequired: z.boolean().default(false),
  validationRegex: z.string().optional(),
  validationMessage: z.string().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
});

export type CustomFieldInput = z.infer<typeof customFieldSchema>;

export async function getCustomFields(orgId: string, entityType?: string) {
  await requireInternalRole();

  const conditions = [
    eq(customFields.orgId, orgId),
    eq(customFields.isActive, true),
  ];

  if (entityType) {
    conditions.push(eq(customFields.entityType, entityType));
  }

  const fields = await db.query.customFields.findMany({
    where: and(...conditions),
    orderBy: [asc(customFields.sortOrder), asc(customFields.label)],
  });

  return fields;
}

export async function createCustomField(orgId: string, data: CustomFieldInput) {
  await requireInternalRole();
  const validated = customFieldSchema.parse(data);

  const [field] = await db
    .insert(customFields)
    .values({
      orgId,
      ...validated,
    })
    .returning();

  revalidatePath(`/app/organizations/${orgId}/settings/custom-fields`);
  return { field };
}

export async function updateCustomField(
  orgId: string,
  fieldId: string,
  data: CustomFieldInput
) {
  await requireInternalRole();
  const validated = customFieldSchema.parse(data);

  const [field] = await db
    .update(customFields)
    .set({
      ...validated,
      updatedAt: new Date(),
    })
    .where(and(
      eq(customFields.id, fieldId),
      eq(customFields.orgId, orgId)
    ))
    .returning();

  if (!field) {
    throw new Error('Field not found');
  }

  revalidatePath(`/app/organizations/${orgId}/settings/custom-fields`);
  return { field };
}

export async function deleteCustomField(orgId: string, fieldId: string) {
  await requireInternalRole();

  const [field] = await db
    .update(customFields)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(and(
      eq(customFields.id, fieldId),
      eq(customFields.orgId, orgId)
    ))
    .returning();

  if (!field) {
    throw new Error('Field not found');
  }

  revalidatePath(`/app/organizations/${orgId}/settings/custom-fields`);
  return { success: true };
}

export async function getCustomFieldValues(entityType: string, entityId: string) {
  const values = await db.query.customFieldValues.findMany({
    where: and(
      eq(customFieldValues.entityType, entityType),
      eq(customFieldValues.entityId, entityId)
    ),
    with: {
      field: true,
    },
  });

  return values;
}

export async function setCustomFieldValue(
  fieldId: string,
  entityType: string,
  entityId: string,
  value: string
) {
  const existing = await db.query.customFieldValues.findFirst({
    where: and(
      eq(customFieldValues.fieldId, fieldId),
      eq(customFieldValues.entityId, entityId)
    ),
  });

  if (existing) {
    await db
      .update(customFieldValues)
      .set({ value, updatedAt: new Date() })
      .where(eq(customFieldValues.id, existing.id));
  } else {
    await db.insert(customFieldValues).values({
      fieldId,
      entityType,
      entityId,
      value,
    });
  }
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  select: 'Single Select',
  multi_select: 'Multi Select',
  checkbox: 'Checkbox',
  url: 'URL',
  email: 'Email',
};

export function getFieldTypeLabel(type: string): string {
  return FIELD_TYPE_LABELS[type] || type;
}
