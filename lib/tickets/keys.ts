import { db } from "@/db";
import { organizations, tickets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolvePrefix } from "@/lib/tickets/prefix";

/**
 * Normalize customer IDs for use in ticket keys.
 * Example ticket key: AGRN-925180
 */
export function normalizeCustomerId(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

async function resolveTicketPrefix(orgId?: string | null): Promise<string> {
  if (!orgId) {
    return "SUP";
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: {
      id: true,
      slug: true,
      ticketPrefix: true,
    },
  });

  if (!org) {
    throw new Error(`Organization ${orgId} not found`);
  }

  return resolvePrefix(org);
}

/**
 * Generate a unique ticket key in format: PREFIX-NNNNNN.
 * Examples: ACME-104382, SUP-849201
 *
 * Features:
 * - organization ticket prefix when the ticket belongs to an organization
 * - SUP prefix for public/no-organization intake
 * - six-digit random number from 100000 to 999999
 * - exact-key collision retry before the ticket insert's unique constraint
 *
 * Note: this is still a pre-insert key generator. The database unique
 * constraint remains the final guard, so callers that insert tickets should
 * eventually retry the INSERT itself on Postgres 23505 to close the concurrent
 * collision race window.
 */
export async function generateTicketKey(
  orgId?: string | null,
): Promise<string> {
  const prefix = await resolveTicketPrefix(orgId);
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const random = Math.floor(Math.random() * 900_000) + 100_000;
    const key = `${prefix}-${random}`;

    const existing = await db.query.tickets.findFirst({
      where: eq(tickets.key, key),
      columns: { id: true, key: true },
    });

    if (!existing) {
      return key;
    }
  }

  throw new Error("Unable to generate a unique ticket key");
}
