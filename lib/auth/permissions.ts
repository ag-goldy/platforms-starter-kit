import { db } from '@/db';
import { attachments, internalGroupMemberships, internalGroups, memberships, tickets } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { InternalRole, CustomerRole } from './roles';
import { getRequestContext } from './context';

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export async function requireAuth() {
  const ctx = await getRequestContext();
  if (!ctx.user) {
    throw new AuthorizationError('You must be logged in to access this resource');
  }
  return ctx.user;
}

export async function requireInternalRole(allowedRoles?: InternalRole[]) {
  const ctx = await getRequestContext();
  const user = ctx.user;
  if (!user) {
    throw new AuthorizationError('You must be logged in to access this resource');
  }

  if (!ctx.isInternal) {
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

export async function requireInternalAdmin() {
  const ctx = await getRequestContext();
  const user = ctx.user;

  if (!user || !ctx.isInternal) {
    throw new AuthorizationError('This resource is only accessible to internal users');
  }

  const platformAdminRoles = ['PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN'] as const;
  const platformAdminRoleList = [...platformAdminRoles];

  const [groupMembership] = await db
    .select({ roleType: internalGroups.roleType })
    .from(internalGroupMemberships)
    .innerJoin(
      internalGroups,
      eq(internalGroupMemberships.groupId, internalGroups.id)
    )
    .where(
      and(
        eq(internalGroupMemberships.userId, user.id),
        eq(internalGroups.scope, 'PLATFORM'),
        inArray(internalGroups.roleType, platformAdminRoleList)
      )
    )
    .limit(1);

  const allowlist = process.env.INTERNAL_ADMIN_EMAILS;
  if (!allowlist) {
    if (groupMembership) {
      return user;
    }

    const [anyPlatformAdminGroup] = await db
      .select({ id: internalGroups.id })
      .from(internalGroups)
      .where(
        and(
          eq(internalGroups.scope, 'PLATFORM'),
          inArray(internalGroups.roleType, platformAdminRoleList)
        )
      )
      .limit(1);

    if (anyPlatformAdminGroup) {
      throw new AuthorizationError('This resource is only accessible to admins');
    }

    return user;
  }

  const allowed = allowlist
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.includes(user.email.toLowerCase())) {
    return user;
  }

  if (!groupMembership) {
    throw new AuthorizationError('This resource is only accessible to admins');
  }

  return user;
}

export async function requireOrgMemberRole(orgId?: string, allowedRoles?: CustomerRole[]) {
  const ctx = await getRequestContext();
  const user = ctx.user;

  if (!user) {
    throw new AuthorizationError('You must be logged in to access this resource');
  }

  const resolvedOrgId = ctx.org?.id ?? orgId;
  if (!resolvedOrgId) {
    throw new AuthorizationError('Organization context is missing');
  }

  if (ctx.org && orgId && ctx.org.id !== orgId) {
    throw new AuthorizationError('Organization mismatch');
  }

  const membership =
    (ctx.membership?.isActive ? ctx.membership : null) ||
    (await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, user.id),
        eq(memberships.orgId, resolvedOrgId),
        eq(memberships.isActive, true)
      ),
    }));

  if (!membership) {
    throw new AuthorizationError('You do not have access to this organization');
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(membership.role as CustomerRole)) {
      throw new AuthorizationError(`This action requires one of: ${allowedRoles.join(', ')}`);
    }
  }

  return { user, membership, orgId: resolvedOrgId };
}

export async function canViewTicket(ticketId: string) {
  const ctx = await getRequestContext();
  const user = ctx.user;

  if (!user) {
    throw new AuthorizationError('You must be logged in to access this resource');
  }

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });

  if (!ticket) {
    throw new AuthorizationError('Ticket not found');
  }

  // Internal users can view all tickets
  if (ctx.isInternal) {
    return { ticket, user, membership: null };
  }

  // External users must be members of the ticket's org
  let membership = ctx.membership?.isActive ? ctx.membership : null;
  if (membership && membership.orgId !== ticket.orgId) {
    membership = null;
  }

  if (!membership) {
    const foundMembership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, user.id),
        eq(memberships.orgId, ticket.orgId),
        eq(memberships.isActive, true)
      ),
    });
    membership = foundMembership || null;
  }

  if (!membership) {
    throw new AuthorizationError('You do not have access to this ticket');
  }

  return { ticket, user, membership };
}

export async function canReplyTicket(ticketId: string) {
  const result = await canViewTicket(ticketId);

  if (result.user.isInternal) {
    return result;
  }

  if (result.membership) {
    const role = result.membership.role;
    if (role === 'VIEWER') {
      throw new AuthorizationError('You do not have permission to reply to this ticket');
    }
    return result;
  }

  throw new AuthorizationError('You do not have permission to reply to this ticket');
}

export async function canEditTicket(ticketId: string) {
  return canReplyTicket(ticketId);
}

export async function canDownloadAttachment(attachmentId: string) {
  const ctx = await getRequestContext();
  const user = ctx.user;

  if (!user) {
    throw new AuthorizationError('You must be logged in to access this resource');
  }

  const attachment = await db.query.attachments.findFirst({
    where: eq(attachments.id, attachmentId),
  });

  if (!attachment) {
    throw new AuthorizationError('Attachment not found');
  }

  if (ctx.isInternal) {
    return { ...attachment, attachment, user, membership: null };
  }

  let membership = ctx.membership?.isActive ? ctx.membership : null;
  if (membership && membership.orgId !== attachment.orgId) {
    membership = null;
  }

  if (!membership) {
    const foundMembership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, user.id),
        eq(memberships.orgId, attachment.orgId),
        eq(memberships.isActive, true)
      ),
    });
    membership = foundMembership || null;
  }

  if (!membership) {
    throw new AuthorizationError('You do not have access to this attachment');
  }

  return { ...attachment, attachment, user, membership };
}

export async function getUserOrgMemberships(userId: string) {
  return db.query.memberships.findMany({
    where: and(eq(memberships.userId, userId), eq(memberships.isActive, true)),
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
      eq(memberships.orgId, orgId),
      eq(memberships.isActive, true)
    ),
  });
  return !!membership;
}
