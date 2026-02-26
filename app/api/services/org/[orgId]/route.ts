import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { services } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    
    const orgServices = await db.query.services.findMany({
      where: eq(services.orgId, orgId),
      columns: {
        id: true,
        name: true,
        status: true,
        description: true,
      },
    });

    return NextResponse.json({
      services: orgServices,
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}
