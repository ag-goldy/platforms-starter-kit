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
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateOrgContactInfo } from "./actions";

type ContactInfo = {
  orgId: string;
  supportPhone: string | null;
  supportEmail: string | null;
  supportUrl: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

interface ContactInfoFormProps {
  initial: ContactInfo;
}

export function ContactInfoForm({ initial }: ContactInfoFormProps) {
  const { success, error: showError } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    supportPhone: initial.supportPhone ?? "",
    supportEmail: initial.supportEmail ?? "",
    supportUrl: initial.supportUrl ?? "",
  });

  const hasChanges = useMemo(() => {
    return (
      form.supportPhone !== (initial.supportPhone ?? "") ||
      form.supportEmail !== (initial.supportEmail ?? "") ||
      form.supportUrl !== (initial.supportUrl ?? "")
    );
  }, [form, initial]);

  const handleChange = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updateOrgContactInfo({
        supportPhone: form.supportPhone,
        supportEmail: form.supportEmail,
        supportUrl: form.supportUrl,
      });
      if (result.success) {
        success("Support contacts saved");
      } else {
        showError(result.error || "Failed to save support contacts");
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
    <Card>
      <CardHeader>
        <CardTitle>Support contacts</CardTitle>
        <CardDescription>
          These details appear in emails sent to your customers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="supportPhone">Support phone</Label>
          <Input
            id="supportPhone"
            type="tel"
            value={form.supportPhone}
            onChange={handleChange("supportPhone")}
            placeholder="+1 555 0100"
          />
          <p className="text-xs text-muted-foreground">
            Phone number for support inquiries
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="supportEmail">Support email</Label>
          <Input
            id="supportEmail"
            type="email"
            value={form.supportEmail}
            onChange={handleChange("supportEmail")}
            placeholder="help@yourcompany.com"
          />
          <p className="text-xs text-muted-foreground">
            Email address customers can reach
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="supportUrl">Support URL</Label>
          <Input
            id="supportUrl"
            type="url"
            value={form.supportUrl}
            onChange={handleChange("supportUrl")}
            placeholder="https://help.yourcompany.com"
          />
          <p className="text-xs text-muted-foreground">
            Web URL for self-service support
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
