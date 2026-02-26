import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { organizations, memberships, userInvitations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// DELETE /api/team/[subdomain]/invites/[inviteId] - Cancel an invitation
export async function DELETE(
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

    // Delete the invitation
    await db.delete(userInvitations).where(
      and(
        eq(userInvitations.id, inviteId),
        eq(userInvitations.orgId, org.id)
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error canceling invitation:', error);
    return NextResponse.json(
      { error: 'Failed to cancel invitation' },
      { status: 500 }
    );
  }
}
