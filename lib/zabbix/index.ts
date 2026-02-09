// Zabbix Integration Library

export { ZabbixClient } from './client';
export type { 
  ZabbixApiConfig, 
  ZabbixHost, 
  ZabbixTrigger, 
  ZabbixItem, 
  ZabbixHistory 
} from './client';

export {
  getZabbixConfigByOrgId,
  createOrUpdateZabbixConfig,
  deleteZabbixConfig,
  getServicesWithMonitoring,
  getServiceById,
  updateServiceMonitoring,
  addMonitoringHistory,
  getMonitoringHistory,
  getLatestMonitoringStatus,
} from './queries';

export {
  syncOrgServices,
  syncSingleService,
} from './sync';

export type { SyncResult } from './sync';
