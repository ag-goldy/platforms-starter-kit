"use server";

import { db } from "@/db";
import { ticketDependencies, tickets } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/permissions";

export async function getTicketDependenciesAction(ticketId: string) {
  // Get forward dependencies (this ticket depends on others)
  const forwardDeps = await db.query.ticketDependencies.findMany({
    where: eq(ticketDependencies.ticketId, ticketId),
    with: {
      dependsOnTicket: {
        columns: {
          id: true,
          key: true,
          subject: true,
          status: true,
        },
      },
    },
  });

  // Get reverse dependencies (other tickets depend on this one)
  const reverseDeps = await db.query.ticketDependencies.findMany({
    where: eq(ticketDependencies.dependsOnTicketId, ticketId),
    with: {
      ticket: {
        columns: {
          id: true,
          key: true,
          subject: true,
          status: true,
        },
      },
    },
  });

  return {
    blocks: forwardDeps.filter((d) => d.dependencyType === "blocks"),
    blockedBy: forwardDeps.filter((d) => d.dependencyType === "blocked_by"),
    relatesTo: forwardDeps.filter((d) => d.dependencyType === "relates_to"),
    blockedByReverse: reverseDeps.filter((d) => d.dependencyType === "blocks"),
    blocksReverse: reverseDeps.filter((d) => d.dependencyType === "blocked_by"),
    relatedReverse: reverseDeps.filter(
      (d) => d.dependencyType === "relates_to",
    ),
  };
}

export async function addDependencyAction(
  ticketId: string,
  data: {
    dependsOnTicketId: string;
    dependencyType: "blocks" | "blocked_by" | "relates_to";
  },
) {
  const user = await requireAuth();

  // Prevent self-dependency
  if (data.dependsOnTicketId === ticketId) {
    throw new Error("Cannot create dependency on self");
  }

  // Check for circular dependencies
  if (data.dependencyType === "blocks") {
    const circularCheck = await checkCircularDependency(
      ticketId,
      data.dependsOnTicketId,
    );
    if (circularCheck) {
      throw new Error("Circular dependency detected");
    }
  }

  const [dependency] = await db
    .insert(ticketDependencies)
    .values({
      ticketId,
      dependsOnTicketId: data.dependsOnTicketId,
      dependencyType: data.dependencyType,
      createdById: user.id,
    })
    .returning();

  revalidatePath(`/app/tickets/${ticketId}`);
  return dependency;
}

export async function removeDependencyAction(
  ticketId: string,
  dependencyId: string,
) {
  await requireAuth();

  await db
    .delete(ticketDependencies)
    .where(
      and(
        eq(ticketDependencies.id, dependencyId),
        eq(ticketDependencies.ticketId, ticketId),
      ),
    );

  revalidatePath(`/app/tickets/${ticketId}`);
}

export async function getAvailableTicketsForDependency(
  ticketId: string,
  orgId: string | null,
) {
  const allTickets = await db.query.tickets.findMany({
    where: orgId ? eq(tickets.orgId, orgId) : undefined,
    columns: {
      id: true,
      key: true,
      subject: true,
      status: true,
    },
  });

  // Filter out the current ticket and already linked tickets
  const existingDeps = await db.query.ticketDependencies.findMany({
    where: eq(ticketDependencies.ticketId, ticketId),
    columns: {
      dependsOnTicketId: true,
    },
  });

  const linkedIds = new Set(existingDeps.map((d) => d.dependsOnTicketId));
  linkedIds.add(ticketId);

  return allTickets.filter((t) => !linkedIds.has(t.id));
}

async function checkCircularDependency(
  sourceTicketId: string,
  targetTicketId: string,
): Promise<boolean> {
  // Check if target ticket already depends on source ticket (directly or indirectly)
  const visited = new Set<string>();

  async function hasPathTo(currentId: string): Promise<boolean> {
    if (currentId === sourceTicketId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    const deps = await db.query.ticketDependencies.findMany({
      where: eq(ticketDependencies.ticketId, currentId),
      columns: {
        dependsOnTicketId: true,
      },
    });

    for (const dep of deps) {
      if (await hasPathTo(dep.dependsOnTicketId)) {
        return true;
      }
    }

    return false;
  }

  return hasPathTo(targetTicketId);
}

export async function checkBlockedStatus(ticketId: string): Promise<boolean> {
  // Check if ticket is blocked by any unresolved dependencies
  const blockedBy = await db.query.ticketDependencies.findMany({
    where: and(
      eq(ticketDependencies.ticketId, ticketId),
      eq(ticketDependencies.dependencyType, "blocked_by"),
    ),
    with: {
      dependsOnTicket: {
        columns: {
          status: true,
        },
      },
    },
  });

  // Also check reverse blocks
  const reverseBlocks = await db.query.ticketDependencies.findMany({
    where: and(
      eq(ticketDependencies.dependsOnTicketId, ticketId),
      eq(ticketDependencies.dependencyType, "blocks"),
    ),
    with: {
      ticket: {
        columns: {
          status: true,
        },
      },
    },
  });

  const allBlocking = [
    ...blockedBy.map((d) => d.dependsOnTicket),
    ...reverseBlocks.map((d) => d.ticket),
  ];

  return allBlocking.some(
    (t) => t && !["RESOLVED", "CLOSED"].includes(t.status),
  );
}
