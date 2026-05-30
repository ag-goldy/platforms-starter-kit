"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { updateNotificationPreferences } from "./actions";
import type { NotificationPreference } from "@/db/schema";

export const DEFAULT_PREFERENCES: Omit<
  NotificationPreference,
  "id" | "userId" | "platformAdminId" | "createdAt" | "updatedAt"
> = {
  emailEnabled: true,
  emailTicketAssigned: true,
  emailTicketStatusChanged: false,
  emailCommentAdded: true,
  emailMention: true,
  emailSlaBreach: true,
  emailDigestFrequency: "daily",
  inappEnabled: true,
  inappTicketAssigned: true,
  inappTicketStatusChanged: true,
  inappCommentAdded: true,
  inappMention: true,
  inappSlaBreach: true,
  pushEnabled: false,
  pushTicketAssigned: false,
  pushTicketStatusChanged: false,
  pushCommentAdded: false,
  pushMention: false,
  pushSlaBreach: false,
};

interface NotificationPreferencesFormProps {
  initialPreferences: NotificationPreference | null;
}

export function NotificationPreferencesForm({
  initialPreferences,
}: NotificationPreferencesFormProps) {
  const { success, error: showError } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const base = useMemo(() => {
    if (!initialPreferences) return { ...DEFAULT_PREFERENCES };
    return {
      emailEnabled: initialPreferences.emailEnabled,
      emailTicketAssigned: initialPreferences.emailTicketAssigned,
      emailTicketStatusChanged: initialPreferences.emailTicketStatusChanged,
      emailCommentAdded: initialPreferences.emailCommentAdded,
      emailMention: initialPreferences.emailMention,
      emailSlaBreach: initialPreferences.emailSlaBreach,
      emailDigestFrequency: initialPreferences.emailDigestFrequency,
      inappEnabled: initialPreferences.inappEnabled,
      inappTicketAssigned: initialPreferences.inappTicketAssigned,
      inappTicketStatusChanged: initialPreferences.inappTicketStatusChanged,
      inappCommentAdded: initialPreferences.inappCommentAdded,
      inappMention: initialPreferences.inappMention,
      inappSlaBreach: initialPreferences.inappSlaBreach,
      pushEnabled: initialPreferences.pushEnabled,
      pushTicketAssigned: initialPreferences.pushTicketAssigned,
      pushTicketStatusChanged: initialPreferences.pushTicketStatusChanged,
      pushCommentAdded: initialPreferences.pushCommentAdded,
      pushMention: initialPreferences.pushMention,
      pushSlaBreach: initialPreferences.pushSlaBreach,
    };
  }, [initialPreferences]);

  const [prefs, setPrefs] = useState({ ...base });

  const hasChanges = useMemo(() => {
    return (
      prefs.emailEnabled !== base.emailEnabled ||
      prefs.emailTicketAssigned !== base.emailTicketAssigned ||
      prefs.emailTicketStatusChanged !== base.emailTicketStatusChanged ||
      prefs.emailCommentAdded !== base.emailCommentAdded ||
      prefs.emailMention !== base.emailMention ||
      prefs.emailSlaBreach !== base.emailSlaBreach ||
      prefs.emailDigestFrequency !== base.emailDigestFrequency ||
      prefs.inappEnabled !== base.inappEnabled ||
      prefs.inappTicketAssigned !== base.inappTicketAssigned ||
      prefs.inappTicketStatusChanged !== base.inappTicketStatusChanged ||
      prefs.inappCommentAdded !== base.inappCommentAdded ||
      prefs.inappMention !== base.inappMention ||
      prefs.inappSlaBreach !== base.inappSlaBreach ||
      prefs.pushEnabled !== base.pushEnabled ||
      prefs.pushTicketAssigned !== base.pushTicketAssigned ||
      prefs.pushTicketStatusChanged !== base.pushTicketStatusChanged ||
      prefs.pushCommentAdded !== base.pushCommentAdded ||
      prefs.pushMention !== base.pushMention ||
      prefs.pushSlaBreach !== base.pushSlaBreach
    );
  }, [prefs, base]);

  const handleToggle = (key: keyof typeof prefs) => (checked: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: checked }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updateNotificationPreferences(prefs);
      if (result.success) {
        success("Notification preferences saved");
      } else {
        showError(result.error || "Failed to save preferences");
      }
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Email Section */}
      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>
            Control which email notifications you receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="emailEnabled" className="cursor-pointer">
              Email notifications
            </Label>
            <Switch
              id="emailEnabled"
              checked={prefs.emailEnabled}
              onCheckedChange={handleToggle("emailEnabled")}
            />
          </div>

          <div
            className={prefs.emailEnabled ? "space-y-4" : "space-y-4 opacity-50"}
          >
            <ToggleRow
              id="emailTicketAssigned"
              label="Ticket assigned to me"
              checked={prefs.emailTicketAssigned}
              onCheckedChange={handleToggle("emailTicketAssigned")}
              disabled={!prefs.emailEnabled}
            />
            <ToggleRow
              id="emailTicketStatusChanged"
              label="Ticket status changes"
              checked={prefs.emailTicketStatusChanged}
              onCheckedChange={handleToggle("emailTicketStatusChanged")}
              disabled={!prefs.emailEnabled}
            />
            <ToggleRow
              id="emailCommentAdded"
              label="Comments on my tickets"
              checked={prefs.emailCommentAdded}
              onCheckedChange={handleToggle("emailCommentAdded")}
              disabled={!prefs.emailEnabled}
            />
            <ToggleRow
              id="emailMention"
              label="Mentions"
              checked={prefs.emailMention}
              onCheckedChange={handleToggle("emailMention")}
              disabled={!prefs.emailEnabled}
            />
            <ToggleRow
              id="emailSlaBreach"
              label="SLA breach alerts"
              checked={prefs.emailSlaBreach}
              onCheckedChange={handleToggle("emailSlaBreach")}
              disabled={!prefs.emailEnabled}
            />
          </div>

          <div className="pt-2 border-t">
            <Label htmlFor="emailDigestFrequency" className="mb-2 block">
              Email digest
            </Label>
            <Select
              value={prefs.emailDigestFrequency}
              onValueChange={(value) =>
                handleToggle("emailDigestFrequency")(value)
              }
              disabled={!prefs.emailEnabled}
            >
              <SelectTrigger
                id="emailDigestFrequency"
                className="w-full max-w-xs"
              >
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly (Monday)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* In-App Section */}
      <Card>
        <CardHeader>
          <CardTitle>In-App</CardTitle>
          <CardDescription>
            Control which notifications appear inside Atlas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="inappEnabled" className="cursor-pointer">
              In-app notifications
            </Label>
            <Switch
              id="inappEnabled"
              checked={prefs.inappEnabled}
              onCheckedChange={handleToggle("inappEnabled")}
            />
          </div>

          <div
            className={
              prefs.inappEnabled ? "space-y-4" : "space-y-4 opacity-50"
            }
          >
            <ToggleRow
              id="inappTicketAssigned"
              label="Ticket assigned to me"
              checked={prefs.inappTicketAssigned}
              onCheckedChange={handleToggle("inappTicketAssigned")}
              disabled={!prefs.inappEnabled}
            />
            <ToggleRow
              id="inappTicketStatusChanged"
              label="Ticket status changes"
              checked={prefs.inappTicketStatusChanged}
              onCheckedChange={handleToggle("inappTicketStatusChanged")}
              disabled={!prefs.inappEnabled}
            />
            <ToggleRow
              id="inappCommentAdded"
              label="Comments on my tickets"
              checked={prefs.inappCommentAdded}
              onCheckedChange={handleToggle("inappCommentAdded")}
              disabled={!prefs.inappEnabled}
            />
            <ToggleRow
              id="inappMention"
              label="Mentions"
              checked={prefs.inappMention}
              onCheckedChange={handleToggle("inappMention")}
              disabled={!prefs.inappEnabled}
            />
            <ToggleRow
              id="inappSlaBreach"
              label="SLA breach alerts"
              checked={prefs.inappSlaBreach}
              onCheckedChange={handleToggle("inappSlaBreach")}
              disabled={!prefs.inappEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Push Section */}
      <Card className="opacity-75">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle>Push</CardTitle>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <CardDescription>
            Browser and mobile push notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="pushEnabled" className="cursor-pointer">
              Push notifications
            </Label>
            <Switch
              id="pushEnabled"
              checked={prefs.pushEnabled}
              onCheckedChange={handleToggle("pushEnabled")}
              disabled
            />
          </div>

          <div className="space-y-4 opacity-50">
            <ToggleRow
              id="pushTicketAssigned"
              label="Ticket assigned to me"
              checked={prefs.pushTicketAssigned}
              onCheckedChange={handleToggle("pushTicketAssigned")}
              disabled
            />
            <ToggleRow
              id="pushTicketStatusChanged"
              label="Ticket status changes"
              checked={prefs.pushTicketStatusChanged}
              onCheckedChange={handleToggle("pushTicketStatusChanged")}
              disabled
            />
            <ToggleRow
              id="pushCommentAdded"
              label="Comments on my tickets"
              checked={prefs.pushCommentAdded}
              onCheckedChange={handleToggle("pushCommentAdded")}
              disabled
            />
            <ToggleRow
              id="pushMention"
              label="Mentions"
              checked={prefs.pushMention}
              onCheckedChange={handleToggle("pushMention")}
              disabled
            />
            <ToggleRow
              id="pushSlaBreach"
              label="SLA breach alerts"
              checked={prefs.pushSlaBreach}
              onCheckedChange={handleToggle("pushSlaBreach")}
              disabled
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label
        htmlFor={id}
        className={disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
      >
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}
