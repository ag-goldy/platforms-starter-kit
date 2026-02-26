import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { organizations, memberships, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// PATCH /api/team/[subdomain]/members/[memberId] - Update member role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string; memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subdomain, memberId } = await params;
    const body = await request.json();
    const { role } = body;

    // Get organization
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.subdomain, subdomain),
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user is admin
    const adminMembership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, org.id),
        eq(memberships.isActive, true)
      ),
    });

    if (!adminMembership || (adminMembership.role !== 'CUSTOMER_ADMIN' && adminMembership.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update membership role
    const [updated] = await db
      .update(memberships)
      .set({ role })
      .where(
        and(
          eq(memberships.userId, memberId),
          eq(memberships.orgId, org.id)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    );
  }
}

// PUT /api/team/[subdomain]/members/[memberId] - Update member details
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string; memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subdomain, memberId } = await params;
    const body = await request.json();
    const { name, email, phone, department, role } = body;

    // Get organization
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.subdomain, subdomain),
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user is admin or the member themselves
    const adminMembership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, org.id),
        eq(memberships.isActive, true)
      ),
    });

    const isAdmin = adminMembership && (adminMembership.role === 'CUSTOMER_ADMIN' || adminMembership.role === 'ADMIN');
    const isSelf = session.user.id === memberId;

    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update user details
    const [updatedUser] = await db
      .update(users)
      .set({
        name,
        email,
        // phone and department would need to be added to the users table or a separate profile table
      })
      .where(eq(users.id, memberId))
      .returning();

    // Update role if provided and user is admin
    if (role && isAdmin) {
      await db
        .update(memberships)
        .set({ role })
        .where(
          and(
            eq(memberships.userId, memberId),
            eq(memberships.orgId, org.id)
          )
        );
    }

    if (!updatedUser) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: role || adminMembership?.role,
    });
  } catch (error) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    );
  }
}

// DELETE /api/team/[subdomain]/members/[memberId] - Remove member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string; memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subdomain, memberId } = await params;

    // Get organization
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.subdomain, subdomain),
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user is admin
    const adminMembership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, org.id),
        eq(memberships.isActive, true)
      ),
    });

    if (!adminMembership || (adminMembership.role !== 'CUSTOMER_ADMIN' && adminMembership.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prevent removing yourself
    if (session.user.id === memberId) {
      return NextResponse.json(
        { error: 'Cannot remove yourself' },
        { status: 400 }
      );
    }

    // Soft delete by setting isActive to false
    const [updated] = await db
      .update(memberships)
      .set({ isActive: false })
      .where(
        and(
          eq(memberships.userId, memberId),
          eq(memberships.orgId, org.id)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}
