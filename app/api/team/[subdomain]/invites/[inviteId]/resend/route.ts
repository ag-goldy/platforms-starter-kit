import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { organizations, memberships, userInvitations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// POST /api/team/[subdomain]/invites/[inviteId]/resend - Resend an invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string; inviteId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subdomain, inviteId } = await params;

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

    // Get the invitation
    const invitation = await db.query.userInvitations.findFirst({
      where: and(
        eq(userInvitations.id, inviteId),
        eq(userInvitations.orgId, org.id)
      ),
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Update the invitedAt timestamp to now
    const [updated] = await db
      .update(userInvitations)
      .set({
        invitedAt: new Date(),
        invitedBy: session.user.id,
      })
      .where(eq(userInvitations.id, inviteId))
      .returning();

    // TODO: Send email notification
    // await sendInvitationEmail(updated.email, org.name, updated.token);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error resending invitation:', error);
    return NextResponse.json(
      { error: 'Failed to resend invitation' },
      { status: 500 }
    );
  }
}
