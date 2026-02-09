/**
 * Zabbix Webhook Receiver
 * 
 * Receives webhooks from the VPS relay and updates service status immediately.
 * This provides near real-time updates when Zabbix triggers change.
 * 
 * Webhook Flow:
 * Zabbix (status change) → VPS Relay → This Endpoint → Database Update
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { services } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { updateServiceMonitoring, addMonitoringHistory } from '@/lib/zabbix/queries';
import { revalidatePath } from 'next/cache';

interface ZabbixWebhookPayload {
  host?: string;
  hostId?: string;
  trigger?: string;
  triggerId?: string;
  status?: string; // 'PROBLEM' or 'OK'
  severity?: string;
  eventId?: string;
  timestamp?: string;
  value?: string; // '0' = OK, '1' = PROBLEM
  raw?: Record<string, unknown>;
}

// Simple in-memory rate limiting
const rateLimiter = new Map<string, number>();
const RATE_LIMIT_WINDOW = 1000; // 1 second

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const lastRequest = rateLimiter.get(key);
  
  if (lastRequest && now - lastRequest < RATE_LIMIT_WINDOW) {
    return true;
  }
  
  rateLimiter.set(key, now);
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Optional: Verify webhook secret
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret) {
      const receivedSecret = request.headers.get('X-Webhook-Secret');
      if (receivedSecret !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Parse payload
    const payload: ZabbixWebhookPayload = await request.json();
    
    console.log('[Zabbix Webhook] Received:', {
      host: payload.host,
      trigger: payload.trigger,
      status: payload.status,
      severity: payload.severity,
    });

    // Find service by Zabbix host ID or host name
    const service = await db.query.services.findFirst({
      where: and(
        payload.hostId 
          ? eq(services.zabbixHostId, payload.hostId)
          : eq(services.zabbixHostName, payload.host || '')
      ),
    });

    if (!service) {
      console.warn('[Zabbix Webhook] No service found for host:', payload.host || payload.hostId);
      return NextResponse.json({ 
        received: true, 
        processed: false, 
        reason: 'Service not found' 
      });
    }

    // Rate limit per service
    if (isRateLimited(service.id)) {
      return NextResponse.json({ 
        received: true, 
        processed: false, 
        reason: 'Rate limited' 
      });
    }

    // Determine status from payload
    let monitoringStatus = service.monitoringStatus || 'UNKNOWN';
    
    if (payload.status === 'PROBLEM' || payload.value === '1') {
      // Map severity to status
      switch (payload.severity) {
        case '5': // Disaster
        case '4': // High
          monitoringStatus = 'CRITICAL';
          break;
        case '3': // Average
          monitoringStatus = 'DEGRADED';
          break;
        case '2': // Warning
        case '1': // Information
          monitoringStatus = 'MINOR_ISSUES';
          break;
        default:
          monitoringStatus = 'DEGRADED';
      }
    } else if (payload.status === 'OK' || payload.value === '0') {
      monitoringStatus = 'OPERATIONAL';
    }

    // Update service immediately
    await updateServiceMonitoring(service.id, {
      monitoringStatus,
      lastSyncedAt: new Date(),
    });

    // Add to history
    await addMonitoringHistory(service.id, {
      status: monitoringStatus,
      details: {
        source: 'webhook',
        trigger: payload.trigger,
        severity: payload.severity,
        eventId: payload.eventId,
        host: payload.host,
      },
    });

    // Revalidate the services page to show updated data
    revalidatePath('/s/[subdomain]/services');
    revalidatePath('/app/services');

    console.log('[Zabbix Webhook] Updated service:', {
      serviceId: service.id,
      serviceName: service.name,
      newStatus: monitoringStatus,
    });

    return NextResponse.json({
      received: true,
      processed: true,
      serviceId: service.id,
      status: monitoringStatus,
    });

  } catch (error) {
    console.error('[Zabbix Webhook] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'zabbix-webhook-receiver',
    timestamp: new Date().toISOString(),
  });
}
