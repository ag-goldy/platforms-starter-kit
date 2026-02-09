/**
 * Zabbix API Client
 * 
 * This client communicates with Zabbix API to fetch:
 * - Host information
 * - Trigger status
 * - Item values (for response time, uptime metrics)
 */

export interface ZabbixApiConfig {
  apiUrl: string;
  apiToken: string;
}

export interface ZabbixHost {
  hostid: string;
  host: string;
  name: string;
  status: string;
  available: string;
}

export interface ZabbixTrigger {
  triggerid: string;
  description: string;
  priority: string;
  status: string;
  value: string; // "0" = OK, "1" = Problem
  lastchange: string;
  hostname?: string;
}

export interface ZabbixItem {
  itemid: string;
  hostid: string;
  name: string;
  key_: string;
  lastvalue?: string;
  lastclock?: string;
  units?: string;
}

export interface ZabbixHistory {
  itemid: string;
  clock: string;
  value: string;
  ns: number;
}

export class ZabbixClient {
  private apiUrl: string;
  private apiToken: string;

  constructor(config: ZabbixApiConfig) {
    this.apiUrl = config.apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiToken = config.apiToken;
  }

  private async request<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(`${this.apiUrl}/api_jsonrpc.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Zabbix API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Zabbix API error: ${data.error.message} (code: ${data.error.code})`);
    }

    return data.result;
  }

  /**
   * Get all hosts from Zabbix
   */
  async getHosts(search?: string): Promise<ZabbixHost[]> {
    const params: Record<string, unknown> = {
      output: ['hostid', 'host', 'name', 'status', 'available'],
      sortfield: 'name',
    };

    if (search) {
      params.search = { name: search };
      params.searchWildcardsEnabled = true;
    }

    return this.request<ZabbixHost[]>('host.get', params);
  }

  /**
   * Get a specific host by ID
   */
  async getHostById(hostid: string): Promise<ZabbixHost | null> {
    const hosts = await this.request<ZabbixHost[]>('host.get', {
      output: ['hostid', 'host', 'name', 'status', 'available'],
      hostids: hostid,
    });

    return hosts[0] || null;
  }

  /**
   * Get triggers for a host
   */
  async getTriggersByHostId(hostid: string, onlyProblems = false): Promise<ZabbixTrigger[]> {
    const params: Record<string, unknown> = {
      output: ['triggerid', 'description', 'priority', 'status', 'value', 'lastchange'],
      hostids: hostid,
      selectHosts: ['name'],
      sortfield: 'lastchange',
      sortorder: 'DESC',
    };

    if (onlyProblems) {
      params.filter = { value: '1' }; // Only problematic triggers
    }

    const triggers = await this.request<ZabbixTrigger[]>('trigger.get', params);
    
    // Add hostname from selectHosts
    return triggers.map(trigger => ({
      ...trigger,
      hostname: trigger.hostname || undefined,
    }));
  }

  /**
   * Get items by host ID and key pattern
   */
  async getItemsByHostId(hostid: string, keyPattern?: string): Promise<ZabbixItem[]> {
    const params: Record<string, unknown> = {
      output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue', 'lastclock', 'units'],
      hostids: hostid,
      sortfield: 'name',
    };

    if (keyPattern) {
      params.search = { key_: keyPattern };
    }

    return this.request<ZabbixItem[]>('item.get', params);
  }

  /**
   * Get item history (for uptime calculations)
   */
  async getItemHistory(itemid: string, limit: number = 100): Promise<ZabbixHistory[]> {
    return this.request<ZabbixHistory[]>('history.get', {
      output: 'extend',
      itemids: itemid,
      sortfield: 'clock',
      sortorder: 'DESC',
      limit,
    });
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      const version = await this.request<string>('apiinfo.version', {});
      return { success: true, version };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}
