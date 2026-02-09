import { NextRequest, NextResponse } from 'next/server';
import {
  getDueScheduledTickets,
  processScheduledTicket,
} from '@/lib/scheduled-tickets/queries';

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all due scheduled tickets
    const dueTickets = await getDueScheduledTickets();

    const results = [];
    for (const scheduled of dueTickets) {
      try {
        const ticket = await processScheduledTicket(scheduled.id);
        results.push({
          scheduledId: scheduled.id,
          ticketId: ticket?.id,
          success: true,
        });
      } catch (error) {
        results.push({
          scheduledId: scheduled.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Error processing scheduled tickets:', error);
    return NextResponse.json(
      { error: 'Failed to process scheduled tickets' },
      { status: 500 }
    );
  }
}
