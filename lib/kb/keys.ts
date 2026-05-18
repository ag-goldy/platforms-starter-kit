import { db } from '@/db';
import { kbArticles } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Generate a unique KB article ID in format: KB123456.
 */
export async function generateKbKey(): Promise<string> {
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const random = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
    const key = `KB${random}`;

    const existing = await db.query.kbArticles.findFirst({
      where: eq(kbArticles.slug, key),
      columns: { id: true },
    });

    if (!existing) {
      return key;
    }
  }

  throw new Error('Unable to generate a unique KB key');
}
