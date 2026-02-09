/**
 * Test Zabbix Connection
 * POST /api/zabbix/test
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZabbixClient } from '@/lib/zabbix/client';

export async function POST(request: NextRequest) {
  try {
    const { apiUrl, apiToken } = await request.json();

    if (!apiUrl || !apiToken) {
      return NextResponse.json(
        { error: 'API URL and token are required' },
        { status: 400 }
      );
    }

    const client = new ZabbixClient({ apiUrl, apiToken });
    const result = await client.testConnection();

    if (result.success) {
      return NextResponse.json({
        success: true,
        version: result.version,
        message: `Connected to Zabbix ${result.version}`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[Zabbix Test API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Test failed' },
      { status: 500 }
    );
  }
}
