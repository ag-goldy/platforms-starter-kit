'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getUserSessionsAction, revokeSessionAction, revokeAllOtherSessionsAction } from '@/app/app/actions/sessions';
import { useToast } from '@/components/ui/toast';
import { Trash2, Monitor, Smartphone, Tablet } from 'lucide-react';

interface UserSession {
  id: string;
  sessionToken: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastActiveAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}

interface SessionsListProps {
  initialSessions: UserSession[];
  currentSessionToken?: string;
}

export function SessionsList({ initialSessions, currentSessionToken }: SessionsListProps) {
  const [sessions, setSessions] = useState(initialSessions);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const { showToast } = useToast();

  const handleRevokeSession = async (sessionToken: string, sessionId: string) => {
    if (!confirm('Are you sure you want to revoke this session? The user will need to log in again from that device.')) {
      return;
    }

    setRevokingSessionId(sessionId);
    try {
      await revokeSessionAction(sessionToken);
      setSessions(sessions.filter((s) => s.id !== sessionId));
      showToast('Session revoked successfully', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to revoke session', 'error');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeAllOthers = async () => {
    if (!confirm('Are you sure you want to revoke all other sessions? You will remain logged in on this device, but all other devices will be logged out.')) {
      return;
    }

    setRevokingAll(true);
    try {
      await revokeAllOtherSessionsAction();
      // Refresh sessions list
      const updatedSessions = await getUserSessionsAction();
      setSessions(updatedSessions);
      showToast('All other sessions revoked successfully', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to revoke sessions', 'error');
    } finally {
      setRevokingAll(false);
    }
  };

  const getDeviceIcon = (deviceInfo: string | null) => {
    if (!deviceInfo) return <Monitor className="h-4 w-4" />;
    const info = deviceInfo.toLowerCase();
    if (info.includes('mobile')) return <Smartphone className="h-4 w-4" />;
    if (info.includes('tablet')) return <Tablet className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const formatLastActive = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const activeSessions = sessions.filter((s) => !s.revokedAt);
  const revokedSessions = sessions.filter((s) => s.revokedAt);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>
                Manage your active sessions across different devices
              </CardDescription>
            </div>
            {activeSessions.length > 1 && (
              <Button
                variant="outline"
                onClick={handleRevokeAllOthers}
                disabled={revokingAll}
              >
                {revokingAll ? 'Revoking...' : 'Revoke All Other Sessions'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {activeSessions.length === 0 ? (
            <p className="text-sm text-gray-500">No active sessions</p>
          ) : (
            <div className="space-y-4">
              {activeSessions.map((session) => {
                const isCurrentSession = currentSessionToken === session.sessionToken;
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        {getDeviceIcon(session.deviceInfo)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {session.deviceInfo || 'Unknown Device'}
                          </span>
                          {isCurrentSession && (
                            <Badge variant="default">Current Session</Badge>
                          )}
                        </div>
                        {session.ipAddress && (
                          <div className="text-sm text-gray-600 mt-1">
                            IP: {session.ipAddress}
                          </div>
                        )}
                        <div className="text-sm text-gray-500 mt-1">
                          Last active: {formatLastActive(session.lastActiveAt)}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Created: {new Date(session.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    {!isCurrentSession && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevokeSession(session.sessionToken, session.id)}
                        disabled={revokingSessionId === session.id}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {revokingSessionId === session.id ? 'Revoking...' : 'Revoke'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {revokedSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revoked Sessions</CardTitle>
            <CardDescription>
              Sessions that have been revoked (shown for the last 30 days)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {revokedSessions.slice(0, 10).map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 opacity-60"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">
                      {getDeviceIcon(session.deviceInfo)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {session.deviceInfo || 'Unknown Device'}
                      </div>
                      {session.ipAddress && (
                        <div className="text-sm text-gray-600 mt-1">
                          IP: {session.ipAddress}
                        </div>
                      )}
                      <div className="text-sm text-gray-500 mt-1">
                        Revoked: {session.revokedAt ? new Date(session.revokedAt).toLocaleString() : 'Unknown'}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline">Revoked</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

