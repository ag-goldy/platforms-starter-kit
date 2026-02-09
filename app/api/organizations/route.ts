import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { auth } from '@/auth';

// GET /api/organizations - List all organizations
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        subdomain: organizations.subdomain,
      })
      .from(organizations)
      .orderBy(asc(organizations.name));

    return NextResponse.json({ organizations: orgs });
  } catch (error) {
    console.error('Failed to fetch organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}
