import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getWebhookById, getWebhookDeliveries } from '@/lib/webhooks/queries';
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
    const webhook = await getWebhookById(id);

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const hasAccess = await requireOrgAccess(session.user.id, webhook.orgId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const success = searchParams.get('success');

    const deliveries = await getWebhookDeliveries(id, {
      limit,
      offset,
      success: success === 'true' ? true : success === 'false' ? false : undefined,
    });

    return NextResponse.json({ deliveries });
  } catch (error) {
    console.error('Error fetching webhook deliveries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deliveries' },
      { status: 500 }
    );
  }
}
