export type TenantRole =
  | "owner"
  | "admin"
  | "agent_lead"
  | "agent"
  | "analyst"
  | "end_user"
  | "system";
export type PlatformRole = "SUPER_ADMIN" | "ADMIN" | "SUPPORT";

export type AuthCtx = {
  userId?: string;
  platformAdminId?: string;
  kind: "tenant" | "platform" | "impersonation";
  impersonatingOrgId?: string;
  memberships: Array<{ orgId: string; role: TenantRole; teamId?: string }>;
  platformRole?: PlatformRole;
  allowed?: boolean;
};

// Resource Types
export type TicketResource = {
  type: "ticket";
  orgId: string;
  assigneeId?: string;
  teamId?: string;
  requesterId: string;
};
export type KbArticleResource = {
  type: "kb_article";
  orgId: string;
  visibility: string;
  restrictedTeamIds?: string[];
};
export type AssetResource = { type: "asset"; orgId: string };
export type OrgResource = { type: "org"; orgId: string };

export type Resource =
  | TicketResource
  | KbArticleResource
  | AssetResource
  | OrgResource;

// Action Types
export type Action =
  | "ticket.reply"
  | "ticket.edit"
  | "ticket.delete"
  | "kb.publish"
  | "kb.edit"
  | "asset.edit"
  | "settings.sla.edit"
  | "org.delete";

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

export class AuthorizationError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function requirePermission(
  action: Action,
  resource: Resource,
  ctx: AuthCtx,
): asserts ctx is AuthCtx & { allowed: true } {
  // 1. Platform super-admin bypass
  if (ctx.kind === "platform" && ctx.platformRole === "SUPER_ADMIN") {
    ctx.allowed = true;
    return;
  }

  // 2. Platform admin during impersonation
  if (
    ctx.kind === "impersonation" &&
    ctx.impersonatingOrgId === resource.orgId
  ) {
    // Basic impersonation allows most tenant-level actions, except org deletion
    if (action === "org.delete") {
      throw new PermissionError("Impersonation does not allow org deletion");
    }
    ctx.allowed = true;
    return;
  }

  // Ensure user is acting within their tenant context
  if (ctx.kind !== "tenant") {
    throw new PermissionError("Invalid session kind for tenant action");
  }

  const membership = ctx.memberships.find((m) => m.orgId === resource.orgId);
  if (!membership) {
    throw new PermissionError("User is not a member of this organization");
  }

  const { role } = membership;

  // 3. Tenant role checks
  if (role === "owner") {
    ctx.allowed = true;
    return;
  }

  if (role === "admin") {
    if (action === "org.delete") {
      throw new PermissionError("Only owner can delete org");
    }
    ctx.allowed = true;
    return;
  }

  if (role === "analyst") {
    throw new PermissionError("Analyst is read-only");
  }

  // 4. Resource-level checks
  if (resource.type === "ticket") {
    if (action === "ticket.reply" || action === "ticket.edit") {
      if (role === "agent_lead") {
        ctx.allowed = true;
        return;
      }
      if (role === "agent") {
        if (resource.teamId && resource.teamId === membership.teamId) {
          ctx.allowed = true;
          return;
        }
        if (resource.assigneeId === ctx.userId) {
          ctx.allowed = true;
          return;
        }
      }
      if (role === "end_user") {
        if (resource.requesterId === ctx.userId) {
          ctx.allowed = true;
          return;
        }
      }
      throw new PermissionError(
        "Insufficient permissions to modify this ticket",
      );
    }
  }

  if (resource.type === "kb_article") {
    if (action === "kb.publish" || action === "kb.edit") {
      if (role === "agent_lead") {
        ctx.allowed = true;
        return;
      }
      if (role === "agent" && action === "kb.edit") {
        ctx.allowed = true; // Agents can edit drafts
        return;
      }
      throw new PermissionError("Insufficient permissions to modify KB");
    }
  }

  if (resource.type === "asset") {
    if (action === "asset.edit") {
      if (role === "agent_lead" || role === "agent") {
        ctx.allowed = true;
        return;
      }
      throw new PermissionError("Insufficient permissions to modify asset");
    }
  }

  throw new PermissionError(`Action ${action} not allowed for role ${role}`);
}

type LegacyRole =
  | "ADMIN"
  | "AGENT"
  | "READONLY"
  | "CUSTOMER_ADMIN"
  | "REQUESTER"
  | "VIEWER";

export function checkInternalRole(
  userRole: string,
  allowedRoles?: LegacyRole[],
): void {
  if (!allowedRoles?.length) return;
  if (!allowedRoles.includes(userRole as LegacyRole)) {
    throw new AuthorizationError("Insufficient role");
  }
}

export async function requireAuth() {
  const { getRequestContext } = await import("@/lib/auth/context");
  const context = await getRequestContext();
  if (!context.user && !context.platformAdmin) {
    throw new AuthorizationError("Authentication required");
  }

  return {
    user: context.user || context.platformAdmin!,
    platformAdmin: context.platformAdmin,
    isPlatformAdmin: context.isPlatformAdmin,
    context,
  };
}

