'use server';

import { db } from '@/db';
import { ticketTemplates } from '@/db/schema';
import { requireInternalRole } from '@/lib/auth/permissions';
import { logAudit } from '@/lib/audit/log';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  content: z.string().min(1),
  internalOnly: z.boolean().optional().default(false),
});

export async function createTemplateAction(data: {
  name: string;
  subject: string;
  content: string;
  internalOnly?: boolean;
}) {
  const user = await requireInternalRole();
  
  const validated = templateSchema.parse(data);

  const [template] = await db
    .insert(ticketTemplates)
    .values({
      name: validated.name,
      subject: validated.subject,
      content: validated.content,
      internalOnly: validated.internalOnly ?? false,
      createdById: user.id,
    })
    .returning();

  await logAudit({
    userId: user.id,
    action: 'TICKET_UPDATED',
    details: JSON.stringify({ templateId: template.id, action: 'TEMPLATE_CREATED' }),
  });

  revalidatePath('/app/templates');
  return { templateId: template.id, error: null };
}

export async function updateTemplateAction(
  templateId: string,
  data: {
    name: string;
    subject: string;
    content: string;
    internalOnly?: boolean;
  }
) {
  const user = await requireInternalRole();
  
  const validated = templateSchema.parse(data);

  await db
    .update(ticketTemplates)
    .set({
      name: validated.name,
      subject: validated.subject,
      content: validated.content,
      internalOnly: validated.internalOnly ?? false,
      updatedAt: new Date(),
    })
    .where(eq(ticketTemplates.id, templateId));

  await logAudit({
    userId: user.id,
    action: 'TICKET_UPDATED',
    details: JSON.stringify({ templateId, action: 'TEMPLATE_UPDATED' }),
  });

  revalidatePath('/app/templates');
  return { error: null };
}

export async function deleteTemplateAction(templateId: string) {
  const user = await requireInternalRole();

  await db.delete(ticketTemplates).where(eq(ticketTemplates.id, templateId));

  await logAudit({
    userId: user.id,
    action: 'TICKET_UPDATED',
    details: JSON.stringify({ templateId, action: 'TEMPLATE_DELETED' }),
  });

  revalidatePath('/app/templates');
  return { error: null };
}

export async function getTemplatesAction() {
  await requireInternalRole();
  
  return db.query.ticketTemplates.findMany({
    orderBy: (templates, { asc }) => [asc(templates.name)],
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
}

