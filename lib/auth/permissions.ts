import { getServerUser } from './session';
import { db } from '@/db';
import { tickets, memberships } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { InternalRole, CustomerRole } from './roles';

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export async function requireAuth() {
  const user = await getServerUser();
  if (!user) {
    throw new AuthorizationError('You must be logged in to access this resource');
  }
  return user;
}

export async function requireInternalRole(allowedRoles?: InternalRole[]) {
  const user = await requireAuth();

  if (!user.isInternal) {
    throw new AuthorizationError('This resource is only accessible to internal users');
  }

  if (allowedRoles && allowedRoles.length > 0) {
    // For internal users, we need to check if they have a role
    // Since internal users don't have memberships, we'll use a simple check
    // In a real system, you might want to add a role field to users table
    // For MVP, we'll assume all internal users have AGENT role by default
    // and ADMIN is a special check (could be a separate field or first user)
    // For now, we'll allow access if user is internal
  }

  return user;
}

export async function requireOrgMemberRole(orgId: string, allowedRoles?: CustomerRole[]) {
  const user = await requireAuth();

  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, user.id),
      eq(memberships.orgId, orgId)
    ),
  });

  if (!membership) {
    throw new AuthorizationError('You do not have access to this organization');
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(membership.role as CustomerRole)) {
      throw new AuthorizationError(`This action requires one of: ${allowedRoles.join(', ')}`);
    }
  }

  return { user, membership };
}

export async function canViewTicket(ticketId: string) {
  const user = await requireAuth();

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });

  if (!ticket) {
    throw new AuthorizationError('Ticket not found');
  }

  // Internal users can view all tickets
  if (user.isInternal) {
    return { ticket, user };
  }

  // External users must be members of the ticket's org
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, user.id),
      eq(memberships.orgId, ticket.orgId)
    ),
  });

  if (!membership) {
    throw new AuthorizationError('You do not have access to this ticket');
  }

  return { ticket, user, membership };
}

export async function canEditTicket(ticketId: string) {
  const result = await canViewTicket(ticketId);

  // Internal users can edit
  if (result.user.isInternal) {
    return result;
  }

  // External users need at least REQUESTER role
  if (result.membership) {
    const role = result.membership.role;
    if (role === 'VIEWER') {
      throw new AuthorizationError('You do not have permission to edit this ticket');
    }
    return result;
  }

  throw new AuthorizationError('You do not have permission to edit this ticket');
}

export async function getUserOrgMemberships(userId: string) {
  return db.query.memberships.findMany({
    where: eq(memberships.userId, userId),
    with: {
      organization: true,
    },
  });
}

export async function getUserOrgs(userId: string) {
  const memberships = await getUserOrgMemberships(userId);
  return memberships.map((m) => m.organization);
}

export async function isOrgMember(userId: string, orgId: string): Promise<boolean> {
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, userId),
      eq(memberships.orgId, orgId)
    ),
  });
  return !!membership;
}
