'use client';

import { useRouter } from 'next/navigation';
import { IntegrationChooser, IntegrationType } from '@/components/integrations/integration-chooser';
import { PageHeaderWithBack } from '@/components/navigation/back-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Settings, ExternalLink, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface ConfiguredIntegration {
  id: string;
  config: {
    id: string;
    orgId: string;
    isActive: boolean;
    lastSyncedAt: string | null;
  };
  org: {
    id: string;
    name: string;
  } | null;
}

export default function IntegrationsPage() {
  const router = useRouter();
  const [configured, setConfigured] = useState<ConfiguredIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfiguredIntegrations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/zabbix');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setConfigured(data.configs || []);
    } catch (err) {
      setError('Failed to load configured integrations');
      console.error('Failed to fetch integrations:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfiguredIntegrations();
  }, [fetchConfiguredIntegrations]);

  const handleSelectIntegration = (integration: IntegrationType) => {
    if (integration.id === 'zabbix') {
      router.push('/app/admin/zabbix');
    } else {
      alert(`${integration.name} integration coming soon!`);
    }
  };

  const handleConfigure = (type: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/app/admin/${type}`);
  };

  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-gray-100 text-gray-600">
        <AlertCircle className="h-3 w-3 mr-1" />
        Inactive
      </Badge>
    );
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <PageHeaderWithBack
        title="Integrations"
        description="Connect Atlas with your favorite tools and services"
        backHref="/app"
        backLabel="Back to Dashboard"
      />

      {/* Configured Integrations */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Configured Integrations</h2>
          {!isLoading && configured.length > 0 && (
            <Button variant="ghost" size="sm" onClick={fetchConfiguredIntegrations}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={`skeleton-${i}`} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-red-500 mb-3" />
            <p className="text-gray-600">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchConfiguredIntegrations}>
              Try Again
            </Button>
          </Card>
        ) : configured.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <div className="p-3 bg-gray-100 rounded-full w-fit mx-auto mb-3">
              <Settings className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="font-medium text-gray-900">No integrations configured</h3>
            <p className="text-sm text-gray-500 mt-1">
              Select an integration below to get started
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {configured.map((item, index) => {
              const config = item.config;
              const org = item.org;
              const uniqueKey = config?.id || `config-${index}`;
              
              return (
                <Card 
                  key={uniqueKey} 
                  className="group relative hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">Zabbix</h3>
                          {getStatusBadge(config?.isActive)}
                        </div>
                        <p className="text-sm text-gray-500 mt-1 truncate">
                          {org?.name || 'Unknown Organization'}
                        </p>
                        {config?.lastSyncedAt && (
                          <p className="text-xs text-gray-400 mt-1">
                            Last synced: {new Date(config.lastSyncedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleConfigure('zabbix', e)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Add New Integration */}
      <section className="space-y-4">
        <CardHeader className="px-0 pt-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Add New Integration</CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.open('/docs/integrations', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Documentation
            </Button>
          </div>
        </CardHeader>
        
        <IntegrationChooser onSelect={handleSelectIntegration} />
      </section>

      {/* Help Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-xl shrink-0">
              <Plus className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">Need a custom integration?</h3>
              <p className="text-sm text-blue-700 mt-1">
                We can build custom integrations for your specific needs. Contact our support team to discuss your requirements.
              </p>
              <div className="flex gap-3 mt-4">
                <Button 
                  variant="link" 
                  className="text-blue-700 p-0 h-auto font-medium"
                  onClick={() => window.open('mailto:support@agrnetworks.com')}
                >
                  Contact Support →
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
