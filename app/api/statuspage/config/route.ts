/**
 * Statuspage.io Configuration API
 * 
 * GET  - Get current statuspage config for org
 * POST - Create/update statuspage config
 * DELETE - Remove statuspage integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { statuspageConfigs, StatuspageConfig } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { StatuspageClient } from '@/lib/integrations/statuspage/client';
import { canManageOrgSettings } from '@/lib/auth/permissions';

const configSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  pageId: z.string().optional(),
  pageUrl: z.string().url().optional().or(z.literal('')),
  autoSyncServices: z.boolean().default(false),
  autoCreateIncidents: z.boolean().default(false),
});

// GET /api/statuspage/config
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    const canManage = await canManageOrgSettings(session.user.id, session.user.orgId);
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const config = await db.query.statuspageConfigs?.findFirst({
      where: eq(statuspageConfigs.orgId, session.user.orgId),
    });

    if (!config) {
      return NextResponse.json({ config: null });
    }

    // Don't return the full API key
    const sanitizedConfig = {
      ...config,
      apiKey: config.apiKey ? `${config.apiKey.slice(0, 8)}...${config.apiKey.slice(-4)}` : null,
    };

    return NextResponse.json({ config: sanitizedConfig });
  } catch (error) {
    console.error('Error fetching statuspage config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/statuspage/config
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    const canManage = await canManageOrgSettings(session.user.id, session.user.orgId);
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validated = configSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const { apiKey, pageId, pageUrl, autoSyncServices, autoCreateIncidents } = validated.data;

    // Validate API key by testing it
    let validatedPageId = pageId;
    try {
      const testClient = new StatuspageClient({ apiKey, pageId });
      const pages = await testClient.listPages();
      
      // If no pageId provided but API key is valid, use first page
      if (!validatedPageId && pages.length > 0) {
        validatedPageId = pages[0].id;
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid Statuspage API key' },
        { status: 400 }
      );
    }

    // Upsert config
    const existing = await db.query.statuspageConfigs?.findFirst({
      where: eq(statuspageConfigs.orgId, session.user.orgId),
    });

    let config: StatuspageConfig;
    if (existing) {
      const [updated] = await db
        .update(statuspageConfigs)
        .set({
          apiKey,
          pageId: validatedPageId || existing.pageId,
          pageUrl: pageUrl || existing.pageUrl,
          autoSyncServices,
          autoCreateIncidents,
          updatedAt: new Date(),
        })
        .where(eq(statuspageConfigs.id, existing.id))
        .returning();
      config = updated;
    } else {
      const [created] = await db
        .insert(statuspageConfigs)
        .values({
          orgId: session.user.orgId,
          apiKey,
          pageId: validatedPageId,
          pageUrl: pageUrl || null,
          autoSyncServices,
          autoCreateIncidents,
          componentMappings: {},
        })
        .returning();
      config = created;
    }

    // Sanitize response
    const sanitizedConfig = {
      ...config,
      apiKey: config.apiKey ? `${config.apiKey.slice(0, 8)}...${config.apiKey.slice(-4)}` : null,
    };

    return NextResponse.json({ config: sanitizedConfig });
  } catch (error) {
    console.error('Error saving statuspage config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/statuspage/config
export async function DELETE(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    const canManage = await canManageOrgSettings(session.user.id, session.user.orgId);
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db
      .delete(statuspageConfigs)
      .where(eq(statuspageConfigs.orgId, session.user.orgId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting statuspage config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
