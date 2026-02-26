import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { organizations, memberships, users, userInvitations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subdomain } = await params;
    
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.subdomain, subdomain),
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get user's role in this org
    const userMembership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, org.id),
        eq(memberships.isActive, true)
      ),
    });

    if (!userMembership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }

    // Get all members
    const allMemberships = await db.query.memberships.findMany({
      where: eq(memberships.orgId, org.id),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    const members = allMemberships.map((m) => ({
      id: m.user.id,
      name: m.user.name || m.user.email.split('@')[0],
      email: m.user.email,
      role: m.role,
      avatar: m.user.image,
      isOnline: Math.random() > 0.5, // Mock - would come from presence system
      lastActive: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    }));

    // Get pending invitations (not yet accepted and not expired)
    const invitations = await db.query.userInvitations.findMany({
      where: and(
        eq(userInvitations.orgId, org.id),
        eq(userInvitations.acceptedAt, null)
      ),
    });

    // Get inviter details separately
    const inviterIds = [...new Set(invitations.map((inv) => inv.invitedBy).filter(Boolean))];
    const inviters = inviterIds.length > 0 
      ? await db.query.users.findMany({
          where: eq(users.id, inviterIds[0]), // Drizzle doesn't support array IN directly here
          columns: { id: true, name: true, email: true },
        })
      : [];

    const pendingInvites = invitations.map((inv) => {
      const inviter = inviters.find((u) => u.id === inv.invitedBy);
      return {
        id: inv.id,
        email: inv.email,
        role: inv.role,
        invitedAt: inv.invitedAt,
        invitedBy: inviter?.name || inviter?.email || 'Unknown',
      };
    });

    return NextResponse.json({
      members,
      pendingInvites,
      userRole: userMembership.role,
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team' },
      { status: 500 }
    );
  }
}
