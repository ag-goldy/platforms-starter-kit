import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getBulkOperationById,
  processBulkOperation,
} from '@/lib/bulk-operations/queries';
import { requireOrgAccess } from '@/lib/auth/permissions';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const operation = await getBulkOperationById(id);

    if (!operation) {
      return NextResponse.json(
        { error: 'Bulk operation not found' },
        { status: 404 }
      );
    }

    const hasAccess = await requireOrgAccess(session.user.id, operation.orgId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ operation });
  } catch (error) {
    console.error('Error fetching bulk operation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bulk operation' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const operation = await getBulkOperationById(id);

    if (!operation) {
      return NextResponse.json(
        { error: 'Bulk operation not found' },
        { status: 404 }
      );
    }

    const hasAccess = await requireOrgAccess(session.user.id, operation.orgId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (operation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Operation already processed' },
        { status: 400 }
      );
    }

    // Process the operation
    const result = await processBulkOperation(id);

    return NextResponse.json({ operation, result });
  } catch (error) {
    console.error('Error executing bulk operation:', error);
    return NextResponse.json(
      { error: 'Failed to execute bulk operation' },
      { status: 500 }
    );
  }
}
