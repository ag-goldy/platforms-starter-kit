import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  createBulkOperation,
  getOrgBulkOperations,
  processBulkOperation,
} from '@/lib/bulk-operations/queries';
import { requireOrgAccess } from '@/lib/auth/permissions';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    const hasAccess = await requireOrgAccess(session.user.id, orgId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const operations = await getOrgBulkOperations(orgId);
    return NextResponse.json({ operations });
  } catch (error) {
    console.error('Error fetching bulk operations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bulk operations' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { orgId, type, ticketIds, data, execute = true } = body;

    if (!orgId || !type || !ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
      return NextResponse.json(
        { error: 'Required fields missing' },
        { status: 400 }
      );
    }

    const hasAccess = await requireOrgAccess(session.user.id, orgId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate operation type
    const validTypes = ['assign', 'status_change', 'priority_change', 'add_tags', 'remove_tags', 'close'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid operation type' },
        { status: 400 }
      );
    }

    // Create the operation
    const operation = await createBulkOperation({
      orgId,
      userId: session.user.id,
      type,
      ticketIds,
      data,
    });

    // Execute immediately if requested
    if (execute) {
      // Run in background to not block response
      processBulkOperation(operation.id).catch(console.error);
    }

    return NextResponse.json({ operation });
  } catch (error) {
    console.error('Error creating bulk operation:', error);
    return NextResponse.json(
      { error: 'Failed to create bulk operation' },
      { status: 500 }
    );
  }
}
