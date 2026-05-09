/**
 * Zabbix Sync Cron Job
 *
 * This endpoint is designed to be called by a cron job (e.g., Vercel Cron)
 * to periodically sync all organizations' Zabbix data.
 *
 * Set up a cron job to call:
 *   GET /api/cron/zabbix-sync
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Default schedule: Every 6 hours (Vercel Hobby plan limitation)
 * For more frequent syncs, use an external cron service or upgrade to Pro
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { zabbixConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { syncOrgServices } from '@/lib/zabbix/sync';
import { verifyCronAuth } from '@/lib/auth/cron';

export async function GET(request: NextRequest) {
  // Fail-closed: rejects if CRON_SECRET not set or header mismatch.
  const rejection = verifyCronAuth(request);
  if (rejection) return rejection;

  try {

    // Get all active Zabbix configurations
    const configs = await db.query.zabbixConfigs.findMany({
      where: eq(zabbixConfigs.isActive, true),
    });

    const results = [];

    for (const config of configs) {
      try {
        // Check if it's time to sync based on syncIntervalMinutes
        const lastSync = config.lastSyncedAt;
        const intervalMs = (config.syncIntervalMinutes || 5) * 60 * 1000;
        
        if (lastSync && new Date().getTime() - new Date(lastSync).getTime() < intervalMs) {
          results.push({
            orgId: config.orgId,
            status: 'skipped',
            reason: 'Too soon since last sync',
          });
          continue;
        }

        // Sync the organization
        const syncResults = await syncOrgServices(config.orgId);
        
        results.push({
          orgId: config.orgId,
          status: 'success',
          syncedServices: syncResults.length,
        });
      } catch (error) {
        console.error(`[Zabbix Cron] Failed to sync org ${config.orgId}:`, error);
        results.push({
          orgId: config.orgId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      totalConfigs: configs.length,
      results,
    });
  } catch (error) {
    console.error('[Zabbix Sync Cron] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
