import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { userSessionsExtended } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpoint } = await request.json();
    
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint required' }, { status: 400 });
    }

    const sessionToken = Buffer.from(JSON.stringify({ endpoint })).toString('base64');

    await db
      .update(userSessionsExtended)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokedReason: 'user_unsubscribed',
      })
      .where(eq(userSessionsExtended.sessionToken, sessionToken));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    );
  }
}
