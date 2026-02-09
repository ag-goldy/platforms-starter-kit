'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  saveZabbixConfig, 
  triggerZabbixSync, 
  getZabbixConfig,
  linkServiceToZabbixHost,
  toggleServiceMonitoring 
} from '@/app/app/actions/zabbix';
import { getAllOrganizationsAction } from '@/app/app/actions/organizations';
import { getOrgServicesAction } from '@/app/app/actions/services';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, CheckCircle, RefreshCw, Server, Link2, Activity } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface Organization {
  id: string;
  name: string;
}

interface Service {
  id: string;
  name: string;
  zabbixHostId: string | null;
  zabbixHostName: string | null;
  monitoringEnabled: boolean | null;
  monitoringStatus: string | null;
  uptimePercentage: string | null;
}

interface ZabbixHost {
  hostid: string;
  host: string;
  name: string;
}

export default function ZabbixAdminPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [services, setServices] = useState<Service[]>([]);
  const [config, setConfig] = useState<{ apiUrl: string; apiToken: string } | null>(null);
  const [zabbixHosts, setZabbixHosts] = useState<ZabbixHost[]>([]);
  
  const [apiUrl, setApiUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { showToast } = useToast();

  // Load organizations
  useEffect(() => {
    getAllOrganizationsAction().then(setOrgs);
  }, []);

  // Load config and services when org is selected
  useEffect(() => {
    if (!selectedOrgId) return;

    Promise.all([
      getZabbixConfig(selectedOrgId),
      getOrgServicesAction(selectedOrgId),
    ]).then(([configResult, servicesData]) => {
      if (configResult.success && configResult.data) {
        setConfig({
          apiUrl: configResult.data.apiUrl,
          apiToken: configResult.data.apiToken,
        });
        setApiUrl(configResult.data.apiUrl);
        setApiToken(configResult.data.apiToken);
      } else {
        setConfig(null);
      }
      setServices(servicesData as Service[]);
    });
  }, [selectedOrgId]);

  const testConnection = useCallback(async () => {
    if (!apiUrl || !apiToken) {
      showToast('Please enter API URL and Token', 'error');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/zabbix/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl, apiToken }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResult({ success: true, message: data.message });
        showToast('Connection successful!', 'success');
      } else {
        setTestResult({ success: false, message: data.error });
        showToast(data.error, 'error');
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Test failed' 
      });
      showToast('Connection test failed', 'error');
    } finally {
      setIsTesting(false);
    }
  }, [apiUrl, apiToken]);

  const saveConfig = useCallback(async () => {
    if (!selectedOrgId) {
      showToast('Please select an organization', 'error');
      return;
    }

    setIsSaving(true);
    const result = await saveZabbixConfig(selectedOrgId, { apiUrl, apiToken });
    
    if (result.success) {
      showToast('Configuration saved', 'success');
      setConfig({ apiUrl, apiToken });
    } else {
      showToast(result.error || 'Failed to save', 'error');
    }
    setIsSaving(false);
  }, [selectedOrgId, apiUrl, apiToken]);

  const syncNow = useCallback(async () => {
    if (!selectedOrgId) return;
    
    setIsSyncing(true);
    const result = await triggerZabbixSync(selectedOrgId);
    
    if (result.success) {
      showToast(`Synced ${result.data?.length || 0} services`, 'success');
      // Refresh services
      const servicesData = await getOrgServicesAction(selectedOrgId);
      setServices(servicesData as Service[]);
    } else {
      showToast(result.error || 'Sync failed', 'error');
    }
    setIsSyncing(false);
  }, [selectedOrgId]);

  const loadZabbixHosts = useCallback(async () => {
    if (!selectedOrgId) return;
    
    try {
      const response = await fetch(`/api/zabbix/hosts?orgId=${selectedOrgId}`);
      const data = await response.json();
      
      if (data.hosts) {
        setZabbixHosts(data.hosts);
      }
    } catch (error) {
      showToast('Failed to load Zabbix hosts', 'error');
    }
  }, [selectedOrgId]);

  const linkService = useCallback(async (serviceId: string, hostId: string) => {
    const result = await linkServiceToZabbixHost(serviceId, hostId);
    if (result.success) {
      showToast('Service linked', 'success');
      const servicesData = await getOrgServicesAction(selectedOrgId);
      setServices(servicesData as Service[]);
    } else {
      showToast(result.error || 'Failed to link', 'error');
    }
  }, [selectedOrgId]);

  const toggleMonitoring = useCallback(async (serviceId: string, enabled: boolean) => {
    const result = await toggleServiceMonitoring(serviceId, enabled);
    if (result.success) {
      showToast(enabled ? 'Monitoring enabled' : 'Monitoring disabled', 'success');
      const servicesData = await getOrgServicesAction(selectedOrgId);
      setServices(servicesData as Service[]);
    } else {
      showToast(result.error || 'Failed to toggle', 'error');
    }
  }, [selectedOrgId]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Zabbix Integration</h1>
        <p className="text-gray-600">Configure monitoring integration with Zabbix</p>
      </div>

      {/* Organization Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Organization</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose an organization..." />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedOrgId && (
        <>
          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Zabbix API Configuration</CardTitle>
              <CardDescription>
                Connect to your Zabbix server to enable monitoring
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiUrl">Zabbix API URL</Label>
                <Input
                  id="apiUrl"
                  placeholder="https://zabbix.example.com"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  e.g., https://zabbix.yourdomain.com or https://yourdomain.com/zabbix
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiToken">API Token</Label>
                <Input
                  id="apiToken"
                  type="password"
                  placeholder="Your Zabbix API token"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Create a token in Zabbix: Administration → General → API tokens
                </p>
              </div>

              {testResult && (
                <div className={`flex items-center gap-2 p-3 rounded ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {testResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <span className="text-sm">{testResult.message}</span>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={testConnection}
                  disabled={isTesting}
                >
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Button>
                <Button
                  onClick={saveConfig}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </Button>
                {config && (
                  <Button
                    variant="secondary"
                    onClick={syncNow}
                    disabled={isSyncing}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Service Mapping */}
          {config && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Service Mapping
                </CardTitle>
                <CardDescription>
                  Link services to Zabbix hosts for monitoring
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  variant="outline" 
                  onClick={loadZabbixHosts}
                  className="mb-4"
                >
                  Load Zabbix Hosts
                </Button>

                <div className="space-y-3">
                  {services.map((service) => (
                    <div 
                      key={service.id} 
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{service.name}</span>
                          {service.monitoringEnabled && (
                            <Badge variant={service.monitoringStatus === 'OPERATIONAL' ? 'default' : 'destructive'}>
                              <Activity className="h-3 w-3 mr-1" />
                              {service.monitoringStatus || 'Unknown'}
                            </Badge>
                          )}
                        </div>
                        {service.zabbixHostName && (
                          <p className="text-sm text-gray-500 mt-1">
                            Linked to: {service.zabbixHostName}
                          </p>
                        )}
                        {service.uptimePercentage && (
                          <p className="text-xs text-gray-400">
                            Uptime: {parseFloat(service.uptimePercentage).toFixed(2)}%
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <Select
                          value={service.zabbixHostId || ''}
                          onValueChange={(hostId) => linkService(service.id, hostId)}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select Zabbix host..." />
                          </SelectTrigger>
                          <SelectContent>
                            {zabbixHosts.map((host) => (
                              <SelectItem key={host.hostid} value={host.hostid}>
                                {host.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={service.monitoringEnabled || false}
                            onCheckedChange={(checked) => toggleMonitoring(service.id, checked)}
                            disabled={!service.zabbixHostId}
                          />
                          <span className="text-sm text-gray-600">
                            {service.monitoringEnabled ? 'On' : 'Off'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {services.length === 0 && (
                  <p className="text-gray-500 text-center py-8">
                    No services found for this organization.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
