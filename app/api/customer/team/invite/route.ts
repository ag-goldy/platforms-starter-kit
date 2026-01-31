import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { memberships, userInvitations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createInvitation } from '@/lib/users/invitations';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { orgId, email, role } = body;

        if (!orgId || !email || !role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify the user is a CUSTOMER_ADMIN of this org
        const membership = await db.query.memberships.findFirst({
            where: and(
                eq(memberships.userId, session.user.id),
                eq(memberships.orgId, orgId),
                eq(memberships.isActive, true)
            ),
        });

        if (!membership || membership.role !== 'CUSTOMER_ADMIN') {
            return NextResponse.json(
                { error: 'Only organization admins can invite members' },
                { status: 403 }
            );
        }

        // Validate role - customers can only invite REQUESTER or VIEWER
        if (!['REQUESTER', 'VIEWER'].includes(role)) {
            return NextResponse.json(
                { error: 'Invalid role. You can only invite Requesters or Viewers.' },
                { status: 400 }
            );
        }

        const { invitation } = await createInvitation({
            orgId,
            email: email.toLowerCase(),
            role,
            invitedBy: session.user.id,
        });

        return NextResponse.json({
            success: true,
            invitation: {
                id: invitation.id,
                email: invitation.email,
                role: invitation.role,
                expiresAt: invitation.expiresAt,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to send invitation';
        if (message.includes('already')) {
            return NextResponse.json({ error: message }, { status: 400 });
        }

        console.error('Error sending invitation:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { invitationId } = body;

        if (!invitationId) {
            return NextResponse.json({ error: 'Invitation ID required' }, { status: 400 });
        }

        // Get the invitation
        const invitation = await db.query.userInvitations.findFirst({
            where: eq(userInvitations.id, invitationId),
        });

        if (!invitation) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        }

        // Verify the user is a CUSTOMER_ADMIN of this org
        const membership = await db.query.memberships.findFirst({
            where: and(
                eq(memberships.userId, session.user.id),
                eq(memberships.orgId, invitation.orgId),
                eq(memberships.isActive, true)
            ),
        });

        if (!membership || membership.role !== 'CUSTOMER_ADMIN') {
            return NextResponse.json(
                { error: 'Only organization admins can cancel invitations' },
                { status: 403 }
            );
        }

        // Delete the invitation
        await db.delete(userInvitations).where(eq(userInvitations.id, invitationId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error cancelling invitation:', error);
        return NextResponse.json(
            { error: 'Failed to cancel invitation' },
            { status: 500 }
        );
    }
}
