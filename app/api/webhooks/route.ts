import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { webhookSubscriptions } from '@/db/schema-extensions';
import { eq } from 'drizzle-orm';
import { requireInternalRole } from '@/lib/auth/permissions';

// GET - List webhooks
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requireInternalRole();

    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'orgId required' }, { status: 400 });
    }

    const webhooks = await db.query.webhookSubscriptions.findMany({
      where: eq(webhookSubscriptions.orgId, orgId),
      orderBy: (webhooks, { desc }) => [desc(webhooks.createdAt)],
    });

    // Remove secrets from response
    const sanitized = webhooks.map(w => ({
      ...w,
      secret: w.secret ? '***' : undefined,
    }));

    return NextResponse.json({ webhooks: sanitized });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhooks' },
      { status: 500 }
    );
  }
}

// POST - Create webhook
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requireInternalRole();

    const {
      orgId,
      name,
      url: webhookUrl,
      events,
      secret,
      retryCount,
      timeoutSeconds,
      customHeaders,
    } = await req.json();

    if (!orgId || !name || !webhookUrl || !events || events.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(webhookUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }

    const webhook = await db
      .insert(webhookSubscriptions)
      .values({
        orgId,
        name,
        url: webhookUrl,
        events,
        secret,
        retryCount: retryCount || 3,
        timeoutSeconds: timeoutSeconds || 30,
        customHeaders,
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json({ webhook: webhook[0] });
  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 }
    );
  }
}
