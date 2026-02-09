import { NextRequest, NextResponse } from 'next/server';
import { submitCSATResponse, getCSATByToken } from '@/lib/csat/queries';
import { createHash } from 'crypto';

interface Params {
  params: Promise<{ token: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const survey = await getCSATByToken(tokenHash);

    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    if (survey.respondedAt) {
      return NextResponse.json({ error: 'Survey already completed' }, { status: 400 });
    }

    if (new Date() > survey.expiresAt) {
      return NextResponse.json({ error: 'Survey expired' }, { status: 400 });
    }

    return NextResponse.json({ survey });
  } catch (error) {
    console.error('Error fetching CSAT survey:', error);
    return NextResponse.json(
      { error: 'Failed to fetch survey' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const body = await req.json();

    const { rating, comment } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    const survey = await submitCSATResponse({
      tokenHash,
      rating,
      comment,
    });

    if (!survey) {
      return NextResponse.json(
        { error: 'Survey not found, already completed, or expired' },
        { status: 400 }
      );
    }

    return NextResponse.json({ survey });
  } catch (error) {
    console.error('Error submitting CSAT response:', error);
    return NextResponse.json(
      { error: 'Failed to submit response' },
      { status: 500 }
    );
  }
}
