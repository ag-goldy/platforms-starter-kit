import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is internal
        if (!session.user.isInternal) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { orgId, policy } = body;

        if (!orgId) {
            return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
        }

        // Verify org exists
        const org = await db.query.organizations.findFirst({
            where: eq(organizations.id, orgId),
        });

        if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        // Update SLA policy
        await db
            .update(organizations)
            .set({
                slaResponseHoursP1: policy.slaResponseHoursP1,
                slaResponseHoursP2: policy.slaResponseHoursP2,
                slaResponseHoursP3: policy.slaResponseHoursP3,
                slaResponseHoursP4: policy.slaResponseHoursP4,
                slaResolutionHoursP1: policy.slaResolutionHoursP1,
                slaResolutionHoursP2: policy.slaResolutionHoursP2,
                slaResolutionHoursP3: policy.slaResolutionHoursP3,
                slaResolutionHoursP4: policy.slaResolutionHoursP4,
                updatedAt: new Date(),
            })
            .where(eq(organizations.id, orgId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving SLA policy:', error);
        return NextResponse.json(
            { error: 'Failed to save SLA policy' },
            { status: 500 }
        );
    }
}
