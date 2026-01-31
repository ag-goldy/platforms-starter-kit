import { consumeTicketToken, createTicketToken } from '@/lib/tickets/magic-links';
import { getTicketById } from '@/lib/tickets/queries';
import { notFound } from 'next/navigation';
import { PublicTicketView } from '@/components/public/ticket-view';
import { headers } from 'next/headers';
import { getClientIP } from '@/lib/rate-limit';
import { type Ticket, type TicketComment, type Attachment } from '@/db/schema';

export default async function PublicTicketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const headersList = await headers();
  const ip = getClientIP(headersList);

  // Validate token
  const tokenData = await consumeTicketToken({
    token,
    purpose: 'VIEW',
    usedIp: ip,
  });

  if (!tokenData) {
    notFound();
  }

  // Get ticket
  const ticket = await getTicketById(tokenData.ticketId);

  if (!ticket) {
    notFound();
  }

  // Verify email matches (additional security check)
  if (ticket.requesterEmail !== tokenData.email) {
    notFound();
  }

  const viewToken = await createTicketToken({
    ticketId: ticket.id,
    email: tokenData.email,
    purpose: 'VIEW',
    createdIp: ip,
  });

  const replyToken = await createTicketToken({
    ticketId: ticket.id,
    email: tokenData.email,
    purpose: 'REPLY',
    createdIp: ip,
  });

  const attachments = ('attachments' in ticket && Array.isArray(ticket.attachments) ? ticket.attachments : []) as Attachment[];
  const downloadTokenEntries = await Promise.all(
    attachments.map(async (attachment: Attachment) => [
      attachment.id,
      await createTicketToken({
        ticketId: ticket.id,
        email: tokenData.email,
        purpose: 'VIEW',
        createdIp: ip,
      }),
    ])
  );
  const downloadTokens = Object.fromEntries(downloadTokenEntries);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <PublicTicketView
          ticket={ticket as unknown as Ticket & {
            organization: { name: string };
            requester: { name: string | null; email: string } | null;
            assignee: { name: string | null; email: string } | null;
            comments: (TicketComment & {
              user: { name: string | null; email: string } | null;
            })[];
            attachments: Attachment[];
          }}
          replyToken={replyToken}
          viewToken={viewToken}
          downloadTokens={downloadTokens}
        />
      </div>
    </div>
  );
}

