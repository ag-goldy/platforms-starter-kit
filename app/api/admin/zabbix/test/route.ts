import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/permissions';
import { z } from 'zod';

const testSchema = z.object({
  apiUrl: z.string().url(),
  apiToken: z.string().min(1),
});

// POST /api/admin/zabbix/test - Test Zabbix connection
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    const { apiUrl, apiToken } = testSchema.parse(body);

    // Test connection to Zabbix API
    const testResult = await testZabbixConnection(apiUrl, apiToken);

    return NextResponse.json(testResult);
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
    console.error('Zabbix test connection error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection test failed' 
      },
      { status: 500 }
    );
  }
}

async function testZabbixConnection(apiUrl: string, apiToken: string) {
  try {
    // Ensure URL ends with /api_jsonrpc.php
    const baseUrl = apiUrl.replace(/\/api_jsonrpc\.php$/, '').replace(/\/$/, '');
    const rpcUrl = `${baseUrl}/api_jsonrpc.php`;

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'apiinfo.version',
        params: {},
        id: 1,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP error: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        error: `Zabbix API error: ${data.error.message}`,
        code: data.error.code,
      };
    }

    // Now test authentication with the token
    const authResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'user.checkAuthentication',
        params: {},
        id: 2,
      }),
    });

    const authData = await authResponse.json();

    if (authData.error) {
      return {
        success: false,
        error: `Authentication failed: ${authData.error.message}`,
        code: authData.error.code,
        version: data.result,
      };
    }

    // Get host count to verify permissions
    const hostResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'host.get',
        params: {
          countOutput: true,
        },
        id: 3,
      }),
    });

    const hostData = await hostResponse.json();
    const hostCount = hostData.result || 0;

    return {
      success: true,
      version: data.result,
      user: authData.result,
      hostCount,
      message: `Connected to Zabbix ${data.result}. Found ${hostCount} hosts.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}
