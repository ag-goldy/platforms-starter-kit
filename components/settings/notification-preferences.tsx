'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Loader2, Bell, Mail, BellRing } from 'lucide-react';

interface Preference {
  id: string;
  eventType: string;
  label: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
}

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { success, error: showError } = useToast();

  const fetchPreferences = useCallback(async () => {
    try {
      const response = await fetch('/api/user/notification-preferences');
      if (!response.ok) throw new Error('Failed to fetch preferences');
      const data = await response.json();
      setPreferences(data.preferences);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  async function updatePreference(eventType: string, emailEnabled?: boolean, inAppEnabled?: boolean) {
    setIsSaving(true);
    try {
      const response = await fetch('/api/user/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType, emailEnabled, inAppEnabled }),
      });

      if (!response.ok) throw new Error('Failed to update preference');

      // Update local state
      setPreferences(prev => prev.map(p => {
        if (p.eventType === eventType) {
          return {
            ...p,
            emailEnabled: emailEnabled ?? p.emailEnabled,
            inAppEnabled: inAppEnabled ?? p.inAppEnabled,
          };
        }
        return p;
      }));

      success('Preference updated');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose how you want to be notified about different events
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Header row */}
          <div className="grid grid-cols-3 gap-4 py-2 border-b font-medium text-sm text-gray-500">
            <div>Event</div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </div>
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4" />
              In-App
            </div>
          </div>

          {/* Preference rows */}
          {preferences.map((pref) => (
            <div key={pref.eventType} className="grid grid-cols-3 gap-4 py-3 items-center border-b last:border-0">
              <div className="text-sm">
                {pref.label}
              </div>
              <div>
                <Switch
                  checked={pref.emailEnabled}
                  onCheckedChange={(checked) => updatePreference(pref.eventType, checked, undefined)}
                  disabled={isSaving}
                />
              </div>
              <div>
                <Switch
                  checked={pref.inAppEnabled}
                  onCheckedChange={(checked) => updatePreference(pref.eventType, undefined, checked)}
                  disabled={isSaving}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              // Reset all to defaults
              preferences.forEach(pref => {
                updatePreference(pref.eventType, true, true);
              });
            }}
            disabled={isSaving}
          >
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
