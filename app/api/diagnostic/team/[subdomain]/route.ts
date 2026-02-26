import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { organizations, memberships, users, tickets } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const session = await auth();
    
    // 1. Current User Info
    const userInfo = session?.user ? {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    } : null;

    if (!session?.user) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        message: 'Not authenticated',
      }, { status: 401 });
    }

    const { subdomain } = await params;

    // 2. Organization Details
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.subdomain, subdomain),
    });

    if (!org) {
      return NextResponse.json({
        authenticated: true,
        user: userInfo,
        organization: null,
        membership: null,
        tickets: [],
        message: `Organization with subdomain "${subdomain}" not found`,
      }, { status: 404 });
    }

    const orgDetails = {
      id: org.id,
      name: org.name,
      slug: org.slug,
      subdomain: org.subdomain,
      features: org.features,
    };

    // 3. Membership Status
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, org.id),
        eq(memberships.isActive, true)
      ),
    });

    const membershipDetails = membership ? {
      id: membership.id,
      role: membership.role,
      isActive: membership.isActive,
      createdAt: membership.createdAt,
    } : null;

    // 4. Tickets for this organization
    let orgTickets: any[] = [];
    if (membership) {
      const ticketList = await db.query.tickets.findMany({
        where: eq(tickets.orgId, org.id),
        limit: 10,
        with: {
          requester: {
            columns: { id: true, name: true, email: true },
          },
        },
      });

      orgTickets = ticketList.map((t) => ({
        id: t.id,
        key: t.key,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        requesterId: t.requesterId,
        requesterName: t.requester?.name || t.requester?.email,
        createdAt: t.createdAt,
      }));
    }

    // 5. All memberships for this user (to see what orgs they belong to)
    const allUserMemberships = await db.query.memberships.findMany({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.isActive, true)
      ),
      with: {
        organization: {
          columns: { id: true, name: true, subdomain: true },
        },
      },
    });

    return NextResponse.json({
      authenticated: true,
      user: userInfo,
      organization: orgDetails,
      membership: membershipDetails,
      tickets: orgTickets,
      ticketCount: orgTickets.length,
      allUserOrganizations: allUserMemberships.map((m) => ({
        orgId: m.organization.id,
        name: m.organization.name,
        subdomain: m.organization.subdomain,
        role: m.role,
      })),
      message: membership 
        ? `User is a ${membership.role} of ${org.name}` 
        : `User is NOT a member of ${org.name}`,
    });

  } catch (error) {
    console.error('Diagnostic error:', error);
    return NextResponse.json({
      error: 'Diagnostic failed',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
