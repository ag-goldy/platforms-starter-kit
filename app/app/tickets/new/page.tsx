import { requireInternalRole } from '@/lib/auth/permissions';
import { getOrganizations } from '@/lib/organizations/queries';
import { getInternalUsers } from '@/lib/users/queries';
import { TicketForm } from '@/components/tickets/ticket-form';

export default async function NewTicketPage() {
  await requireInternalRole();

  const [organizations, internalUsers] = await Promise.all([
    getOrganizations(),
    getInternalUsers(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Ticket</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create a ticket on behalf of a customer or internal team.
        </p>
      </div>

      <TicketForm organizations={organizations} internalUsers={internalUsers} />
    </div>
  );
}
