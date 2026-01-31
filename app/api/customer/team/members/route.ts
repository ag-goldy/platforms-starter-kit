import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { memberships } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { revokeAllUserSessions } from '@/lib/auth/sessions';
import { logAudit } from '@/lib/audit/log';

const ALLOWED_ROLES = ['CUSTOMER_ADMIN', 'REQUESTER', 'VIEWER'] as const;

async function getAdminMembership(userId: string, orgId: string) {
  return db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, userId),
      eq(memberships.orgId, orgId),
      eq(memberships.isActive, true)
    ),
  });
}

async function countAdmins(orgId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(memberships)
    .where(
      and(
        eq(memberships.orgId, orgId),
        eq(memberships.role, 'CUSTOMER_ADMIN'),
        eq(memberships.isActive, true)
      )
    );
  return Number(result?.count ?? 0);
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { membershipId, role, isActive } = body as {
      membershipId?: string;
      role?: string;
      isActive?: boolean;
    };

    if (!membershipId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const membership = await db.query.memberships.findFirst({
      where: eq(memberships.id, membershipId),
    });

    if (!membership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const adminMembership = await getAdminMembership(session.user.id, membership.orgId);
    if (!adminMembership || adminMembership.role !== 'CUSTOMER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (typeof isActive === 'boolean') {
      if (!isActive && membership.userId === session.user.id) {
        return NextResponse.json(
          { error: 'You cannot deactivate your own account' },
          { status: 400 }
        );
      }

      if (!isActive && membership.role === 'CUSTOMER_ADMIN') {
        const adminCount = await countAdmins(membership.orgId);
        if (adminCount <= 1) {
          return NextResponse.json(
            { error: 'At least one admin must remain in the organization' },
            { status: 400 }
          );
        }
      }

      const [updated] = await db
        .update(memberships)
        .set({
          isActive,
          deactivatedAt: isActive ? null : new Date(),
          updatedAt: new Date(),
        })
        .where(eq(memberships.id, membershipId))
        .returning();

      if (!isActive) {
        await revokeAllUserSessions(membership.userId);
        await logAudit({
          userId: session.user.id,
          orgId: membership.orgId,
          action: 'MEMBERSHIP_DEACTIVATED',
          details: JSON.stringify({
            membershipId: membership.id,
            targetUserId: membership.userId,
          }),
        });
      }

      return NextResponse.json({ success: true, membership: updated });
    }

    if (!role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const roleValue = role as (typeof ALLOWED_ROLES)[number];

    if (membership.userId === session.user.id && role !== 'CUSTOMER_ADMIN') {
      return NextResponse.json(
        { error: 'You cannot change your own admin role' },
        { status: 400 }
      );
    }

    if (membership.role === 'CUSTOMER_ADMIN' && role !== 'CUSTOMER_ADMIN') {
      const adminCount = await countAdmins(membership.orgId);
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'At least one admin must remain in the organization' },
          { status: 400 }
        );
      }
    }

    const [updated] = await db
      .update(memberships)
      .set({ role: roleValue, updatedAt: new Date() })
      .where(eq(memberships.id, membershipId))
      .returning();

    return NextResponse.json({ success: true, membership: updated });
  } catch (error) {
    console.error('Error updating member role:', error);
    return NextResponse.json(
      { error: 'Failed to update member role' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { membershipId } = body as { membershipId?: string };

    if (!membershipId) {
      return NextResponse.json({ error: 'Membership ID required' }, { status: 400 });
    }

    const membership = await db.query.memberships.findFirst({
      where: eq(memberships.id, membershipId),
    });

    if (!membership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const adminMembership = await getAdminMembership(session.user.id, membership.orgId);
    if (!adminMembership || adminMembership.role !== 'CUSTOMER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (membership.userId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account' },
        { status: 400 }
      );
    }

    if (membership.role === 'CUSTOMER_ADMIN') {
      const adminCount = await countAdmins(membership.orgId);
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'At least one admin must remain in the organization' },
          { status: 400 }
        );
      }
    }

    const [updated] = await db
      .update(memberships)
      .set({
        isActive: false,
        deactivatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(memberships.id, membershipId))
      .returning();

    await revokeAllUserSessions(membership.userId);
    await logAudit({
      userId: session.user.id,
      orgId: membership.orgId,
      action: 'MEMBERSHIP_DEACTIVATED',
      details: JSON.stringify({
        membershipId: membership.id,
        targetUserId: membership.userId,
      }),
    });

    return NextResponse.json({ success: true, membership: updated });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate member' },
      { status: 500 }
    );
  }
}
