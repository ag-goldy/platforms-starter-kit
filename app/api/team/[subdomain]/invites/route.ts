import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { organizations, memberships, userInvitations, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';

// POST /api/team/[subdomain]/invites - Create a new invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subdomain } = await params;
    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      );
    }

    // Get organization
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.subdomain, subdomain),
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user is admin
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, org.id),
        eq(memberships.isActive, true)
      ),
    });

    if (!membership || (membership.role !== 'CUSTOMER_ADMIN' && membership.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existingUser) {
      // Check if already a member
      const existingMembership = await db.query.memberships.findFirst({
        where: and(
          eq(memberships.userId, existingUser.id),
          eq(memberships.orgId, org.id)
        ),
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: 'User is already a member of this organization' },
          { status: 409 }
        );
      }
    }

    // Check for existing pending invitation (not yet accepted)
    const existingInvite = await db.query.userInvitations.findFirst({
      where: and(
        eq(userInvitations.email, email.toLowerCase()),
        eq(userInvitations.orgId, org.id),
        eq(userInvitations.acceptedAt, null)
      ),
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An invitation is already pending for this email' },
        { status: 409 }
      );
    }

    // Generate invitation token
    const token = randomBytes(32).toString('hex');

    // Create invitation
    const [invitation] = await db
      .insert(userInvitations)
      .values({
        email: email.toLowerCase(),
        orgId: org.id,
        role: role,
        invitedBy: session.user.id,
        token: token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .returning();

    // TODO: Send email notification
    // await sendInvitationEmail(email, org.name, token);

    return NextResponse.json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      invitedAt: invitation.invitedAt,
      invitedBy: session.user.name || session.user.email,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}
