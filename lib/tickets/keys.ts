import { db } from '@/db';
import { tickets } from '@/db/schema';
import { like, desc } from 'drizzle-orm';

export async function generateTicketKey(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `AGR-${currentYear}-`;

  // Find the highest sequence number for this year
  const latestTicket = await db
    .select()
    .from(tickets)
    .where(like(tickets.key, `${prefix}%`))
    .orderBy(desc(tickets.key))
    .limit(1);

  let nextSequence = 1;

  if (latestTicket.length > 0) {
    const latestKey = latestTicket[0].key;
    const sequenceMatch = latestKey.match(/\d+$/);
    if (sequenceMatch) {
      nextSequence = parseInt(sequenceMatch[0], 10) + 1;
    }
  }

  // Format as 6-digit sequence with leading zeros
  const sequence = nextSequence.toString().padStart(6, '0');
  return `${prefix}${sequence}`;
}
