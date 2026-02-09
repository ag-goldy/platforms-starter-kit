'use server';

import { db } from '@/db';
import { users, memberships, organizations } from '@/db/schema';
import { requireInternalRole } from '@/lib/auth/permissions';
import { logAudit } from '@/lib/audit/log';
import { revalidatePath } from 'next/cache';
import { eq, and, asc } from 'drizzle-orm';
import { z } from 'zod';
import { createInvitation, createInvitationLink, cancelInvitation, resendInvitationEmail } from '@/lib/users/invitations';
import type { CustomerRole } from '@/lib/auth/roles';

const passwordSchema = z.string().min(8).max(100);

/**
 * Change user password (for authenticated users)
 */
export async function changePasswordAction(currentPassword: string, newPassword: string) {
  const bcrypt = await import('bcryptjs');
  const { getServerSession } = await import('@/lib/auth/session');
  
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new Error('Not authenticated');
  }

  // Get current user
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user?.passwordHash) {
    throw new Error('Password cannot be changed');
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  // Validate new password
  passwordSchema.parse(newPassword);

  // Update password
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db
    .update(users)
    .set({ passwordHash: hashedPassword, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  await logAudit({
    userId: session.user.id,
    action: 'USER_UPDATED',
    details: JSON.stringify({ userId: session.user.id }),
  });

  revalidatePath('/app');
  return { success: true };
}

/**
 * Admin: Change any user's password
 */
export async function adminChangePasswordAction(userId: string, newPassword: string) {
  const user = await requireInternalRole();

  passwordSchema.parse(newPassword);

  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await db
    .update(users)
    .set({ passwordHash: hashedPassword, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await logAudit({
    userId: user.id,
    action: 'USER_UPDATED',
    details: JSON.stringify({ targetUserId: userId, changedBy: user.id }),
  });

  revalidatePath('/app/users');
  return { success: true };
}

/**
 * Invite user to organization (with email)
 */
export async function inviteUserAction(data: {
  orgId: string;
  email: string;
  name?: string;
  role: CustomerRole;
}) {
  const inviter = await requireInternalRole();
  
  const email = z.string().email().parse(data.email);
  const orgId = z.string().uuid().parse(data.orgId);

  const { invitation, invitationLink } = await createInvitation({
    orgId,
    email,
    role: data.role,
    invitedBy: inviter.id,
  });

  await logAudit({
    userId: inviter.id,
    orgId,
    action: 'USER_INVITED',
    details: JSON.stringify({ email, role: data.role }),
  });

  revalidatePath(`/app/organizations/${orgId}`);
  revalidatePath('/app/users');
  
  return { invitationId: invitation.id, invitationLink };
}

/**
 * Create invitation link (without sending email)
 */
export async function createInvitationLinkAction(data: {
  orgId: string;
  email: string;
  role: CustomerRole;
}) {
  const inviter = await requireInternalRole();
  
  const email = z.string().email().parse(data.email);
  const orgId = z.string().uuid().parse(data.orgId);

  const { invitation, invitationLink } = await createInvitationLink({
    orgId,
    email,
    role: data.role,
    invitedBy: inviter.id,
  });

  await logAudit({
    userId: inviter.id,
    orgId,
    action: 'USER_INVITED',
    details: JSON.stringify({ email, role: data.role }),
  });

  revalidatePath(`/app/organizations/${orgId}`);
  revalidatePath('/app/users');
  
  return { invitationId: invitation.id, invitationLink };
}

/**
 * Cancel an invitation
 */
export async function cancelInvitationAction(invitationId: string, orgId: string) {
  await requireInternalRole();
  await cancelInvitation(invitationId, orgId);
  revalidatePath(`/app/organizations/${orgId}`);
  revalidatePath('/app/users');
  return { success: true };
}

/**
 * Resend invitation email
 */
export async function resendInvitationAction(invitationId: string) {
  await requireInternalRole();
  await resendInvitationEmail(invitationId);
  revalidatePath('/app/users');
  revalidatePath('/app/organizations');
  return { success: true };
}

/**
 * Remove user from organization
 */
export async function removeUserFromOrgAction(userId: string, orgId: string) {
  const user = await requireInternalRole();

  await db
    .delete(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)));

  await logAudit({
    userId: user.id,
    orgId,
    action: 'USER_UPDATED',
    details: JSON.stringify({ targetUserId: userId }),
  });

  revalidatePath(`/app/organizations/${orgId}`);
  revalidatePath('/app/users');
  
  return { success: true };
}

/**
 * Update user role in organization
 */
export async function updateUserRoleAction(data: {
  orgId: string;
  userId: string;
  role: CustomerRole;
}) {
  const user = await requireInternalRole();

  await db
    .update(memberships)
    .set({ role: data.role })
    .where(
      and(
        eq(memberships.userId, data.userId),
        eq(memberships.orgId, data.orgId)
      )
    );

  await logAudit({
    userId: user.id,
    orgId: data.orgId,
    action: 'USER_ROLE_CHANGED',
    details: JSON.stringify({ targetUserId: data.userId, newRole: data.role }),
  });

  revalidatePath(`/app/organizations/${data.orgId}`);
  revalidatePath('/app/users');
  
  return { success: true };
}

/**
 * Update user information (name, email, phone, jobTitle, department, notes, managerId)
 */
export async function updateUserInfoAction(data: {
  userId: string;
  name: string | null;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  notes?: string | null;
  managerId?: string | null;
}) {
  const user = await requireInternalRole();

  const emailSchema = z.string().email();
  const validatedEmail = emailSchema.parse(data.email);

  // Check if email is already taken by another user
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, validatedEmail),
  });

  if (existingUser && existingUser.id !== data.userId) {
    throw new Error('Email is already in use by another user');
  }

  // Validate managerId if provided (must be an internal user)
  let validatedManagerId: string | null = null;
  if (data.managerId) {
    const managerUser = await db.query.users.findFirst({
      where: eq(users.id, data.managerId),
    });
    if (!managerUser) {
      throw new Error('Manager user not found');
    }
    if (!managerUser.isInternal) {
      throw new Error('Manager must be an internal user');
    }
    if (data.managerId === data.userId) {
      throw new Error('User cannot be their own manager');
    }
    validatedManagerId = data.managerId;
  }

  await db
    .update(users)
    .set({
      name: data.name || null,
      email: validatedEmail,
      phone: data.phone || null,
      jobTitle: data.jobTitle || null,
      department: data.department || null,
      notes: data.notes || null,
      managerId: validatedManagerId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, data.userId));

  await logAudit({
    userId: user.id,
    action: 'USER_UPDATED',
    details: JSON.stringify({ targetUserId: data.userId, email: validatedEmail }),
  });

  revalidatePath('/app/users');
  revalidatePath('/app/organizations');
  
  return { success: true };
}

