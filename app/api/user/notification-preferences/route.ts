import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notificationPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";

const EVENT_TYPES = [
  {
    key: "TICKET_ASSIGNED",
    label: "Ticket assigned to you",
    defaultEmail: true,
    defaultInApp: true,
  },
  {
    key: "TICKET_COMMENTED",
    label: "New comment on your ticket",
    defaultEmail: true,
    defaultInApp: true,
  },
  {
    key: "TICKET_STATUS_CHANGED",
    label: "Ticket status changed",
    defaultEmail: false,
    defaultInApp: true,
  },
  {
    key: "TICKET_SLA_WARNING",
    label: "SLA deadline approaching",
    defaultEmail: true,
    defaultInApp: true,
  },
  {
    key: "TICKET_SLA_BREACH",
    label: "SLA deadline breached",
    defaultEmail: true,
    defaultInApp: true,
  },
  {
    key: "USER_MENTIONED",
    label: "You were mentioned",
    defaultEmail: true,
    defaultInApp: true,
  },
  {
    key: "ORG_INVITATION",
    label: "Organization invitation",
    defaultEmail: true,
    defaultInApp: true,
  },
  {
    key: "AUTOMATION_TRIGGERED",
    label: "Automation triggered",
    defaultEmail: false,
    defaultInApp: true,
  },
] as const;

function preferenceOwner(user: Awaited<ReturnType<typeof requireAuth>>) {
  return user.isPlatformAdmin
    ? {
        where: eq(notificationPreferences.platformAdminId, user.user.id),
        values: { platformAdminId: user.user.id },
      }
    : {
        where: eq(notificationPreferences.userId, user.user.id),
        values: { userId: user.user.id },
      };
}

/**
 * GET /api/user/notification-preferences
 * Get current user's notification preferences
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const owner = preferenceOwner(user);

    // Get existing preferences or create defaults
    let prefs = await db.query.notificationPreferences.findFirst({
      where: owner.where,
    });

    if (!prefs) {
      // Create default preferences
      const defaultEmailTypes = EVENT_TYPES.filter((et) => et.defaultEmail).map(
        (et) => et.key,
      );
      const defaultInAppTypes = EVENT_TYPES.filter((et) => et.defaultInApp).map(
        (et) => et.key,
      );

      const [created] = await db
        .insert(notificationPreferences)
        .values({
          ...owner.values,
          emailTypes: defaultEmailTypes,
          inAppTypes: defaultInAppTypes,
        })
        .returning();

      prefs = created;
    }

    // Transform to per-event-type format for UI
    const emailTypes = prefs.emailTypes || [];
    const inAppTypes = prefs.inAppTypes || [];

    const preferencesWithLabels = EVENT_TYPES.map((et) => ({
      eventType: et.key,
      label: et.label,
      emailEnabled: emailTypes.includes(et.key),
      inAppEnabled: inAppTypes.includes(et.key),
    }));

    return NextResponse.json({ preferences: preferencesWithLabels });
  } catch (error) {
    console.error("[API] Failed to fetch notification preferences:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch preferences",
      },
      { status: 500 },
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
    const owner = preferenceOwner(user);
    const body = await request.json();
    const { eventType, emailEnabled, inAppEnabled } = body;

    if (!eventType) {
      return NextResponse.json(
        { error: "eventType is required" },
        { status: 400 },
      );
    }

    // Validate event type
    if (!EVENT_TYPES.some((et) => et.key === eventType)) {
      return NextResponse.json(
        { error: "Invalid event type" },
        { status: 400 },
      );
    }

    // Get current preferences
    const prefs = await db.query.notificationPreferences.findFirst({
      where: owner.where,
    });

    let emailTypes = prefs?.emailTypes || [];
    let inAppTypes = prefs?.inAppTypes || [];

    // Update arrays
    if (emailEnabled !== undefined) {
      if (emailEnabled && !emailTypes.includes(eventType)) {
        emailTypes = [...emailTypes, eventType];
      } else if (!emailEnabled) {
        emailTypes = emailTypes.filter((t) => t !== eventType);
      }
    }

    if (inAppEnabled !== undefined) {
      if (inAppEnabled && !inAppTypes.includes(eventType)) {
        inAppTypes = [...inAppTypes, eventType];
      } else if (!inAppEnabled) {
        inAppTypes = inAppTypes.filter((t) => t !== eventType);
      }
    }

    // Update or create
    if (prefs) {
      await db
        .update(notificationPreferences)
        .set({ emailTypes, inAppTypes, updatedAt: new Date() })
        .where(eq(notificationPreferences.id, prefs.id));
    } else {
      await db.insert(notificationPreferences).values({
        ...owner.values,
        emailTypes,
        inAppTypes,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Failed to update notification preferences:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update preferences",
      },
      { status: 500 },
    );
  }
}
