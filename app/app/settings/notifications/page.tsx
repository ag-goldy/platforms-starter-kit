import { requireAuth } from "@/lib/auth/permissions";
import { getNotificationPreferences } from "./actions";
import { NotificationPreferencesForm } from "./notification-preferences-form";

export default async function NotificationsSettingsPage() {
  await requireAuth();
  const preferences = await getNotificationPreferences();

  return <NotificationPreferencesForm initialPreferences={preferences} />;
}
