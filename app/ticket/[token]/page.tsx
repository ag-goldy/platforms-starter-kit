import { validateTicketToken } from '@/lib/tickets/magic-links';
import { getTicketById } from '@/lib/tickets/queries';
import { notFound } from 'next/navigation';
import { PublicTicketView } from '@/components/public/ticket-view';

export default async function PublicTicketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Validate token
  const tokenData = await validateTicketToken(token);

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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <PublicTicketView ticket={ticket} token={token} />
      </div>
    </div>
  );
}

