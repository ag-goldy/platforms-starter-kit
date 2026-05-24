import {
  Command,
  KeyRound,
  LifeBuoy,
  MessageSquarePlus,
  Search,
  SlidersHorizontal,
  Tags,
} from "lucide-react";
import type { Organization } from "@/db/schema";

export type EnterpriseIconName =
  | "activity"
  | "analytics"
  | "book"
  | "bot"
  | "building"
  | "clipboard"
  | "database"
  | "fileClock"
  | "flag"
  | "gauge"
  | "heartPulse"
  | "home"
  | "layers"
  | "listChecks"
  | "lock"
  | "messagePlus"
  | "network"
  | "panel"
  | "shield"
  | "shieldCheck"
  | "siren"
  | "tags"
  | "ticket"
  | "users"
  | "workflow";

export type AdminNavItem = {
  href: string;
  label: string;
  description?: string;
  icon: EnterpriseIconName;
  exact?: boolean;
};

export type AdminNavSection = {
  label: string;
  items: AdminNavItem[];
};

export type CustomerPortalCapabilities = {
  tickets: boolean;
  knowledge: boolean;
  serviceCatalog: boolean;
  kbContributions: boolean;
  teamTicketMonitoring: boolean;
};

export type CustomerNavItem = {
  href: string;
  label: string;
  description?: string;
  icon: EnterpriseIconName;
  exact?: boolean;
  adminOnly?: boolean;
  capability?: keyof CustomerPortalCapabilities;
  primary?: boolean;
};

export type EnterprisePageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
};

export const adminNavSections: AdminNavSection[] = [
  {
    label: "Command Center",
    items: [
      {
        href: "/app",
        label: "Overview",
        description: "Queue health and activity",
        icon: "gauge",
        exact: true,
      },
      {
        href: "/app/reports",
        label: "Analytics",
        description: "Operational reporting",
        icon: "analytics",
      },
    ],
  },
  {
    label: "Service Desk",
    items: [
      {
        href: "/app/tickets",
        label: "Tickets",
        description: "Queue and lifecycle",
        icon: "ticket",
      },
      {
        href: "/app/tags",
        label: "Tags",
        description: "Queue classification",
        icon: "tags",
      },
      {
        href: "/app/templates",
        label: "Templates",
        description: "Canned workflows",
        icon: "clipboard",
      },
    ],
  },
  {
    label: "Customers",
    items: [
      {
        href: "/app/organizations",
        label: "Organizations",
        description: "Tenants and customer IDs",
        icon: "building",
      },
      {
        href: "/app/users",
        label: "Users",
        description: "Agents and customers",
        icon: "users",
      },
    ],
  },
  {
    label: "Knowledge",
    items: [
      {
        href: "/app/kb",
        label: "Knowledge Base",
        description: "Articles and review",
        icon: "book",
      },
    ],
  },
  {
    label: "ITSM Configuration",
    items: [
      {
        href: "/app/sla",
        label: "SLA Policies",
        description: "Response and resolution targets",
        icon: "fileClock",
      },
      {
        href: "/app/admin/internal-groups",
        label: "Internal Groups",
        description: "Support ownership",
        icon: "layers",
      },
      {
        href: "/app/organizations",
        label: "Catalog & Routing",
        description: "Org services and request types",
        icon: "workflow",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/app/admin/ops",
        label: "Operations",
        description: "System operations",
        icon: "activity",
      },
      {
        href: "/app/admin/health",
        label: "System Health",
        description: "Service status",
        icon: "heartPulse",
      },
      {
        href: "/app/admin/jobs",
        label: "Job Queue",
        description: "Background tasks",
        icon: "listChecks",
      },
      {
        href: "/app/admin/integrations",
        label: "Integrations",
        description: "External services",
        icon: "network",
      },
      {
        href: "/app/admin/zabbix",
        label: "Zabbix",
        description: "Monitoring sync",
        icon: "siren",
      },
    ],
  },
  {
    label: "Governance",
    items: [
      {
        href: "/app/admin/audit",
        label: "Audit Logs",
        description: "Security events",
        icon: "shieldCheck",
      },
      {
        href: "/app/admin/compliance",
        label: "Compliance",
        description: "Policies and retention",
        icon: "lock",
      },
      {
        href: "/app/admin/retention",
        label: "Retention",
        description: "Data lifecycle",
        icon: "database",
      },
      {
        href: "/app/admin/ai-audit",
        label: "AI Audit",
        description: "AI usage review",
        icon: "bot",
      },
    ],
  },
  {
    label: "Platform",
    items: [
      {
        href: "/admin",
        label: "Platform Control",
        description: "Cross-tenant controls",
        icon: "shield",
      },
    ],
  },
];

