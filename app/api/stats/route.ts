import { NextResponse } from 'next/server';
import { db } from '@/db';
import { kbArticles, tickets } from '@/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get article count (published articles only)
    const articleResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(kbArticles)
      .where(sql`${kbArticles.status} = 'published'`);
    
    const articleCount = articleResult[0]?.count || 0;

    // Get ticket count and average response time
    const ticketStats = await db
      .select({
        count: sql<number>`count(*)::int`,
        avgResponseMinutes: sql<number | null>`
          CASE 
            WHEN count(*) = 0 THEN NULL
            ELSE ROUND(AVG(EXTRACT(EPOCH FROM (${tickets.firstResponseAt} - ${tickets.createdAt})) / 60))::int
          END
        `,
      })
      .from(tickets)
      .where(sql`${tickets.firstResponseAt} IS NOT NULL`);

    const ticketCount = ticketStats[0]?.count || 0;
    const avgResponseMinutes = ticketStats[0]?.avgResponseMinutes;

    // Determine if we should show live data or static "2h"
    // If less than 300 tickets, show static 2h
    // If 300+ tickets, show live average
    const SHOW_LIVE_THRESHOLD = 300;
    const isLive = ticketCount >= SHOW_LIVE_THRESHOLD;

    let responseTimeDisplay: string;
    let responseTimeMinutes: number | null;

    if (!isLive) {
      // Static 2 hours for now
      responseTimeDisplay = '2hr';
      responseTimeMinutes = 120;
    } else {
      // Live data
      const minutes = avgResponseMinutes || 120;
      responseTimeMinutes = minutes;
      
      if (minutes < 60) {
        responseTimeDisplay = `${Math.round(minutes)}m`;
      } else {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        if (mins === 0) {
          responseTimeDisplay = `${hours}hr`;
        } else {
          responseTimeDisplay = `${hours}h ${mins}m`;
        }
      }
    }

    return NextResponse.json({
      articleCount,
      ticketCount,
      avgResponseMinutes: responseTimeMinutes,
      responseTimeDisplay,
      isLive,
      threshold: SHOW_LIVE_THRESHOLD,
    });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    // Return fallback data on error
    return NextResponse.json({
      articleCount: 500,
      ticketCount: 0,
      avgResponseMinutes: 120,
      responseTimeDisplay: '2hr',
      isLive: false,
      threshold: 300,
      error: 'Failed to fetch live stats',
    }, { status: 500 });
  }
}
