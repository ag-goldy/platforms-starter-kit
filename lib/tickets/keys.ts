import { db } from '@/db';
import { tickets } from '@/db/schema';
import { like, desc } from 'drizzle-orm';

/**
 * Generate a unique ticket key in format: AGRN[YYMMDD]-[RANDOM]
 * Examples: AGRN250209-3847, AGRN250315-8734
 * 
 * Features:
 * - AGRN prefix for AGR Networks branding
 * - Full date (YYMMDD) for easy identification
 * - 4-digit random number (0000-9999) unique per day
 * - Collision detection to ensure no duplicates on same date
 */
export async function generateTicketKey(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 01-12
  const day = now.getDate().toString().padStart(2, '0'); // 01-31
  const datePrefix = `AGRN${year}${month}${day}`;

  // Get all existing keys for today to check for collisions
  const existingKeys = await db
    .select({ key: tickets.key })
    .from(tickets)
    .where(like(tickets.key, `${datePrefix}-%`))
    .orderBy(desc(tickets.key));

  const usedNumbers = new Set(
    existingKeys
      .map(t => {
        const match = t.key.match(/-(\d{4})$/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((n): n is number => n !== null)
  );

  // Generate a unique random 4-digit number
  let randomNum: number;
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loop

  do {
    randomNum = Math.floor(Math.random() * 10000); // 0-9999
    attempts++;
  } while (usedNumbers.has(randomNum) && attempts < maxAttempts);

  // If we've exhausted random attempts, find next available number
  if (attempts >= maxAttempts) {
    for (let i = 0; i < 10000; i++) {
      if (!usedNumbers.has(i)) {
        randomNum = i;
        break;
      }
    }
  }

  // Format as 4-digit number with leading zeros
  const random = randomNum.toString().padStart(4, '0');
  return `${datePrefix}-${random}`;
}