export const platformNavSections: AdminNavSection[] = [
  {
    label: "Platform",
    items: [
      {
        href: "/admin",
        label: "Tenants",
        description: "Cross-tenant control",
        icon: "building",
        exact: true,
      },
      {
        href: "/admin/audit",
        label: "Audit",
        description: "Platform audit stream",
        icon: "shieldCheck",
      },
      {
        href: "/admin/health",
        label: "Health",
        description: "Runtime status",
        icon: "heartPulse",
      },
      {
        href: "/admin/jobs",
        label: "Failed Jobs",
        description: "Queue failures",
        icon: "listChecks",
      },
      {
        href: "/admin/integrations",
        label: "Integrations",
        description: "External service controls",
        icon: "network",
      },
      {
        href: "/admin/zabbix",
        label: "Zabbix",
        description: "Monitoring integration",
        icon: "siren",
      },
      {
        href: "/admin/feature-flags",
        label: "Feature Flags",
        description: "Guarded rollout",
        icon: "flag",
      },
    ],
  },
];

export function getCustomerPortalCapabilities(
  org: Pick<Organization, "features">,
  isCustomerAdmin: boolean,
): CustomerPortalCapabilities {
  return {
    tickets: true,
    knowledge: org.features?.knowledge !== false,
    serviceCatalog:
      org.features?.service_catalog !== false &&
      org.features?.services !== false,
    kbContributions: isCustomerAdmin && org.features?.knowledge !== false,
    teamTicketMonitoring: isCustomerAdmin,
  };
}

export function getCustomerNavItems(
  subdomain: string,
  capabilities: CustomerPortalCapabilities,
): CustomerNavItem[] {
  const items: CustomerNavItem[] = [
    {
      href: `/s/${subdomain}`,
      label: "Home",
      description: "Request status and updates",
      icon: "home",
      exact: true,
    },
    {
      href: `/s/${subdomain}/tickets`,
      label: "Requests",
      description: "Track support requests",
      icon: "ticket",
      capability: "tickets",
    },
    {
      href: `/s/${subdomain}/tickets/new`,
      label: "New Request",
      description: "Open a support request",
      icon: "messagePlus",
      capability: "tickets",
      primary: true,
    },
    {
      href: `/s/${subdomain}/kb`,
      label: "Knowledge",
      description: "Find approved answers",
      icon: "book",
      capability: "knowledge",
    },
    {
      href: `/s/${subdomain}/services`,
      label: "Service Catalog",
      description: "Admin-published ITSM forms",
      icon: "panel",
      capability: "serviceCatalog",
    },
    {
      href: `/s/${subdomain}/kb/submit`,
      label: "KB Review",
      description: "Submit customer drafts",
      icon: "clipboard",
      adminOnly: true,
      capability: "kbContributions",
    },
    {
      href: `/s/${subdomain}/team`,
      label: "Team Requests",
      description: "Monitor team tickets",
      icon: "users",
      adminOnly: true,
      capability: "teamTicketMonitoring",
    },
  ];

  return items.filter(
    (item) => !item.capability || capabilities[item.capability],
  );
}

export const enterpriseQuickActions = [
  { href: "/app/tickets/new", label: "Create ticket", icon: MessageSquarePlus },
  { href: "/app/tags", label: "Manage tags", icon: Tags },
  { href: "/app/admin/audit", label: "Audit search", icon: Search },
  {
    href: "/app/admin/integrations",
    label: "Configure integration",
    icon: SlidersHorizontal,
  },
  { href: "/admin", label: "Platform tenants", icon: KeyRound },
  { href: "/app", label: "Command center", icon: Command },
];
