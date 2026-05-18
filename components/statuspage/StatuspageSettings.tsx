"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Save,
} from "lucide-react";

interface StatuspageConfig {
  id: string;
  apiKey: string;
  pageId: string | null;
  pageUrl: string | null;
  isActive: boolean;
  autoSyncServices: boolean;
  autoCreateIncidents: boolean;
  componentMappings: Record<string, string>;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SyncStatus {
  configured: boolean;
  mappings: Record<string, string>;
  lastSyncedAt: string | null;
  autoSyncServices: boolean;
  stats: {
    mappedServices: number;
    totalServices: number;
    unmappedServices: number;
  };
}

export function StatuspageSettings() {
  const [config, setConfig] = useState<StatuspageConfig | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [apiKey, setApiKey] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [autoSync, setAutoSync] = useState(false);
  const [autoCreateIncidents, setAutoCreateIncidents] = useState(false);

  const fetchConfig = useCallback(async () => {
    // fetchConfig implementation
    try {
      const response = await fetch("/api/statuspage/config");
      if (!response.ok) throw new Error("Failed to fetch config");
      const data = await response.json();
      setConfig(data.config);

      if (data.config) {
        setApiKey(""); // Don't show the masked key
        setPageUrl(data.config.pageUrl || "");
        setAutoSync(data.config.autoSyncServices);
        setAutoCreateIncidents(data.config.autoCreateIncidents);
      }
    } catch {
      setError("Failed to load Statuspage configuration");
    }
  }, [
    setError,
    setConfig,
    setApiKey,
    setPageUrl,
    setAutoSync,
    setAutoCreateIncidents,
  ]);

  const fetchSyncStatus = useCallback(async () => {
    // fetchSyncStatus implementation
    try {
      const response = await fetch("/api/statuspage/sync");
      if (!response.ok) throw new Error("Failed to fetch sync status");
      const data = await response.json();
      setSyncStatus(data);
    } catch {
      console.error("Failed to load sync status");
    }
  }, [setSyncStatus]);

  useEffect(() => {
    Promise.all([fetchConfig(), fetchSyncStatus()]).finally(() =>
      setLoading(false),
    );
  }, [fetchConfig, fetchSyncStatus]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/statuspage/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey || undefined, // Only send if provided
          pageUrl: pageUrl || undefined,
          autoSyncServices: autoSync,
          autoCreateIncidents,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save configuration");
      }

      const data = await response.json();
      setConfig(data.config);
      setSuccess("Configuration saved successfully");
      setApiKey(""); // Clear the input
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save configuration",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/statuspage/sync", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to sync services");
      }

      const data = await response.json();
      setSuccess(
        `Sync completed: ${data.result.created.length} created, ${data.result.updated.length} updated`,
      );
      await fetchSyncStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync services");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to remove the Statuspage integration? This will not delete any components or incidents from Statuspage.",
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/statuspage/config", {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete configuration");

      setConfig(null);
      setSyncStatus(null);
      setApiKey("");
      setPageUrl("");
      setAutoSync(false);
      setAutoCreateIncidents(false);
      setSuccess("Statuspage integration removed");
    } catch {
      setError("Failed to remove integration");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Statuspage.io Integration
            {config?.isActive && (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Active
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Connect your Statuspage.io account to sync service status and create
            incidents automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {success}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="apiKey">
              API Key
              {config?.apiKey && (
                <span className="text-muted-foreground ml-2 text-sm">
                  (Current: {config.apiKey})
                </span>
              )}
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder={
                config?.apiKey
                  ? "Enter new API key to update"
                  : "Enter your Statuspage API key"
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Find your API key in Statuspage.io under Settings &gt; API
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pageUrl">Status Page URL</Label>
            <Input
              id="pageUrl"
              type="url"
              placeholder="https://status.yourcompany.com"
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              The public URL of your status page (for reference)
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="autoSync">Auto-sync Services</Label>
              <p className="text-sm text-muted-foreground">
                Automatically create Statuspage components for new services
              </p>
            </div>
            <Switch
              id="autoSync"
              checked={autoSync}
              onCheckedChange={setAutoSync}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="autoIncidents">Auto-create Incidents</Label>
              <p className="text-sm text-muted-foreground">
                Create Statuspage incidents when P1/P2 tickets are created
              </p>
            </div>
            <Switch
              id="autoIncidents"
              checked={autoCreateIncidents}
              onCheckedChange={setAutoCreateIncidents}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="flex gap-2">
            {config && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={saving}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </Button>
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || (!apiKey && !config)}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {config ? "Update" : "Connect"}
          </Button>
        </CardFooter>
      </Card>

      {config?.isActive && (
        <Card>
          <CardHeader>
            <CardTitle>Service Sync</CardTitle>
            <CardDescription>
              Sync your Atlas services with Statuspage components
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {syncStatus && (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-2xl font-bold">
                    {syncStatus.stats.totalServices}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total Services
                  </div>
                </div>
                <div className="rounded-lg bg-green-50 p-3">
                  <div className="text-2xl font-bold text-green-600">
                    {syncStatus.stats.mappedServices}
                  </div>
                  <div className="text-xs text-green-600">Mapped</div>
                </div>
                <div className="rounded-lg bg-yellow-50 p-3">
                  <div className="text-2xl font-bold text-yellow-600">
                    {syncStatus.stats.unmappedServices}
                  </div>
                  <div className="text-xs text-yellow-600">Unmapped</div>
                </div>
              </div>
            )}

            {syncStatus?.lastSyncedAt && (
              <p className="text-sm text-muted-foreground">
                Last synced:{" "}
                {new Date(syncStatus.lastSyncedAt).toLocaleString()}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            {config.pageUrl && (
              <Button variant="outline" asChild>
                <a
                  href={config.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Status Page
                </a>
              </Button>
            )}
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync Now
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
