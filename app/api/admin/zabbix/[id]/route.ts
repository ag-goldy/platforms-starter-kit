import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { zabbixConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/permissions';

// DELETE /api/admin/zabbix/[id] - Delete Zabbix configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    // Check if config exists
    const config = await db.query.zabbixConfigs.findFirst({
      where: eq(zabbixConfigs.id, id),
    });

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    // Delete the config
    await db.delete(zabbixConfigs).where(eq(zabbixConfigs.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Failed to delete Zabbix config:', error);
    return NextResponse.json(
      { error: 'Failed to delete configuration' },
      { status: 500 }
    );
  }
}
