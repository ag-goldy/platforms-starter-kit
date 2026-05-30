import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";

type PreferenceClient = {
  execute(query: SQL): Promise<unknown>;
};

export async function ensureNotificationPreferencesForUser(
  userId: string,
  client: PreferenceClient = db,
): Promise<void> {
  await insertNotificationPreference(
    sql`
      INSERT INTO notification_preferences (user_id)
      VALUES (${userId})
      ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO NOTHING
    `,
    "user",
    userId,
    client,
  );
}

export async function ensureNotificationPreferencesForPlatformAdmin(
  platformAdminId: string,
  client: PreferenceClient = db,
): Promise<void> {
  await insertNotificationPreference(
    sql`
      INSERT INTO notification_preferences (platform_admin_id)
      VALUES (${platformAdminId})
      ON CONFLICT (platform_admin_id) WHERE platform_admin_id IS NOT NULL DO NOTHING
    `,
    "platform_admin",
    platformAdminId,
    client,
  );
}

async function insertNotificationPreference(
  query: SQL,
  ownerType: "user" | "platform_admin",
  ownerId: string,
  client: PreferenceClient,
) {
  try {
    await client.execute(query);
  } catch (error) {
    console.error("[Notifications] Failed to ensure preference row", {
      ownerType,
      ownerId,
      error,
    });
  }
}