/**
 * Get all users (admin only)
 */
export async function getAllUsersAction() {
  await requireInternalRole();

  // Get all users
  const allUsers = await db
    .select()
    .from(users)
    .orderBy(asc(users.email));

  // Get memberships for all users
  const allMemberships = await db
    .select({
      membershipId: memberships.id,
      userId: memberships.userId,
      orgId: memberships.orgId,
      role: memberships.role,
      orgName: organizations.name,
      orgId2: organizations.id,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id));

  // Group memberships by user
  const membershipsByUser = new Map<string, typeof allMemberships>();
  for (const membership of allMemberships) {
    if (!membershipsByUser.has(membership.userId)) {
      membershipsByUser.set(membership.userId, []);
    }
    membershipsByUser.get(membership.userId)!.push(membership);
  }

  // Combine users with their memberships
  return allUsers.map((user) => ({
    ...user,
    memberships: (membershipsByUser.get(user.id) || []).map((m) => ({
      role: m.role,
      organization: {
        id: m.orgId2,
        name: m.orgName,
      },
    })),
  }));
}

/**
 * Get all internal users (for manager selection, etc.)
 */
export async function getInternalUsersAction() {
  await requireInternalRole();

  const internalUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      jobTitle: users.jobTitle,
      department: users.department,
    })
    .from(users)
    .where(eq(users.isInternal, true))
    .orderBy(asc(users.email));

  return internalUsers;
}

/**
 * Create a new user directly (admin only)
 * This creates the user immediately without sending an invitation
 */
export async function createUserAction(data: {
  email: string;
  name: string;
  password: string;
  isInternal: boolean;
  orgId?: string;
  role?: CustomerRole;
}) {
  const admin = await requireInternalRole();
  const bcrypt = await import('bcryptjs');

  // Validate inputs
  const emailSchema = z.string().email();
  const validatedEmail = emailSchema.parse(data.email);
  
  if (!data.name || data.name.trim().length < 2) {
    throw new Error('Name must be at least 2 characters');
  }
  
  if (!data.password || data.password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Check if email already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, validatedEmail),
  });

  if (existingUser) {
    throw new Error('A user with this email already exists');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(data.password, 10);

  // Create user
  const [newUser] = await db
    .insert(users)
    .values({
      email: validatedEmail,
      name: data.name.trim(),
      passwordHash,
      isInternal: data.isInternal,
      emailVerified: new Date(), // Auto-verify since admin is creating
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!newUser) {
    throw new Error('Failed to create user');
  }

  // If orgId and role provided, create membership
  if (data.orgId && data.role) {
    await db
      .insert(memberships)
      .values({
        userId: newUser.id,
        orgId: data.orgId,
        role: data.role,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  }

  await logAudit({
    userId: admin.id,
    action: 'USER_CREATED',
    details: JSON.stringify({ 
      targetUserId: newUser.id, 
      email: validatedEmail,
      isInternal: data.isInternal,
      orgId: data.orgId,
    }),
  });

  revalidatePath('/app/users');
  if (data.orgId) {
    revalidatePath(`/app/organizations/${data.orgId}`);
  }

  return { 
    success: true, 
    userId: newUser.id,
    email: newUser.email,
  };
}

/**
 * Get organization members with details
 * @param orgId - Organization ID
 * @param includeInternal - Whether to include internal users (default: false)
 */
export async function getOrganizationMembersAction(orgId: string, includeInternal = false) {
  await requireInternalRole();

  const whereClause = includeInternal
    ? eq(memberships.orgId, orgId)
    : and(eq(memberships.orgId, orgId), eq(users.isInternal, false));

  const members = await db
    .select({
      id: memberships.id,
      userId: memberships.userId,
      orgId: memberships.orgId,
      role: memberships.role,
      createdAt: memberships.createdAt,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        jobTitle: users.jobTitle,
        department: users.department,
        notes: users.notes,
        managerId: users.managerId,
        isInternal: users.isInternal,
        createdAt: users.createdAt,
      },
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(whereClause)
    .orderBy(asc(memberships.createdAt));

  return members.map((m) => ({
    id: m.id,
    role: m.role,
    createdAt: m.createdAt,
    user: m.user,
  }));
}
