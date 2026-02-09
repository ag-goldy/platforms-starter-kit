import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  createWebhook,
  getOrgWebhooks,
  getOrgWebhookStats,
  testWebhook,
} from '@/lib/webhooks/queries';
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

    const includeStats = searchParams.get('stats') === 'true';

    const [webhooks, stats] = await Promise.all([
      getOrgWebhooks(orgId),
      includeStats ? getOrgWebhookStats(orgId) : null,
    ]);

    return NextResponse.json({ webhooks, stats });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhooks' },
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
    const { action } = body;

    if (action === 'test') {
      const { webhookId } = body;
      if (!webhookId) {
        return NextResponse.json(
          { error: 'Webhook ID required' },
          { status: 400 }
        );
      }
      const result = await testWebhook(webhookId);
      return NextResponse.json(result);
    }

    // Create webhook
    const {
      orgId,
      name,
      url,
      events,
      secret,
      filterConditions,
      customHeaders,
      maxRetries,
    } = body;

    if (!orgId || !name || !url || !events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: 'Required fields missing' },
        { status: 400 }
      );
    }

    const hasAccess = await requireOrgAccess(session.user.id, orgId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { webhook, secret: generatedSecret } = await createWebhook({
      orgId,
      name,
      url,
      events,
      secret,
      filterConditions,
      customHeaders,
      maxRetries,
      createdBy: session.user.id,
    });

    return NextResponse.json({ webhook, secret: generatedSecret });
  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 }
    );
  }
}
