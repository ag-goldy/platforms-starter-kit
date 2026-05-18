'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SLACountdownChip } from '@/components/tickets/sla-countdown-chip';

export default function InboxClient({
  initialTickets,
  orgId,
  slug,
}: {
  initialTickets: any[];
  orgId: string;
  slug: string;
}) {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const selectedTicket = initialTickets.find((t) => t.id === selectedTicketId);

  return (
    <div className="flex w-full h-full">
      {/* Left Pane: Filters & Saved Views */}
      <div className="w-64 border-r bg-muted/20 p-4 hidden md:block">
        <h2 className="font-semibold mb-4">Saved Views</h2>
        <ul className="space-y-2">
          <li>
            <Button variant="ghost" className="w-full justify-start">My Open</Button>
          </li>
          <li>
            <Button variant="ghost" className="w-full justify-start">Unassigned</Button>
          </li>
        </ul>
      </div>

      {/* Center Pane: Ticket List */}
      <div className="w-full md:w-96 border-r flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold">Inbox</h2>
          <Link href={`/${slug}/tickets/new`}>
            <Button size="sm">New Ticket</Button>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          {initialTickets.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">No tickets found.</div>
          ) : (
            <ul className="divide-y">
              {initialTickets.map((ticket) => (
                <li
                  key={ticket.id}
                  className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedTicketId === ticket.id ? 'bg-muted' : ''}`}
                  onClick={() => setSelectedTicketId(ticket.id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-sm">{ticket.key}</span>
                    <span className="text-xs text-muted-foreground">{ticket.status}</span>
                  </div>
                  <p className="text-sm line-clamp-2 mb-2">{ticket.title}</p>
                  <div className="flex gap-2 mt-1">
                    <SLACountdownChip 
                      type="Response" 
                      dueAt={ticket.responseDueAt} 
                      breachedAt={ticket.responseBreachedAt} 
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right Pane: Ticket Detail */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        {selectedTicket ? (
          <div className="p-6 h-full overflow-y-auto">
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold mb-2">{selectedTicket.title}</h1>
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <span>{selectedTicket.key}</span>
                  <span>•</span>
                  <span>{selectedTicket.status}</span>
                  <span>•</span>
                  <span>{selectedTicket.priority}</span>
                </div>
              </div>
              <Link href={`/${slug}/tickets/${selectedTicket.number}`}>
                <Button variant="outline">Open Full Page</Button>
              </Link>
            </div>
            
            <Card className="p-4 mb-6 prose max-w-none">
              <p>{selectedTicket.descriptionMd}</p>
            </Card>

            {/* Quick Reply (Simplified for Phase 2) */}
            <div className="mt-auto border-t pt-4">
              <h3 className="font-semibold mb-2">Quick Reply</h3>
              <form action="/api/actions/reply" className="space-y-4">
                <textarea 
                  className="w-full min-h-[100px] p-3 border rounded-md" 
                  placeholder="Type your reply... (Markdown supported)"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" type="button">Internal Note</Button>
                  <Button type="submit">Send Reply</Button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a ticket to view details
          </div>
        )}
      </div>
    </div>
  );
}
