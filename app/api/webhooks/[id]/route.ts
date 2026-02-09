import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getWebhookById,
  updateWebhook,
  deleteWebhook,
  rotateWebhookSecret,
} from '@/lib/webhooks/queries';
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

    return NextResponse.json({ webhook });
  } catch (error) {
    console.error('Error fetching webhook:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
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

    const body = await req.json();

    // Handle secret rotation
    if (body.action === 'rotate_secret') {
      const { webhook: updated, secret } = await rotateWebhookSecret(id);
      return NextResponse.json({ webhook: updated, secret });
    }

    const updated = await updateWebhook(id, body);
    return NextResponse.json({ webhook: updated });
  } catch (error) {
    console.error('Error updating webhook:', error);
    return NextResponse.json(
      { error: 'Failed to update webhook' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
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

    await deleteWebhook(id, webhook.orgId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    );
  }
}
