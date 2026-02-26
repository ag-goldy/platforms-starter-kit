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
    <SessionsList
      initialSessions={sessions.map((s) => ({
        ...s,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
        revokedAt: s.revokedAt,
      }))}
      currentSessionToken={currentSessionToken}
    />
  );
}
