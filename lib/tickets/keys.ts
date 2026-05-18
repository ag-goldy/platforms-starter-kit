import { db } from '@/db';
import { organizations, tickets } from '@/db/schema';
import { eq, like } from 'drizzle-orm';

/**
 * Normalize customer IDs for use in ticket keys.
 * Example ticket key: CUSTOMERID(INC)123456
 */
export function normalizeCustomerId(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function resolveTicketPrefix(orgId?: string | null): Promise<string> {
  if (!orgId) {
    return 'PUBLIC';
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: {
      customerId: true,
      slug: true,
    },
  });

  const normalizedCustomerId = org?.customerId ? normalizeCustomerId(org.customerId) : '';
  if (normalizedCustomerId) {
    return normalizedCustomerId;
  }

  const normalizedSlug = org?.slug ? normalizeCustomerId(org.slug) : '';
  return normalizedSlug || 'ORG';
}

/**
 * Generate a unique ticket key in format: CUSTOMERID(INC)RANDOM6.
 * Examples: ACME(INC)104382, PUBLIC(INC)849201
 *
 * Features:
 * - customer ID prefix when the ticket belongs to an organization
 * - PUBLIC prefix for public/no-organization intake
 * - six-digit random number
 * - collision detection on the full key and numeric suffix
 */
export async function generateTicketKey(orgId?: string | null): Promise<string> {
  const prefix = await resolveTicketPrefix(orgId);
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const random = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
    const key = `${prefix}(INC)${random}`;

    const existing = await db.query.tickets.findFirst({
      where: like(tickets.key, `%${random}`),
      columns: { id: true, key: true },
    });

    if (!existing) {
      return key;
    }
  }

  throw new Error('Unable to generate a unique ticket key');
}
