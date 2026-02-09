import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { analyzeSentiment, analyzeTicketSentiment } from '@/lib/ai/sentiment';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { text, ticketId } = body;

    if (ticketId) {
      const analysis = await analyzeTicketSentiment(ticketId);
      return NextResponse.json({ analysis });
    }

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const analysis = analyzeSentiment(text);
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('[AI Sentiment] Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze sentiment' },
      { status: 500 }
    );
  }
}
