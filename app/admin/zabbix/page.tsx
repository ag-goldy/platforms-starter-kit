'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import {
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Server,
  Plus,
  Settings,
  Trash2,
  Edit,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils/date';
import { PageHeaderWithBack } from '@/components/navigation/back-button';

interface Organization {
  id: string;
  name: string;
  subdomain: string;
}

interface ZabbixConfig {
  id: string;
  orgId: string;
  apiUrl: string;
  apiToken: string;
  isActive: boolean;
  syncIntervalMinutes: number;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConfigWithOrg {
  config: ZabbixConfig;
  org: Organization | null;
}

export default function ZabbixAdminPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [configs, setConfigs] = useState<ConfigWithOrg[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ZabbixConfig | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ZabbixConfig | null>(null);
  
  // Form state
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [syncInterval, setSyncInterval] = useState('5');
  const [isActive, setIsActive] = useState(true);
  
  // Test connection result
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch configs and organizations on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [configsRes, orgsRes] = await Promise.all([
        fetch('/api/admin/zabbix'),
        fetch('/api/organizations'),
      ]);

      if (configsRes.ok) {
        const configsData = await configsRes.json();
        setConfigs(configsData.configs || []);
      }

      if (orgsRes.ok) {
        const orgsData = await orgsRes.json();
        setOrganizations(orgsData.organizations || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      showToast('Failed to load data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiUrl || !apiToken) {
      showToast('Please enter API URL and Token', 'error');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/admin/zabbix/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl, apiToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Connection test failed');
      }

      setTestResult({ success: true, message: data.message || 'Connection successful!' });
    } catch (error) {
      setTestResult({ success: false, message: error instanceof Error ? error.message : 'Connection test failed' });
      showToast('Failed to test connection', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedOrgId || !apiUrl || !apiToken) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/admin/zabbix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: selectedOrgId,
          apiUrl,
          apiToken,
          syncIntervalMinutes: parseInt(syncInterval),
          isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save configuration');
      }

      showToast('Configuration saved successfully', 'success');
      resetForm();
      setShowForm(false);
      fetchData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSync = async (orgId: string) => {
    setIsSyncing(orgId);

    try {
      const response = await fetch('/api/admin/zabbix/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      showToast(data.message || 'Sync completed', 'success');
      fetchData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Sync failed', 'error');
    } finally {
      setIsSyncing(null);
    }
  };

  const handleBulkSync = async () => {
    setIsBulkSyncing(true);

    try {
      const response = await fetch('/api/admin/zabbix/bulk-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Bulk sync failed');
      }

      showToast(data.message || 'Bulk sync completed', 'success');
      fetchData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Bulk sync failed', 'error');
    } finally {
      setIsBulkSyncing(false);
    }
  };

  const handleDelete = async (config: ZabbixConfig) => {
    setIsDeleting(config.orgId);

    try {
      const response = await fetch('/api/admin/zabbix/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: config.orgId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Delete failed');
      }

      showToast('Configuration deleted', 'success');
      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Delete failed', 'error');
    } finally {
      setDeleteConfirm(null);
      setIsDeleting(null);
    }
  };

  const resetForm = () => {
    setSelectedOrgId('');
    setApiUrl('');
    setApiToken('');
    setSyncInterval('5');
    setIsActive(true);
    setTestResult(null);
    setEditingConfig(null);
  };

  const openEditForm = (configWithOrg: ConfigWithOrg) => {
    const config = configWithOrg.config;
    setEditingConfig(config);
    setSelectedOrgId(config.orgId);
    setApiUrl(config.apiUrl);
    setApiToken(config.apiToken);
    setSyncInterval(config.syncIntervalMinutes.toString());
    setIsActive(config.isActive);
    setTestResult(null);
    setShowForm(true);
  };

  const openNewForm = () => {
    resetForm();
    setShowForm(true);
  };

  // Get orgs without Zabbix config
  const availableOrgs = organizations.filter(
    org => !configs.some(c => c.config.orgId === org.id) || editingConfig?.orgId === org.id
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeaderWithBack
        title="Zabbix Integration"
        description="Configure Zabbix monitoring integration for organizations"
        backHref="/admin/integrations"
        backLabel="Back to Integrations"
      >
        <div className="flex items-center gap-2">
          {configs.length > 1 && (
            <Button
              variant="outline"
              onClick={handleBulkSync}
              disabled={isBulkSyncing || configs.filter(c => c.config.isActive).length === 0}
            >
              {isBulkSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing All...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync All
                </>
              )}
            </Button>
          )}
          <Button onClick={openNewForm}>
            <Plus className="h-4 w-4 mr-2" />
            Add Configuration
          </Button>
        </div>
      </PageHeaderWithBack>

      {/* Configurations List */}
      <div className="grid gap-4">
        {configs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Server className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No Zabbix configurations yet</p>
              <Button className="mt-4" onClick={openNewForm}>
                Add First Configuration
              </Button>
            </CardContent>
          </Card>
        ) : (
          configs.map(({ config, org }) => (
            <Card key={config.id} className={!config.isActive ? 'opacity-75' : ''}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{org?.name || 'Unknown Organization'}</h3>
                      <Badge variant={config.isActive ? 'default' : 'secondary'}>
                        {config.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">{config.apiUrl}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Sync interval: {config.syncIntervalMinutes} min</span>
                      <span>•</span>
                      <span>
                        Last synced: {config.lastSyncedAt ? formatDateTime(config.lastSyncedAt) : 'Never'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(config.orgId)}
                      disabled={isSyncing === config.orgId || !config.isActive}
                    >
                      {isSyncing === config.orgId ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Sync Now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditForm({ config, org })}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setDeleteConfirm(config)}
                      disabled={isDeleting === config.orgId}
                    >
                      {isDeleting === config.orgId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Configuration Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? 'Edit Zabbix Configuration' : 'Add Zabbix Configuration'}
            </DialogTitle>
            <DialogDescription>
              Configure Zabbix API connection for monitoring integration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Organization Selection */}
            <div className="space-y-2">
              <Label htmlFor="org">Organization *</Label>
              <Select
                value={selectedOrgId}
                onValueChange={setSelectedOrgId}
                disabled={!!editingConfig}
              >
                <SelectTrigger id="org">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {availableOrgs.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* API URL */}
            <div className="space-y-2">
              <Label htmlFor="apiUrl">Zabbix API URL *</Label>
              <Input
                id="apiUrl"
                placeholder="https://zabbix.example.com"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                The URL to your Zabbix server (e.g., https://zabbix.example.com or https://zabbix.example.com/api_jsonrpc.php)
              </p>
            </div>

            {/* API Token */}
            <div className="space-y-2">
              <Label htmlFor="apiToken">API Token *</Label>
              <Input
                id="apiToken"
                type="password"
                placeholder="Enter Zabbix API token"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Create a token in Zabbix under Administration → API tokens
              </p>
            </div>

            {/* Sync Interval */}
            <div className="space-y-2">
              <Label htmlFor="syncInterval">Sync Interval</Label>
              <Select value={syncInterval} onValueChange={setSyncInterval}>
                <SelectTrigger id="syncInterval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Every 1 minute</SelectItem>
                  <SelectItem value="5">Every 5 minutes</SelectItem>
                  <SelectItem value="15">Every 15 minutes</SelectItem>
                  <SelectItem value="30">Every 30 minutes</SelectItem>
                  <SelectItem value="60">Every hour</SelectItem>
                  <SelectItem value="360">Every 6 hours</SelectItem>
                  <SelectItem value="720">Every 12 hours</SelectItem>
                  <SelectItem value="1440">Every 24 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="isActive" className="text-base">
                  Enable Integration
                </Label>
                <p className="text-sm text-gray-500">
                  When disabled, monitoring data will not be synced
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            {/* Test Connection Result */}
            {testResult && (
              <div
                className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
                  testResult.success
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                {testResult.message}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || !apiUrl || !apiToken}
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !selectedOrgId || !apiUrl || !apiToken}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Configuration</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the Zabbix configuration for{' '}
              {organizations.find(o => o.id === deleteConfirm?.orgId)?.name}?
              <br /><br />
              This will stop all monitoring sync for this organization.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
