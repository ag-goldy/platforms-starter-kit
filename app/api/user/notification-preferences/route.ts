import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { notificationPreferences } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/session';

const EVENT_TYPES = [
  { key: 'ticket_assigned', label: 'Ticket assigned to you', defaultEmail: true, defaultInApp: true },
  { key: 'ticket_comment', label: 'New comment on your ticket', defaultEmail: true, defaultInApp: true },
  { key: 'ticket_status_change', label: 'Ticket status changed', defaultEmail: false, defaultInApp: true },
  { key: 'ticket_sla_warning', label: 'SLA deadline approaching', defaultEmail: true, defaultInApp: true },
  { key: 'service_status_change', label: 'Service status changed', defaultEmail: true, defaultInApp: true },
  { key: 'team_member_joined', label: 'New team member joined', defaultEmail: false, defaultInApp: true },
] as const;

/**
 * GET /api/user/notification-preferences
 * Get current user's notification preferences
 */
export async function GET() {
  try {
    const user = await requireAuth();

    // Get existing preferences or create defaults
    let prefs = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, user.id),
    });

    if (!prefs) {
      // Create default preferences
      const defaultEmailTypes = EVENT_TYPES.filter(et => et.defaultEmail).map(et => et.key);
      const defaultInAppTypes = EVENT_TYPES.filter(et => et.defaultInApp).map(et => et.key);

      const [created] = await db.insert(notificationPreferences).values({
        userId: user.id,
        emailTypes: defaultEmailTypes,
        inAppTypes: defaultInAppTypes,
      }).returning();

      prefs = created;
    }

    // Transform to per-event-type format for UI
    const emailTypes = prefs.emailTypes || [];
    const inAppTypes = prefs.inAppTypes || [];

    const preferencesWithLabels = EVENT_TYPES.map(et => ({
      eventType: et.key,
      label: et.label,
      emailEnabled: emailTypes.includes(et.key),
      inAppEnabled: inAppTypes.includes(et.key),
    }));

    return NextResponse.json({ preferences: preferencesWithLabels });
  } catch (error) {
    console.error('[API] Failed to fetch notification preferences:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/notification-preferences
 * Update notification preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { eventType, emailEnabled, inAppEnabled } = body;

    if (!eventType) {
      return NextResponse.json(
        { error: 'eventType is required' },
        { status: 400 }
      );
    }

    // Validate event type
    if (!EVENT_TYPES.some(et => et.key === eventType)) {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      );
    }

    // Get current preferences
    const prefs = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, user.id),
    });

    let emailTypes = prefs?.emailTypes || [];
    let inAppTypes = prefs?.inAppTypes || [];

    // Update arrays
    if (emailEnabled !== undefined) {
      if (emailEnabled && !emailTypes.includes(eventType)) {
        emailTypes = [...emailTypes, eventType];
      } else if (!emailEnabled) {
        emailTypes = emailTypes.filter(t => t !== eventType);
      }
    }

    if (inAppEnabled !== undefined) {
      if (inAppEnabled && !inAppTypes.includes(eventType)) {
        inAppTypes = [...inAppTypes, eventType];
      } else if (!inAppEnabled) {
        inAppTypes = inAppTypes.filter(t => t !== eventType);
      }
    }

    // Update or create
    if (prefs) {
      await db.update(notificationPreferences)
        .set({ emailTypes, inAppTypes, updatedAt: new Date() })
        .where(eq(notificationPreferences.id, prefs.id));
    } else {
      await db.insert(notificationPreferences).values({
        userId: user.id,
        emailTypes,
        inAppTypes,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Failed to update notification preferences:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

/**
 * Check if a user should receive a notification
 * This is a helper function, not an API endpoint
 */
export async function shouldNotify(
  userId: string,
  eventType: string,
  channel: 'email' | 'inApp'
): Promise<boolean> {
  const prefs = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  });

  if (!prefs) return true; // Default to enabled

  const types = channel === 'email' ? prefs.emailTypes : prefs.inAppTypes;
  return types?.includes(eventType) ?? true;
}
