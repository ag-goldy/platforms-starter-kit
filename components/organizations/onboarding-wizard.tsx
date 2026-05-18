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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  Building2,
  Palette,
  Users,
  Tags,
  BookOpen,
  Settings,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Upload,
  Monitor,
  Briefcase,
  Clock,
  Wifi,
  Tv,
  Phone,
  Shield,
  KeyRound,
  Loader2,
  Sparkles,
  Plus,
  X,
} from "lucide-react";

// Hospitality industry defaults
const HOSPITALITY_CATEGORIES = [
  {
    name: "WiFi/Network",
    icon: Wifi,
    description: "Internet connectivity, network issues",
  },
  {
    name: "IPTV",
    icon: Tv,
    description: "TV service, streaming, in-room entertainment",
  },
  {
    name: "VoIP",
    icon: Phone,
    description: "Phone systems, voicemail, call issues",
  },
  {
    name: "Security/CCTV",
    icon: Shield,
    description: "Cameras, security systems, access logs",
  },
  {
    name: "Access Control",
    icon: KeyRound,
    description: "Key cards, door access, locks",
  },
  {
    name: "General IT",
    icon: Briefcase,
    description: "Computers, printers, general support",
  },
];

const DEFAULT_KB_ARTICLES = [
  {
    title: "How to Connect to Hotel WiFi",
    content: `# How to Connect to Hotel WiFi

## Step 1: Select the Network
Look for the hotel's WiFi network name (SSID) on your device. This is usually displayed in your room or at the front desk.

## Step 2: Enter the Password
Use the password provided at check-in or displayed in your room.

## Step 3: Accept Terms
Open your browser and accept the terms of service if prompted.

## Troubleshooting
- If you can't connect, try forgetting the network and reconnecting
- Ensure your device supports the network type (2.4GHz or 5GHz)
- Contact the front desk if you continue to have issues`,
    category: "WiFi/Network",
  },
  {
    title: "Using the In-Room Phone",
    content: `# Using the In-Room Phone

## Making Calls
- **Front Desk**: Dial 0 or press the "Front Desk" button
- **Room to Room**: Dial the room number directly
- **Outside Line**: Dial 9 + phone number

## Voicemail
- Press the "Voicemail" button or dial *98
- Default PIN is your room number
- Follow the prompts to set up your greeting

## Troubleshooting
- If no dial tone, check the phone cord is firmly connected
- For static or poor quality, try hanging up and redialing`,
    category: "VoIP",
  },
  {
    title: "Troubleshooting TV Issues",
    content: `# Troubleshooting TV Issues

## No Signal
1. Check that the TV is on the correct input (usually HDMI 1)
2. Ensure the set-top box has power (green light)
3. Try unplugging the set-top box for 10 seconds, then plug back in

## Remote Not Working
- Check battery orientation
- Point directly at the set-top box, not the TV
- Try replacing batteries

## Channels Missing
- Run a channel scan from the TV menu
- Contact front desk if premium channels are not working`,
    category: "IPTV",
  },
];

const DEFAULT_SLA = {
  p1Response: 1,
  p1Resolution: 4,
  p2Response: 4,
  p2Resolution: 24,
  p3Response: 8,
  p3Resolution: 72,
  p4Response: 24,
  p4Resolution: 168,
};

interface OnboardingWizardProps {
  onComplete: (data: OnboardingData) => Promise<void>;
  onCancel: () => void;
}

export interface OnboardingData {
  // Step 1: Basic Info
  name: string;
  customerId: string;
  slug: string;
  subdomain: string;
  industry: string;
  timezone: string;

  // Step 2: Branding
  primaryColor: string;
  logoUrl?: string;

  // Step 3: Team
  teamMembers: Array<{
    email: string;
    name: string;
    role: "CUSTOMER_ADMIN" | "REQUESTER" | "VIEWER";
  }>;

  // Step 4: Categories
  categories: string[];

  // Step 5: KB Articles
  createDefaultArticles: boolean;

  // Step 7: Integration
  zabbixUrl?: string;
  zabbixToken?: string;

  // Step 7: SLA
  slaPolicy: typeof DEFAULT_SLA;
}

const INDUSTRIES = [
  {
    value: "hospitality",
    label: "Hospitality (Hotels/Resorts)",
    icon: Building2,
  },
  { value: "healthcare", label: "Healthcare", icon: Shield },
  { value: "retail", label: "Retail", icon: Briefcase },
  { value: "education", label: "Education", icon: BookOpen },
  { value: "corporate", label: "Corporate/Office", icon: Building2 },
  { value: "other", label: "Other", icon: Briefcase },
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT)" },
];

