import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/organizations/branding?slug=xxx - Get org branding by subdomain
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json(
        { error: 'Organization slug is required' },
        { status: 400 }
      );
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.subdomain, slug),
      columns: {
        id: true,
        name: true,
        slug: true,
        branding: true,
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ organization: org });
  } catch (error) {
    console.error('Failed to fetch organization branding:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization branding' },
      { status: 500 }
    );
  }
}

// PATCH /api/organizations/branding - Update org branding
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, nameOverride, logoUrl, primaryColor } = body;

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Get current branding
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { branding: true },
    });

    const currentBranding = (org?.branding as Record<string, string | null>) || {};

    // Update branding
    const [updated] = await db
      .update(organizations)
      .set({
        branding: {
          ...currentBranding,
          ...(nameOverride !== undefined && { nameOverride }),
          ...(logoUrl !== undefined && { logoUrl }),
          ...(primaryColor !== undefined && { primaryColor }),
        },
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId))
      .returning({
        id: organizations.id,
        name: organizations.name,
        branding: organizations.branding,
      });

    return NextResponse.json({ organization: updated });
  } catch (error) {
    console.error('Failed to update organization branding:', error);
    return NextResponse.json(
      { error: 'Failed to update organization branding' },
      { status: 500 }
    );
  }
}
