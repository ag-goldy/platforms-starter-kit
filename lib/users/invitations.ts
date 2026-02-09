/**
 * User invitation management
 */

import crypto from 'crypto';
import { db } from '@/db';
import { userInvitations, users, memberships, organizations } from '@/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { sendInvitationEmail } from '@/lib/email/invitations';
import { appBaseUrl } from '@/lib/utils';

export interface InvitationData {
  orgId: string;
  email: string;
  role: 'CUSTOMER_ADMIN' | 'REQUESTER' | 'VIEWER';
  invitedBy: string;
}

/**
 * Generate a secure invitation token
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create an invitation with email sending
 */
export async function createInvitation(data: InvitationData): Promise<{
  invitation: typeof userInvitations.$inferSelect;
  invitationLink: string;
}> {
  // Check if user already exists and is a member
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);
  const existingUser = existingUsers[0];

  if (existingUser) {
    const existingMemberships = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, existingUser.id),
          eq(memberships.orgId, data.orgId)
        )
      )
      .limit(1);

    if (existingMemberships.length > 0) {
      throw new Error('User is already a member of this organization');
    }
  }

  // Check for pending invitation
  const pendingInvitations = await db
    .select()
    .from(userInvitations)
    .where(
      and(
        eq(userInvitations.email, data.email),
        eq(userInvitations.orgId, data.orgId),
        isNull(userInvitations.acceptedAt)
      )
    )
    .limit(1);
  const pendingInvitation = pendingInvitations[0];

  if (pendingInvitation) {
    throw new Error('An invitation is already pending for this email');
  }

  const token = generateInvitationToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  const [invitation] = await db
    .insert(userInvitations)
    .values({
      orgId: data.orgId,
      email: data.email,
      role: data.role,
      invitedBy: data.invitedBy,
      token,
      expiresAt,
    })
    .returning();

  const invitationLink = `${appBaseUrl}/invite/${token}`;

  // Send invitation email
  const orgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, data.orgId))
    .limit(1);
  const org = orgs[0];

  try {
    console.log(`[Invitation] Sending email to ${data.email}...`);
    await sendInvitationEmail({
      email: data.email,
      invitationLink,
      orgName: org?.name || 'Organization',
    });
    console.log(`[Invitation] Email sent successfully to ${data.email}`);
  } catch (error: any) {
    console.error(`[Invitation] Failed to send email to ${data.email}:`, error);
    // Still return the invitation - user can resend later
  }

  return { invitation, invitationLink };
}

/**
 * Create an invitation without sending email (for link sharing)
 */
export async function createInvitationLink(data: InvitationData): Promise<{
  invitation: typeof userInvitations.$inferSelect;
  invitationLink: string;
}> {
  const token = generateInvitationToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry for link invitations

  const [invitation] = await db
    .insert(userInvitations)
    .values({
      orgId: data.orgId,
      email: data.email,
      role: data.role,
      invitedBy: data.invitedBy,
      token,
      expiresAt,
    })
    .returning();

  const invitationLink = `${appBaseUrl}/invite/${token}`;

  return { invitation, invitationLink };
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(
  token: string,
  userData: {
    name?: string;
    password: string;
  }
): Promise<{
  userId: string;
  orgId: string;
  membershipId: string;
}> {
  const invitations = await db
    .select()
    .from(userInvitations)
    .where(
      and(
        eq(userInvitations.token, token),
        isNull(userInvitations.acceptedAt)
      )
    )
    .limit(1);
  const invitation = invitations[0];

  if (!invitation) {
    throw new Error('Invalid or expired invitation');
  }

  if (new Date() > invitation.expiresAt) {
    throw new Error('Invitation has expired');
  }

  // Find or create user
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, invitation.email))
    .limit(1);
  let user = existingUsers[0];

  if (!user) {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const newUsers = await db
      .insert(users)
      .values({
        email: invitation.email,
        name: userData.name,
        passwordHash: hashedPassword,
        isInternal: false,
      })
      .returning();
    user = newUsers[0];
  }

  // Create membership
  const [membership] = await db
    .insert(memberships)
    .values({
      userId: user.id,
      orgId: invitation.orgId,
      role: invitation.role,
    })
    .returning();

  // Mark invitation as accepted
  await db
    .update(userInvitations)
    .set({ acceptedAt: new Date() })
    .where(eq(userInvitations.id, invitation.id));

  return {
    userId: user.id,
    orgId: invitation.orgId,
    membershipId: membership.id,
  };
}

/**
 * Get pending invitations for an organization
 */
export async function getPendingInvitations(orgId: string) {
  const invitations = await db
    .select()
    .from(userInvitations)
    .where(
      and(
        eq(userInvitations.orgId, orgId),
        isNull(userInvitations.acceptedAt)
      )
    )
    .orderBy(desc(userInvitations.createdAt));

  // Fetch inviter details for each invitation
  const invitationsWithInviter = await Promise.all(
    invitations.map(async (invitation) => {
      let inviter = null;
      if (invitation.invitedBy) {
        const inviters = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, invitation.invitedBy))
          .limit(1);
        inviter = inviters[0] || null;
      }
      return {
        ...invitation,
        inviter,
      };
    })
  );

  return invitationsWithInviter;
}

/**
 * Cancel/delete an invitation
 */
export async function cancelInvitation(invitationId: string, orgId: string): Promise<void> {
  await db
    .delete(userInvitations)
    .where(and(eq(userInvitations.id, invitationId), eq(userInvitations.orgId, orgId)));
}

/**
 * Resend invitation email
 */
export async function resendInvitationEmail(invitationId: string): Promise<void> {
  const invitations = await db
    .select()
    .from(userInvitations)
    .where(eq(userInvitations.id, invitationId))
    .limit(1);
  const invitation = invitations[0];

  if (!invitation || invitation.acceptedAt) {
    throw new Error('Invitation not found or already accepted');
  }

  const orgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, invitation.orgId))
    .limit(1);
  const org = orgs[0];

  if (!org) {
    throw new Error('Organization not found');
  }

  const invitationLink = `${appBaseUrl}/invite/${invitation.token}`;

  await sendInvitationEmail({
    email: invitation.email,
    invitationLink,
    orgName: org.name,
  });
}