const STEPS = [
  { id: 1, title: "Basic Info", icon: Building2 },
  { id: 2, title: "Branding", icon: Palette },
  { id: 3, title: "Team", icon: Users },
  { id: 4, title: "Categories", icon: Tags },
  { id: 5, title: "Knowledge Base", icon: BookOpen },
  { id: 6, title: "SLA Policy", icon: Clock },
  { id: 7, title: "Integrations", icon: Settings },
  { id: 8, title: "Review", icon: CheckCircle2 },
];

export function OnboardingWizard({
  onComplete,
  onCancel,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useToast();

  const [data, setData] = useState<OnboardingData>({
    name: "",
    customerId: "",
    slug: "",
    subdomain: "",
    industry: "hospitality",
    timezone: "America/New_York",
    primaryColor: "#0f172a",
    teamMembers: [],
    categories: HOSPITALITY_CATEGORIES.map((c) => c.name),
    createDefaultArticles: true,
    slaPolicy: DEFAULT_SLA,
  });

  const [newMember, setNewMember] = useState({
    email: "",
    name: "",
    role: "REQUESTER" as const,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Auto-generate slug and subdomain from name
  const handleNameChange = (value: string) => {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    setData((prev) => ({
      ...prev,
      name: value,
      slug: prev.slug || slug,
      subdomain: prev.subdomain || slug,
    }));
  };

  const handleNext = () => {
    // Validate current step
    if (currentStep === 1) {
      if (!data.name || !data.customerId || !data.slug || !data.subdomain) {
        showError("Please fill in all required fields");
        return;
      }
    }

    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      await onComplete(data);
      success("Organization created successfully!");
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Failed to create organization",
      );
      setIsSubmitting(false);
    }
  };

  const addTeamMember = () => {
    if (!newMember.email || !newMember.name) {
      showError("Please enter both name and email");
      return;
    }

    setData((prev) => ({
      ...prev,
      teamMembers: [...prev.teamMembers, newMember],
    }));
    setNewMember({ email: "", name: "", role: "REQUESTER" });
  };

  const removeTeamMember = (index: number) => {
    setData((prev) => ({
      ...prev,
      teamMembers: prev.teamMembers.filter((_, i) => i !== index),
    }));
  };

  const toggleCategory = (categoryName: string) => {
    setData((prev) => ({
      ...prev,
      categories: prev.categories.includes(categoryName)
        ? prev.categories.filter((c) => c !== categoryName)
        : [...prev.categories, categoryName],
    }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: // Basic Info
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name *</Label>
              <Input
                id="name"
                value={data.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Grand Hotel & Resort"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerId">Customer ID *</Label>
              <Input
                id="customerId"
                value={data.customerId}
                onChange={(e) =>
                  setData((prev) => ({
                    ...prev,
                    customerId: e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, ""),
                  }))
                }
                placeholder="ACME"
                pattern="[A-Z0-9]+"
                required
              />
              <p className="text-xs text-gray-500">
                Used for ticket IDs, for example ACME(INC)123456.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  value={data.slug}
                  onChange={(e) =>
                    setData((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  placeholder="grand-hotel"
                  pattern="[a-z0-9-]+"
                  required
                />
                <p className="text-xs text-gray-500">
                  Lowercase letters, numbers, hyphens
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subdomain">Subdomain *</Label>
                <Input
                  id="subdomain"
                  value={data.subdomain}
                  onChange={(e) =>
                    setData((prev) => ({ ...prev, subdomain: e.target.value }))
                  }
                  placeholder="grand-hotel"
                  pattern="[a-z0-9-]+"
                  required
                />
                <p className="text-xs text-gray-500">
                  Customer portal: {data.subdomain || "subdomain"}
                  .atlas.agrnetworks.com
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <select
                  id="industry"
                  value={data.industry}
                  onChange={(e) =>
                    setData((prev) => ({ ...prev, industry: e.target.value }))
                  }
                  className="w-full h-10 px-3 rounded-md border border-gray-200 bg-white"
                >
                  {INDUSTRIES.map((ind) => (
                    <option key={ind.value} value={ind.value}>
                      {ind.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  value={data.timezone}
                  onChange={(e) =>
                    setData((prev) => ({ ...prev, timezone: e.target.value }))
                  }
                  className="w-full h-10 px-3 rounded-md border border-gray-200 bg-white"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );

      case 2: // Branding
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                  {logoFile ? (
                    <img
                      src={URL.createObjectURL(logoFile)}
                      alt="Logo preview"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <Upload className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Recommended: 400x400px, PNG or SVG
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Brand Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="primaryColor"
                  value={data.primaryColor}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      primaryColor: e.target.value,
                    }))
                  }
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <Input
                  value={data.primaryColor}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      primaryColor: e.target.value,
                    }))
                  }
                  placeholder="#0f172a"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-gray-500">
                Used for buttons, links, and accents
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-2">Preview</h4>
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-white"
                style={{ backgroundColor: data.primaryColor }}
              >
                <Sparkles className="w-4 h-4" />
                Sample Button
              </div>
            </div>
          </div>
        );

      case 3: // Team
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Invite your initial team members. You can always add more later.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={newMember.name}
                  onChange={(e) =>
                    setNewMember((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="John Smith"
                />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={newMember.email}
                  onChange={(e) =>
                    setNewMember((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <Label className="text-xs">Role</Label>
                <div className="flex gap-2">
                  <select
                    value={newMember.role}
                    onChange={(e) =>
                      setNewMember((prev) => ({
                        ...prev,
                        role: e.target.value as typeof newMember.role,
                      }))
                    }
                    className="flex-1 h-10 px-3 rounded-md border border-gray-200 bg-white"
                  >
                    <option value="CUSTOMER_ADMIN">Admin</option>
                    <option value="REQUESTER">Requester</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <Button type="button" onClick={addTeamMember} size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {data.teamMembers.length > 0 && (
              <div className="space-y-2">
                <Label>Invited Members</Label>
                <div className="space-y-2">
                  {data.teamMembers.map((member, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-gray-500">
                          {member.email} • {member.role}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTeamMember(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-sm text-gray-500">
              <p className="font-medium">Role descriptions:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>
                  <strong>Admin</strong> - Full access to manage tickets, users,
                  and settings
                </li>
                <li>
                  <strong>Requester</strong> - Can create and view tickets
                </li>
                <li>
                  <strong>Viewer</strong> - Read-only access to tickets
                </li>
              </ul>
            </div>
          </div>
        );

      case 4: // Categories
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Select ticket categories for your organization.
                {data.industry === "hospitality" &&
                  " We've pre-selected common hospitality categories."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {HOSPITALITY_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = data.categories.includes(cat.name);
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => toggleCategory(cat.name)}
                    className={`flex items-start gap-3 p-4 rounded-lg border text-left transition-colors ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 mt-0.5 ${isSelected ? "text-blue-600" : "text-gray-500"}`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{cat.name}</span>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {cat.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customCategory">Add Custom Category</Label>
              <div className="flex gap-2">
                <Input
                  id="customCategory"
                  placeholder="e.g., HVAC, POS Systems"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const value = (e.target as HTMLInputElement).value;
                      if (value && !data.categories.includes(value)) {
                        setData((prev) => ({
                          ...prev,
                          categories: [...prev.categories, value],
                        }));
                        (e.target as HTMLInputElement).value = "";
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        );

      case 5: // Knowledge Base
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Create Default Articles</h4>
                    <p className="text-sm text-gray-500">
                      Automatically create helpful KB articles for common issues
                    </p>
                    <ul className="text-xs text-gray-500 mt-2 space-y-1">
                      {DEFAULT_KB_ARTICLES.map((article) => (
                        <li key={article.title}>• {article.title}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={data.createDefaultArticles}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      createDefaultArticles: e.target.checked,
                    }))
                  }
                  className="w-5 h-5"
                />
              </div>

              <div className="bg-gray-50 border rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">
                  Sample Article Preview
                </h4>
                <div className="bg-white rounded border p-4 text-sm">
                  <h5 className="font-medium">How to Connect to Hotel WiFi</h5>
                  <p className="text-gray-600 mt-1">
                    Step-by-step guide for guests to connect to the hotel&apos;s
                    WiFi network...
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 6: // SLA Policy
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Set default SLA targets for ticket response and resolution
                times.
                {data.industry === "hospitality" &&
                  " We've set hospitality-appropriate defaults."}
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  key: "p1",
                  label: "P1 - Critical",
                  desc: "System down, major impact",
                  color: "text-red-600",
                },
                {
                  key: "p2",
                  label: "P2 - High",
                  desc: "Significant degradation",
                  color: "text-orange-600",
                },
                {
                  key: "p3",
                  label: "P3 - Medium",
                  desc: "Minor impact",
                  color: "text-yellow-600",
                },
                {
                  key: "p4",
                  label: "P4 - Low",
                  desc: "General questions",
                  color: "text-green-600",
                },
              ].map(({ key, label, desc, color }) => (
                <div
                  key={key}
                  className="grid grid-cols-3 gap-4 items-center p-4 border rounded-lg"
                >
                  <div>
                    <span className={`font-medium ${color}`}>{label}</span>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Response (hours)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={
                        data.slaPolicy[
                          `${key}Response` as keyof typeof data.slaPolicy
                        ]
                      }
                      onChange={(e) =>
                        setData((prev) => ({
                          ...prev,
                          slaPolicy: {
                            ...prev.slaPolicy,
                            [`${key}Response`]: parseInt(e.target.value) || 0,
                          },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Resolution (hours)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={
                        data.slaPolicy[
                          `${key}Resolution` as keyof typeof data.slaPolicy
                        ]
                      }
                      onChange={(e) =>
                        setData((prev) => ({
                          ...prev,
                          slaPolicy: {
                            ...prev.slaPolicy,
                            [`${key}Resolution`]: parseInt(e.target.value) || 0,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 7: // Integrations (Zabbix)
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 border rounded-lg bg-gray-50">
                <Monitor className="w-8 h-8 text-blue-600" />
                <div className="flex-1">
                  <h4 className="font-medium">Zabbix Monitoring</h4>
                  <p className="text-sm text-gray-500">
                    Connect to your Zabbix server for automatic service
                    monitoring and status pages
                  </p>
                </div>
                <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                  Optional
                </span>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="zabbixUrl">Zabbix API URL</Label>
                  <Input
                    id="zabbixUrl"
                    value={data.zabbixUrl || ""}
                    onChange={(e) =>
                      setData((prev) => ({
                        ...prev,
                        zabbixUrl: e.target.value,
                      }))
                    }
                    placeholder="https://zabbix.yourcompany.com/api_jsonrpc.php"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zabbixToken">API Token</Label>
                  <Input
                    id="zabbixToken"
                    type="password"
                    value={data.zabbixToken || ""}
                    onChange={(e) =>
                      setData((prev) => ({
                        ...prev,
                        zabbixToken: e.target.value,
                      }))
                    }
                    placeholder="Your Zabbix API token"
                  />
                  <p className="text-xs text-gray-500">
                    Create a token in Zabbix: Administration → General → API
                    tokens
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> You can skip this step and configure
                  Zabbix later in the organization settings.
                </p>
              </div>
            </div>
          </div>
        );

      case 8: // Review
        return (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-900">
                  Ready to go live!
                </span>
              </div>
              <p className="text-sm text-green-800 mt-1">
                Review your configuration below and click &quot;Create
                Organization&quot; to finish.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-sm text-gray-500">
                    Organization
                  </h4>
                  <p className="text-lg">{data.name}</p>
                  <p className="text-sm text-gray-600">
                    {data.subdomain}.atlas.agrnetworks.com
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-sm text-gray-500">
                    Industry & Timezone
                  </h4>
                  <p>
                    {INDUSTRIES.find((i) => i.value === data.industry)?.label}
                  </p>
                  <p className="text-sm text-gray-600">
                    {TIMEZONES.find((t) => t.value === data.timezone)?.label}
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-sm text-gray-500">
                    Team Members
                  </h4>
                  <p className="text-2xl">{data.teamMembers.length}</p>
                  <p className="text-sm text-gray-600">invited</p>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-sm text-gray-500">
                    Categories
                  </h4>
                  <p className="text-2xl">{data.categories.length}</p>
                  <p className="text-sm text-gray-600">configured</p>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-sm text-gray-500">
                    KB Articles
                  </h4>
                  <p className="text-2xl">
                    {data.createDefaultArticles
                      ? DEFAULT_KB_ARTICLES.length
                      : 0}
                  </p>
                  <p className="text-sm text-gray-600">will be created</p>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-sm text-gray-500">Zabbix</h4>
                  <p className="text-2xl">{data.zabbixUrl ? "✓" : "—"}</p>
                  <p className="text-sm text-gray-600">
                    {data.zabbixUrl ? "configured" : "not configured"}
                  </p>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-sm text-gray-500 mb-2">
                  SLA Summary
                </h4>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="text-red-600 font-medium">
                    P1: {data.slaPolicy.p1Response}h/
                    {data.slaPolicy.p1Resolution}h
                  </div>
                  <div className="text-orange-600 font-medium">
                    P2: {data.slaPolicy.p2Response}h/
                    {data.slaPolicy.p2Resolution}h
                  </div>
                  <div className="text-yellow-600 font-medium">
                    P3: {data.slaPolicy.p3Response}h/
                    {data.slaPolicy.p3Resolution}h
                  </div>
                  <div className="text-green-600 font-medium">
                    P4: {data.slaPolicy.p4Response}h/
                    {data.slaPolicy.p4Resolution}h
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Response/Resolution hours
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Create New Organization</CardTitle>
            <CardDescription>
              Step {currentStep} of {STEPS.length}:{" "}
              {STEPS[currentStep - 1].title}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index + 1 === currentStep;
              const isCompleted = index + 1 < currentStep;
              return (
                <div
                  key={step.id}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : isCompleted
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-400"
                  }`}
                  title={step.title}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="min-h-[400px]">{renderStep()}</div>

        <div className="flex justify-between mt-8 pt-6 border-t">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? onCancel : handleBack}
            disabled={isSubmitting}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            {currentStep === 1 ? "Cancel" : "Back"}
          </Button>

          {currentStep < STEPS.length ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Create Organization
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
