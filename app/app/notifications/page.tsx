import Link from "next/link";
import { Bell, CheckCircle2, Clock3, RadioTower, Settings2 } from "lucide-react";
import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireAuth } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils/date";

export default async function NotificationsPage() {
  const { user } = await requireAuth();

  async function markAllAsRead() {
    "use server";
    const { user: currentUser } = await requireAuth();
    await db
      .update(notifications)
      .set({ read: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, currentUser.id),
          eq(notifications.read, false),
        ),
      );
    revalidatePath("/app/notifications");
  }

  const [rows, stats] = await Promise.all([
    db.query.notifications.findMany({
      where: eq(notifications.userId, user.id),
      orderBy: [desc(notifications.createdAt)],
      limit: 100,
    }),
    db
      .select({
        total: sql<number>`count(*)::int`,
        unread: sql<number>`count(*) filter (where ${notifications.read} = false)::int`,
        recent: sql<number>`count(*) filter (where ${notifications.createdAt} >= now() - interval '24 hours')::int`,
      })
      .from(notifications)
      .where(eq(notifications.userId, user.id)),
  ]);

  const summary = stats[0] ?? { total: 0, unread: 0, recent: 0 };

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
              <Bell className="h-4 w-4" />
              Real-time Notifications
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Notification center
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Review in-app alerts delivered through the Atlas notification stream, then tune email and in-app preferences.
            </p>
          </div>
          <form action={markAllAsRead}>
            <Button type="submit" disabled={summary.unread === 0}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark all read
            </Button>
          </form>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <NotificationMetric icon={Bell} label="Unread" value={summary.unread} detail={`${summary.total} total`} />
        <NotificationMetric icon={Clock3} label="Last 24 hours" value={summary.recent} detail="Recent delivery" />
        <NotificationMetric icon={RadioTower} label="Delivery" value="SSE" detail="Live stream plus polling fallback" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-sm font-semibold">Recent notifications</h2>
            <p className="mt-1 text-xs text-slate-500">
              Showing the latest {rows.length} events for {user.email}.
            </p>
          </div>
          {rows.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-500">
              <Bell className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              No notifications yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((notification) => {
                const content = (
                  <div className="grid gap-3 px-4 py-4 transition-colors hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_160px] dark:hover:bg-slate-950">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{notification.type.replaceAll("_", " ")}</Badge>
                        {!notification.read && (
                          <Badge className="bg-blue-600 text-white">Unread</Badge>
                        )}
                      </div>
                      <h3 className="truncate font-semibold text-slate-950 dark:text-white">
                        {notification.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {notification.message}
                      </p>
                    </div>
                    <div className="text-xs text-slate-500 sm:text-right">
                      {formatDateTime(notification.createdAt)}
                    </div>
                  </div>
                );

                return notification.link ? (
                  <Link key={notification.id} href={notification.link}>
                    {content}
                  </Link>
                ) : (
                  <div key={notification.id}>{content}</div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Settings2 className="h-4 w-4 text-slate-400" />
              Notification settings
            </div>
            <div className="space-y-3 text-sm text-slate-500">
              <p>In-app alerts are persisted in Postgres and streamed to the bell through SSE.</p>
              <p>Email digest delivery is handled by the scheduled digest route.</p>
              <p>Web push uses VAPID keys when configured.</p>
            </div>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href="/app/settings/notifications">
                Manage notification preferences
              </Link>
            </Button>
          </div>
        </aside>
      </section>
    </div>
  );
}

function NotificationMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Bell;
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}
