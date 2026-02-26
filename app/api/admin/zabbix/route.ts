import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { zabbixConfigs, organizations } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/permissions';
import { z } from 'zod';

// Schema for creating/updating Zabbix config
const zabbixConfigSchema = z.object({
  orgId: z.string().uuid(),
  apiUrl: z.string().url().min(1),
  apiToken: z.string().min(1),
  syncIntervalMinutes: z.number().min(1).max(1440).default(5),
  isActive: z.boolean().default(true),
});

// GET /api/admin/zabbix - List all Zabbix configurations
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const configs = await db
      .select({
        config: zabbixConfigs,
        org: organizations,
      })
      .from(zabbixConfigs)
      .leftJoin(organizations, eq(zabbixConfigs.orgId, organizations.id))
      .orderBy(desc(zabbixConfigs.updatedAt));

    return NextResponse.json({ configs });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Failed to fetch Zabbix configs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configurations' },
      { status: 500 }
    );
  }
}

// POST /api/admin/zabbix - Create or update Zabbix configuration
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    const data = zabbixConfigSchema.parse(body);

    // Check if config already exists for this org
    const existing = await db.query.zabbixConfigs.findFirst({
      where: eq(zabbixConfigs.orgId, data.orgId),
    });

    let config;
    if (existing) {
      // Update existing
      [config] = await db
        .update(zabbixConfigs)
        .set({
          apiUrl: data.apiUrl,
          apiToken: data.apiToken,
          syncIntervalMinutes: data.syncIntervalMinutes,
          isActive: data.isActive,
          updatedAt: new Date(),
        })
        .where(eq(zabbixConfigs.orgId, data.orgId))
        .returning();
    } else {
      // Create new
      [config] = await db
        .insert(zabbixConfigs)
        .values({
          orgId: data.orgId,
          apiUrl: data.apiUrl,
          apiToken: data.apiToken,
          syncIntervalMinutes: data.syncIntervalMinutes,
          isActive: data.isActive,
        })
        .returning();
    }

    return NextResponse.json({ config, message: 'Configuration saved successfully' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Failed to save Zabbix config:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}
