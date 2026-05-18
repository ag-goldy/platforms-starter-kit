import { db } from "@/db";
import { tickets, ticketEvents } from "@/db/schema";

import { eq } from "drizzle-orm";

export async function executeEscalationActions(
  ticketId: string,
  orgId: string,
  actionsJson: Record<string, any>,
) {
  // actionsJson might look like:
  // { notify: ['assignee', 'team_lead'], raise_priority: 'p1', add_tag: 'escalated' }

  if (actionsJson.raise_priority) {
    await db
      .update(tickets)
      .set({ priority: actionsJson.raise_priority })
      .where(eq(tickets.id, ticketId));

    await db.insert(ticketEvents).values({
      orgId,
      ticketId,
      actorKind: "system",
      eventType: "priority_changed",
      payloadJson: {
        priority: actionsJson.raise_priority,
        reason: "escalation",
      },
    });
  }

  // Handle other actions like 'notify', 'reassign', 'add_tag' here.
}
