import { requireInternalRole } from '@/lib/auth/permissions';
import { getOrganizations } from '@/lib/organizations/queries';
import { getInternalUsers } from '@/lib/users/queries';
import { TicketForm } from '@/components/tickets/ticket-form';
import { db } from '@/db';

export default async function NewTicketPage() {
  await requireInternalRole();

  const [organizations, internalUsers, siteList, areaList] = await Promise.all([
    getOrganizations(),
    getInternalUsers(),
    db.query.sites.findMany({
      orderBy: (table, { asc }) => [asc(table.name)],
    }),
    db.query.areas.findMany({
      orderBy: (table, { asc }) => [asc(table.name)],
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Ticket</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create a ticket on behalf of a customer or internal team.
        </p>
      </div>

      <TicketForm
        organizations={organizations}
        internalUsers={internalUsers}
        sites={siteList}
        areas={areaList}
      />
    </div>
  );
}
