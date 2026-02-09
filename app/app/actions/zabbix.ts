'use server';

import { revalidatePath } from 'next/cache';
import { createOrUpdateZabbixConfig, updateServiceMonitoring, getZabbixConfigByOrgId } from '@/lib/zabbix/queries';
import { syncOrgServices, syncSingleService } from '@/lib/zabbix/sync';

interface ZabbixConfigInput {
  apiUrl: string;
  apiToken: string;
  syncIntervalMinutes?: number;
}

export async function saveZabbixConfig(
  orgId: string,
  config: ZabbixConfigInput
) {
  try {
    const result = await createOrUpdateZabbixConfig(orgId, config);
    revalidatePath('/app/settings');
    return { success: true, data: result };
  } catch (error) {
    console.error('[saveZabbixConfig] Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to save configuration' 
    };
  }
}

export async function linkServiceToZabbixHost(
  serviceId: string,
  zabbixHostId: string,
  enableMonitoring: boolean = true
) {
  try {
    const result = await updateServiceMonitoring(serviceId, {
      zabbixHostId,
      monitoringEnabled: enableMonitoring,
    });
    
    // Trigger immediate sync
    const service = result;
    if (service.orgId && enableMonitoring) {
      try {
        await syncSingleService(service.orgId, serviceId);
      } catch (syncError) {
        console.warn('[linkServiceToZabbixHost] Initial sync failed:', syncError);
        // Don't fail the whole operation if sync fails
      }
    }
    
    revalidatePath('/app/services');
    return { success: true, data: result };
  } catch (error) {
    console.error('[linkServiceToZabbixHost] Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to link service' 
    };
  }
}

export async function toggleServiceMonitoring(
  serviceId: string,
  enabled: boolean
) {
  try {
    const result = await updateServiceMonitoring(serviceId, {
      monitoringEnabled: enabled,
    });
    
    revalidatePath('/app/services');
    return { success: true, data: result };
  } catch (error) {
    console.error('[toggleServiceMonitoring] Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to toggle monitoring' 
    };
  }
}

export async function triggerZabbixSync(orgId: string, serviceId?: string) {
  try {
    if (serviceId) {
      const result = await syncSingleService(orgId, serviceId);
      revalidatePath('/app/services');
      return { success: true, data: [result] };
    } else {
      const results = await syncOrgServices(orgId);
      revalidatePath('/app/services');
      return { success: true, data: results };
    }
  } catch (error) {
    console.error('[triggerZabbixSync] Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Sync failed' 
    };
  }
}

export async function getZabbixConfig(orgId: string) {
  try {
    const config = await getZabbixConfigByOrgId(orgId);
    return { success: true, data: config };
  } catch (error) {
    console.error('[getZabbixConfig] Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get configuration' 
    };
  }
}
