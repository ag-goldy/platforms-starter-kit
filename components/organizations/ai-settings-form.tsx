'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Loader2, Sparkles, Shield, Users, BookOpen, Ticket, Server } from 'lucide-react';
import { updateOrgAIConfigAction } from '@/app/app/actions/ai-settings';
import type { OrgAIConfig } from '@/db/schema';

interface AISettingsFormProps {
  orgId: string;
  initialConfig: OrgAIConfig;
}

export function AISettingsForm({ orgId, initialConfig }: AISettingsFormProps) {
  const { success, error } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState(initialConfig);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await updateOrgAIConfigAction(orgId, {
        aiEnabled: config.aiEnabled,
        customerAIEnabled: config.customerAIEnabled,
        allowKBAccess: config.allowKBAccess,
        allowTicketSummaries: config.allowTicketSummaries,
        allowAssetInfo: config.allowAssetInfo,
        allowServiceStatus: config.allowServiceStatus,
        blockPIIInResponses: config.blockPIIInResponses,
        maxResponseTokens: config.maxResponseTokens,
        customerRateLimit: config.customerRateLimit,
        systemInstructions: config.systemInstructions,
      });
      success('AI settings saved successfully');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = JSON.stringify(config) !== JSON.stringify(initialConfig);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-orange-500" />
          <CardTitle>AI Features</CardTitle>
        </div>
        <CardDescription>
          Enable or disable AI assistant features for your organization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AI Toggles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Enable AI Assistant
              </Label>
              <p className="text-sm text-gray-500">
                Turn on Zeus AI for your organization
              </p>
            </div>
            <Switch
              checked={config.aiEnabled}
              onCheckedChange={(checked) => setConfig({ ...config, aiEnabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Customer Portal AI
              </Label>
              <p className="text-sm text-gray-500">
                Allow customers to use AI in the customer portal
              </p>
            </div>
            <Switch
              checked={config.customerAIEnabled}
              onCheckedChange={(checked) => setConfig({ ...config, customerAIEnabled: checked })}
              disabled={!config.aiEnabled}
            />
          </div>
        </div>

        <Separator />

        {/* Data Access Permissions */}
        <div>
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Data Access Permissions
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  KB Article Access
                </Label>
                <p className="text-sm text-gray-500">
                  AI can reference knowledge base articles
                </p>
              </div>
              <Switch
                checked={config.allowKBAccess}
                onCheckedChange={(checked) => setConfig({ ...config, allowKBAccess: checked })}
                disabled={!config.aiEnabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Ticket className="h-4 w-4" />
                  Ticket Summaries
                </Label>
                <p className="text-sm text-gray-500">
                  AI can see ticket summaries (no internal notes)
                </p>
              </div>
              <Switch
                checked={config.allowTicketSummaries}
                onCheckedChange={(checked) => setConfig({ ...config, allowTicketSummaries: checked })}
                disabled={!config.aiEnabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Service Status
                </Label>
                <p className="text-sm text-gray-500">
                  AI can reference service status information
                </p>
              </div>
              <Switch
                checked={config.allowServiceStatus}
                onCheckedChange={(checked) => setConfig({ ...config, allowServiceStatus: checked })}
                disabled={!config.aiEnabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Block PII in Responses
                </Label>
                <p className="text-sm text-gray-500">
                  Automatically redact personal information
                </p>
              </div>
              <Switch
                checked={config.blockPIIInResponses}
                onCheckedChange={(checked) => setConfig({ ...config, blockPIIInResponses: checked })}
                disabled={!config.aiEnabled}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Rate Limiting */}
        <div>
          <h3 className="text-sm font-medium mb-4">Rate Limiting</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rateLimit">Requests per hour (per user)</Label>
              <Input
                id="rateLimit"
                type="number"
                value={config.customerRateLimit}
                onChange={(e) => setConfig({ ...config, customerRateLimit: parseInt(e.target.value) || 50 })}
                min={10}
                max={500}
                disabled={!config.aiEnabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxTokens">Max response tokens</Label>
              <Input
                id="maxTokens"
                type="number"
                value={config.maxResponseTokens}
                onChange={(e) => setConfig({ ...config, maxResponseTokens: parseInt(e.target.value) || 1000 })}
                min={100}
                max={4000}
                disabled={!config.aiEnabled}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Custom Instructions */}
        <div className="space-y-2">
          <Label htmlFor="instructions">Custom System Instructions</Label>
          <p className="text-sm text-gray-500">
            Add custom instructions for your organization&apos;s AI assistant
          </p>
          <Textarea
            id="instructions"
            value={config.systemInstructions || ''}
            onChange={(e) => setConfig({ ...config, systemInstructions: e.target.value })}
            placeholder="e.g., Always greet customers by name. When discussing billing, direct them to accounts@company.com."
            rows={4}
            disabled={!config.aiEnabled}
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isLoading || !hasChanges}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
