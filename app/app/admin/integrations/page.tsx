'use client';

import { useRouter } from 'next/navigation';
import { IntegrationChooser, IntegrationType } from '@/components/integrations/integration-chooser';
import { PageHeaderWithBack } from '@/components/navigation/back-button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Settings, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';

interface ConfiguredIntegration {
  id: string;
  type: string;
  name: string;
  orgName: string;
  status: 'active' | 'inactive' | 'error';
  lastSynced?: string;
}

export default function IntegrationsPage() {
  const router = useRouter();
  const [configured, setConfigured] = useState<ConfiguredIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch configured integrations
    fetchConfiguredIntegrations();
  }, []);

  const fetchConfiguredIntegrations = async () => {
    try {
      // Fetch Zabbix configs as an example
      const response = await fetch('/api/admin/zabbix');
      if (response.ok) {
        const data = await response.json();
        const zabbixConfigs = (data.configs || []).map((c: ConfiguredIntegration) => ({
          ...c,
          type: 'zabbix',
          name: 'Zabbix',
        }));
        setConfigured(zabbixConfigs);
      }
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectIntegration = (integration: IntegrationType) => {
    if (integration.id === 'zabbix') {
      router.push('/app/admin/zabbix');
    } else {
      // For other integrations, could show a coming soon modal or setup page
      alert(`${integration.name} integration coming soon!`);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeaderWithBack
        title="Integrations"
        description="Connect Atlas with your favorite tools and services"
        backHref="/app/admin"
        backLabel="Back to Admin"
      />

      {/* Configured Integrations */}
      {configured.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Configured Integrations</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {configured.map((config) => (
              <Card key={config.id} className="relative">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{config.name}</h3>
                        <Badge 
                          variant={config.status === 'active' ? 'default' : 'secondary'}
                          className={
                            config.status === 'active' 
                              ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                              : config.status === 'error'
                              ? 'bg-red-100 text-red-700 hover:bg-red-100'
                              : ''
                          }
                        >
                          {config.status === 'active' ? 'Active' : config.status === 'error' ? 'Error' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{config.orgName}</p>
                      {config.lastSynced && (
                        <p className="text-xs text-gray-400 mt-1">
                          Last synced: {new Date(config.lastSynced).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/app/admin/${config.type}`)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Add New Integration */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add New Integration</h2>
          <Button variant="outline" size="sm" onClick={() => window.open('/docs/integrations', '_blank')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Documentation
          </Button>
        </div>
        
        <IntegrationChooser onSelect={handleSelectIntegration} />
      </section>

      {/* Integration Help */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Plus className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900">Need a custom integration?</h3>
              <p className="text-sm text-blue-700 mt-1">
                We can build custom integrations for your specific needs. Contact our support team to discuss your requirements.
              </p>
              <Button 
                variant="link" 
                className="text-blue-700 p-0 h-auto mt-2"
                onClick={() => window.open('mailto:support@agrnetworks.com')}
              >
                Contact Support →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
