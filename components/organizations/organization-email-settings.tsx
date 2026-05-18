"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Mail, Check, AlertCircle, Copy } from "lucide-react";
import {
  updateOrgEmailSettingsAction,
  type OrgEmailSettings,
} from "@/app/app/actions/organizations";

interface OrganizationEmailSettingsProps {
  orgId: string;
  orgSlug: string;
  orgSubdomain: string; // eslint-disable-line @typescript-eslint/no-unused-vars
  currentSettings: {
    allowPublicIntake: boolean;
    intakeEmailAddress?: string | null;
    autoReplyEnabled: boolean;
    autoReplyTemplate?: string | null;
    emailDomain?: string | null;
  };
  rootDomain: string;
}

const DEFAULT_AUTO_REPLY = `Thank you for contacting support.

Your ticket has been created and assigned reference: {{ticketKey}}

You can track the status of your ticket at: {{magicLink}}

Our team will respond as soon as possible.

Best regards,
Support Team`;

export function OrganizationEmailSettings({
  orgId,
  orgSlug,
  orgSubdomain,
  currentSettings,
  rootDomain,
}: OrganizationEmailSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<OrgEmailSettings>({
    allowPublicIntake: currentSettings.allowPublicIntake ?? true,
    intakeEmailAddress: currentSettings.intakeEmailAddress ?? "",
    autoReplyEnabled: currentSettings.autoReplyEnabled ?? true,
    autoReplyTemplate: currentSettings.autoReplyTemplate ?? "",
    emailDomain: currentSettings.emailDomain ?? "",
  });
  const { success, error: showError } = useToast();

  // Generate the webhook URL for this organization
  const webhookUrl = `${rootDomain}/api/inbound-email`;

  // Generate suggested intake email
  const suggestedIntakeEmail = `support+${orgSlug}@${rootDomain.replace(/^https?:\/\//, "")}`;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updateOrgEmailSettingsAction(orgId, {
        ...settings,
        intakeEmailAddress: settings.intakeEmailAddress || null,
        autoReplyTemplate: settings.autoReplyTemplate || null,
        emailDomain: settings.emailDomain || null,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      success("Email settings saved successfully");
      setIsEditing(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    success("Webhook URL copied to clipboard");
  };

  const useSuggestedEmail = () => {
    setSettings({ ...settings, intakeEmailAddress: suggestedIntakeEmail });
  };

  const useDefaultTemplate = () => {
    setSettings({ ...settings, autoReplyTemplate: DEFAULT_AUTO_REPLY });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email-to-Ticket
          </CardTitle>
          <CardDescription>
            Configure email intake for automatic ticket creation
          </CardDescription>
        </div>
        {!isEditing && (
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            Edit Settings
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {!isEditing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium">Email Intake Enabled</span>
              <span
                className={
                  settings.allowPublicIntake
                    ? "text-green-600"
                    : "text-gray-500"
                }
              >
                {settings.allowPublicIntake ? "Yes" : "No"}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium">Intake Email Address</span>
              <span className="text-sm text-gray-600">
                {settings.intakeEmailAddress || "Not configured"}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium">Auto-Reply Enabled</span>
              <span
                className={
                  settings.autoReplyEnabled ? "text-green-600" : "text-gray-500"
                }
              >
                {settings.autoReplyEnabled ? "Yes" : "No"}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium">Email Domain Matching</span>
              <span className="text-sm text-gray-600">
                {settings.emailDomain || "Not configured"}
              </span>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-amber-900">
                    Webhook Configuration
                  </h4>
                  <p className="text-sm text-amber-800 mt-1">
                    Configure your email provider to forward emails to this
                    webhook URL:
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 bg-white px-3 py-1.5 rounded text-xs font-mono text-amber-900 border border-amber-200 break-all">
                      {webhookUrl}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyWebhookUrl}
                      className="shrink-0"
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Enable Email Intake */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="allowPublicIntake">Enable Email Intake</Label>
                <p className="text-sm text-gray-500">
                  Allow tickets to be created from incoming emails
                </p>
              </div>
              <Switch
                id="allowPublicIntake"
                checked={settings.allowPublicIntake}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, allowPublicIntake: checked })
                }
              />
            </div>

            {/* Intake Email Address */}
            <div className="space-y-2">
              <Label htmlFor="intakeEmailAddress">Intake Email Address</Label>
              <p className="text-sm text-gray-500">
                The dedicated email address customers should send tickets to
              </p>
              <div className="flex gap-2">
                <Input
                  id="intakeEmailAddress"
                  type="email"
                  placeholder="e.g., support@yourhotel.com"
                  value={settings.intakeEmailAddress}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      intakeEmailAddress: e.target.value,
                    })
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={useSuggestedEmail}
                  className="shrink-0"
                >
                  Use Suggested
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Suggested:{" "}
                <code className="bg-gray-100 px-1 rounded">
                  {suggestedIntakeEmail}
                </code>
              </p>
            </div>

            {/* Email Domain for Auto-Matching */}
            <div className="space-y-2">
              <Label htmlFor="emailDomain">
                Email Domain for Auto-Matching
              </Label>
              <p className="text-sm text-gray-500">
                Automatically assign tickets from this domain to this
                organization
              </p>
              <Input
                id="emailDomain"
                placeholder="e.g., yourhotel.com"
                value={settings.emailDomain}
                onChange={(e) =>
                  setSettings({ ...settings, emailDomain: e.target.value })
                }
              />
            </div>

            {/* Auto-Reply Settings */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoReplyEnabled">Enable Auto-Reply</Label>
                <p className="text-sm text-gray-500">
                  Send confirmation email when ticket is created
                </p>
              </div>
              <Switch
                id="autoReplyEnabled"
                checked={settings.autoReplyEnabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, autoReplyEnabled: checked })
                }
              />
            </div>

            {/* Auto-Reply Template */}
            {settings.autoReplyEnabled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="autoReplyTemplate">Auto-Reply Template</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={useDefaultTemplate}
                  >
                    Reset to Default
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  Available variables: {"{{ticketKey}}"}, {"{{magicLink}}"},{" "}
                  {"{{senderEmail}}"}
                </p>
                <Textarea
                  id="autoReplyTemplate"
                  rows={8}
                  value={settings.autoReplyTemplate}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      autoReplyTemplate: e.target.value,
                    })
                  }
                  placeholder={DEFAULT_AUTO_REPLY}
                  className="font-mono text-sm"
                />
              </div>
            )}

            {/* Webhook Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900">Webhook URL</h4>
              <p className="text-sm text-blue-800 mt-1">
                Configure this URL in your email provider (SendGrid, Mailgun,
                etc.):
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 bg-white px-3 py-1.5 rounded text-xs font-mono text-blue-900 border border-blue-200 break-all">
                  {webhookUrl}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyWebhookUrl}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
