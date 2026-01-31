'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface User {
  id: string;
  email: string;
  name: string | null;
  isInternal: boolean;
  createdAt: Date;
  memberships: Array<{
    role: string;
    organization: {
      id: string;
      name: string;
    };
  }>;
}

interface UsersListProps {
  users: User[];
}

export function UsersList({ users }: UsersListProps) {
  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-gray-500">No users found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Users</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-medium">{user.name || user.email}</div>
                    {user.name && (
                      <div className="text-sm text-gray-600">{user.email}</div>
                    )}
                  </div>
                  {user.isInternal && (
                    <Badge variant="default">Internal</Badge>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {user.memberships.map((membership) => (
                    <Badge key={membership.organization.id} variant="outline">
                      {membership.organization.name} ({membership.role})
                    </Badge>
                  ))}
                </div>
              </div>
              <Link
                href={`/app/users/${user.id}`}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                View →
              </Link>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

