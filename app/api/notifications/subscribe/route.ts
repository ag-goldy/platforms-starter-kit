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

    const subscription = await request.json();
    
    if (!subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    const sessionToken = Buffer.from(JSON.stringify(subscription)).toString('base64');

    const existing = await db.query.userSessionsExtended.findFirst({
      where: eq(userSessionsExtended.sessionToken, sessionToken),
    });

    if (existing) {
      await db
        .update(userSessionsExtended)
        .set({
          isActive: true,
          lastActiveAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        })
        .where(eq(userSessionsExtended.id, existing.id));
    } else {
      await db.insert(userSessionsExtended).values({
        userId: session.user.id,
        sessionToken,
        deviceType: detectDeviceType(subscription.userAgent || ''),
        userAgent: subscription.userAgent,
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe' },
      { status: 500 }
    );
  }
}

function detectDeviceType(userAgent: string): string | null {
  if (!userAgent) return null;
  if (/mobile/i.test(userAgent)) return 'mobile';
  if (/tablet/i.test(userAgent)) return 'tablet';
  return 'desktop';
}
