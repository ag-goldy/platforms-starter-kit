import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { userSessionsExtended, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth';
import webpush from 'web-push';

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin-crm@agrnetworks.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('[Push Notifications] VAPID keys configured');
} else {
  console.warn('[Push Notifications] VAPID keys not configured');
}

export async function POST(request: NextRequest) {
  try {
    // Check VAPID configuration
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Push notifications not configured' },
        { status: 503 }
      );
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is internal/admin
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { isInternal: true },
    });

    if (!user?.isInternal) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, title, body, url, actions } = await request.json();

    if (!userId || !title || !body) {
      return NextResponse.json(
        { error: 'userId, title, and body are required' },
        { status: 400 }
      );
    }

    // Get active push subscriptions for user
    const subscriptions = await db.query.userSessionsExtended.findMany({
      where: and(
        eq(userSessionsExtended.userId, userId),
        eq(userSessionsExtended.isActive, true)
      ),
    });

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'No active subscriptions found' },
        { status: 404 }
      );
    }

    // Send push notification to each subscription
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const subData = JSON.parse(Buffer.from(sub.sessionToken, 'base64').toString());
          
          const pushSubscription = {
            endpoint: subData.endpoint,
            keys: subData.keys,
          };

          const payload = JSON.stringify({
            title,
            body,
            url: url || '/',
            actions: actions || [],
            tag: `notification-${Date.now()}`,
          });

          await webpush.sendNotification(pushSubscription, payload);
          return { success: true };
        } catch (err) {
          console.error('[Push] Failed to send to subscription:', err);
          throw err;
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      sent: successful,
      failed,
      total: subscriptions.length,
    });
  } catch (error) {
    console.error('Send notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
