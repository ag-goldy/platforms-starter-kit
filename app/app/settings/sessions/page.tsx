import { requireAuth } from '@/lib/auth/permissions';
import { getAllUserSessionsAction } from '@/app/app/actions/sessions';
import { SessionsList } from '@/components/settings/sessions-list';
import { getSessionTokenFromCookie, hashSessionToken } from '@/lib/auth/session-tracking';

export default async function SessionsPage() {
  await requireAuth();
  const sessions = await getAllUserSessionsAction();

  // Get current session token from NextAuth cookie and hash it
  const sessionToken = await getSessionTokenFromCookie();
  const currentSessionToken = sessionToken ? hashSessionToken(sessionToken) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Active Sessions</h1>
        <p className="text-sm text-gray-600 mt-1">
          View and manage your active sessions across different devices
        </p>
      </div>

      <SessionsList
        initialSessions={sessions.map((s) => ({
          ...s,
          lastActiveAt: s.lastActiveAt,
          createdAt: s.createdAt,
          revokedAt: s.revokedAt,
        }))}
        currentSessionToken={currentSessionToken}
      />
    </div>
  );
}

