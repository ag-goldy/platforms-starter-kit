'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Inbox, UserX, Clock, AlertCircle } from 'lucide-react';

interface SavedViewsProps {
  currentUserId: string;
}

export function SavedViews({ currentUserId }: SavedViewsProps) {
  const router = useRouter();
  
  const views = [
    {
      name: 'My Open',
      icon: Inbox,
      href: '/app/tickets?status=OPEN&assigneeId=' + currentUserId,
      description: 'Tickets assigned to me that are open',
    },
    {
      name: 'Unassigned',
      icon: UserX,
      href: '/app/tickets?status=OPEN&assigneeId=unassigned',
      description: 'Open tickets with no assignee',
    },
    {
      name: 'Waiting',
      icon: Clock,
      href: '/app/tickets?status=WAITING_ON_CUSTOMER',
      description: 'Tickets waiting on customer response',
    },
    {
      name: 'P1/P2',
      icon: AlertCircle,
      href: '/app/tickets?priority=P1',
      description: 'High priority tickets (P1 and P2)',
    },
  ];
  
  return (
    <div className="flex flex-wrap gap-2">
      {views.map((view) => {
        const Icon = view.icon;
        return (
          <Button
            key={view.name}
            variant="outline"
            size="sm"
            onClick={() => router.push(view.href)}
            className="flex items-center gap-2"
            title={view.description}
          >
            <Icon className="h-4 w-4" />
            {view.name}
          </Button>
        );
      })}
    </div>
  );
}
