import { db } from '@/db';
import { ticketTemplates } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function getTicketTemplates() {
  const templates = await db.query.ticketTemplates.findMany({
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
  
  // Ensure createdBy is not an array (Drizzle relation fix)
  return templates.map(template => ({
    ...template,
    createdBy: Array.isArray(template.createdBy) 
      ? template.createdBy[0] || null 
      : template.createdBy,
  }));
}

export async function getTicketTemplateById(templateId: string) {
  return db.query.ticketTemplates.findFirst({
    where: eq(ticketTemplates.id, templateId),
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