export async function requireInternalRole(allowedRoles?: LegacyRole[]) {
  const { getRequestContext } = await import("@/lib/auth/context");
  const context = await getRequestContext();

  if (context.isPlatformAdmin && context.platformAdmin) {
    return {
      user: {
        id: context.platformAdmin.id,
        email: context.platformAdmin.email,
        name: context.platformAdmin.name,
        role: context.platformAdmin.role,
        isInternal: true,
        isPlatformAdmin: true,
      },
      platformAdmin: context.platformAdmin,
      context,
    };
  }

  if (!context.user) {
    throw new AuthorizationError("Authentication required");
  }
  if (!context.user.isInternal) {
    throw new AuthorizationError("Internal access required");
  }
  const internalRole = ((context.user as { role?: string }).role ||
    "AGENT") as LegacyRole;
  checkInternalRole(internalRole, allowedRoles);

  return {
    user: context.user,
    platformAdmin: null,
    context,
  };
}

export async function requireInternalAdmin() {
  return requireInternalRole(["ADMIN"]);
}

export async function requireOrgRole(
  orgId: string,
  allowedRoles?: LegacyRole[],
) {
  const { getRequestContext } = await import("@/lib/auth/context");
  const { db } = await import("@/db");
  const { memberships } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const context = await getRequestContext();

  if (
    context.impersonation &&
    context.membership &&
    context.user &&
    context.impersonation.orgId === orgId
  ) {
    if (
      allowedRoles?.length &&
      !allowedRoles.includes(context.membership.role as LegacyRole)
    ) {
      throw new AuthorizationError("Insufficient organization role");
    }

    return {
      user: context.user,
      membership: context.membership,
      orgId,
      context,
    };
  }

  if (context.isPlatformAdmin && context.platformAdmin) {
    return {
      user: {
        id: context.platformAdmin.id,
        email: context.platformAdmin.email,
        name: context.platformAdmin.name,
        role: context.platformAdmin.role,
        isInternal: true,
        isPlatformAdmin: true,
      },
      membership: null,
      orgId,
      context,
    };
  }

  if (!context.user) {
    throw new AuthorizationError("Authentication required");
  }

  const membership =
    context.membership?.orgId === orgId
      ? context.membership
      : await db.query.memberships.findFirst({
          where: and(
            eq(memberships.userId, context.user.id),
            eq(memberships.orgId, orgId),
            eq(memberships.isActive, true),
          ),
        });

  if (!membership) {
    throw new AuthorizationError("Organization membership required");
  }
  if (
    allowedRoles?.length &&
    !allowedRoles.includes(membership.role as LegacyRole)
  ) {
    throw new AuthorizationError("Insufficient organization role");
  }

  return {
    user: context.user,
    membership,
    orgId,
    context,
  };
}

export async function requireOrgMemberRole(
  orgId?: string,
  allowedRoles?: LegacyRole[],
) {
  if (orgId) {
    return requireOrgRole(orgId, allowedRoles);
  }

  const { getRequestContext } = await import("@/lib/auth/context");
  const context = await getRequestContext();
  const resolvedOrgId = context.membership?.orgId;
  if (!resolvedOrgId) {
    throw new AuthorizationError("Organization membership required");
  }

  return requireOrgRole(resolvedOrgId, allowedRoles);
}

export async function canViewTicket(ticketId: string) {
  const { db } = await import("@/db");
  const { tickets } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const { getRequestContext } = await import("@/lib/auth/context");

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });

  if (!ticket) {
    return { ticket: null };
  }

  const context = await getRequestContext();

  // Internal users and platform admins can view any ticket
  if (context.isPlatformAdmin || context.user?.isInternal) {
    return { ticket };
  }

  if (ticket.orgId) {
    await requireOrgRole(ticket.orgId);
  }

  return { ticket };
}

export async function canEditTicket(ticketId: string) {
  const result = await canViewTicket(ticketId);
  if (!result.ticket) {
    throw new AuthorizationError("Ticket not found");
  }

  return result as { ticket: NonNullable<typeof result.ticket> };
}

export async function canManageOrgSettings(
  userId: string,
  orgId: string | null | undefined,
): Promise<boolean> {
  if (!orgId) return false;
  try {
    await requireOrgRole(orgId, ["ADMIN", "CUSTOMER_ADMIN"]);
    return true;
  } catch {
    return false;
  }
}

export async function canManageTickets(
  userId: string,
  orgId: string | null | undefined,
): Promise<boolean> {
  if (!orgId) return false;
  try {
    await requireOrgRole(orgId, ["ADMIN", "AGENT", "CUSTOMER_ADMIN"]);
    return true;
  } catch {
    return false;
  }
}

export async function canDownloadAttachment(attachmentId: string) {
  const { db } = await import("@/db");
  const { attachments } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const { getRequestContext } = await import("@/lib/auth/context");

  const attachment = await db.query.attachments.findFirst({
    where: eq(attachments.id, attachmentId),
  });

  if (!attachment) {
    throw new AuthorizationError("Attachment not found");
  }

  const context = await getRequestContext();

  // Platform admins and internal users can download any attachment
  if (context.isPlatformAdmin || context.user?.isInternal) {
    return { attachment };
  }

  if (attachment.orgId) {
    await requireOrgRole(attachment.orgId);
  }

  return { attachment };
}
