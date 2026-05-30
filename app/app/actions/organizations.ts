"use server";

import { db } from "@/db";
import {
  organizations,
  users,
  memberships,
  kbCategories,
  kbArticles,
  zabbixConfigs,
} from "@/db/schema";
import { requireInternalRole } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { revalidatePath } from "next/cache";
import { eq, and, asc } from "drizzle-orm";
import {
  invalidateOrgSettings,
  invalidateOrgAll,
} from "@/lib/cache-invalidation";
import type { OnboardingData } from "@/components/organizations/onboarding-wizard";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeCustomerId } from "@/lib/tickets/keys";
import { generateKbKey } from "@/lib/kb/keys";
import { ensureNotificationPreferencesForUser } from "@/lib/notifications/preferences";

export interface OrgEmailSettings {
  allowPublicIntake: boolean;
  intakeEmailAddress?: string | null;
  autoReplyEnabled: boolean;
  autoReplyTemplate?: string | null;
  emailDomain?: string | null;
}

export async function createOrganizationAction(data: {
  name: string;
  customerId?: string;
  slug: string;
  subdomain: string;
}) {
  const user = await requireInternalRole();

  // 5 org creations per hour per admin — prevents accidental mass org creation
  const rl = await rateLimit(`create-org:${user.user.id}`, {
    maxRequests: 5,
    windowSeconds: 3600,
  });
  if (!rl.allowed)
    throw new Error(
      "Rate limit exceeded: too many organizations created recently",
    );

  // Validate slug and subdomain format
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(data.slug) || !slugRegex.test(data.subdomain)) {
    throw new Error(
      "Slug and subdomain must be lowercase alphanumeric with hyphens only",
    );
  }
  const customerId = data.customerId
    ? normalizeCustomerId(data.customerId)
    : null;

  const [org] = await db
    .insert(organizations)
    .values({
      name: data.name,
      customerId,
      slug: data.slug,
      subdomain: data.subdomain,
    })
    .returning();

  await logAudit({
    userId: user.user.id,
    orgId: org.id,
    action: "ORG_CREATED",
    details: JSON.stringify({ name: org.name, slug: org.slug }),
  });

  // Create default automation rules for the new organization
  try {
    const { createDefaultRules } =
      await import("@/lib/automation/default-rules");
    await createDefaultRules(org.id);
  } catch (error) {
    console.error("Failed to create default automation rules:", error);
    // Don't fail organization creation if default rules fail
  }

  revalidatePath("/app/organizations");
  return { orgId: org.id };
}

/**
 * Create organization with full onboarding setup
 */
export async function createOrganizationWithOnboardingAction(
  data: OnboardingData,
) {
  const user = await requireInternalRole();

  // Validate slug and subdomain format
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(data.slug) || !slugRegex.test(data.subdomain)) {
    throw new Error(
      "Slug and subdomain must be lowercase alphanumeric with hyphens only",
    );
  }
  const customerId = data.customerId
    ? normalizeCustomerId(data.customerId)
    : null;

  // Create organization with all settings
  const [org] = await db
    .insert(organizations)
    .values({
      name: data.name,
      customerId,
      slug: data.slug,
      subdomain: data.subdomain,
      branding: {
        primaryColor: data.primaryColor,
        logoUrl: data.logoUrl || null,
      },
      businessHours: {
        timezone: data.timezone,
        workingDays: [1, 2, 3, 4, 5], // Mon-Fri
        workingHours: { start: "09:00", end: "17:00" },
        holidays: [],
      },
      // SLA Policy
      slaResponseHoursP1: data.slaPolicy.p1Response,
      slaResolutionHoursP1: data.slaPolicy.p1Resolution,
      slaResponseHoursP2: data.slaPolicy.p2Response,
      slaResolutionHoursP2: data.slaPolicy.p2Resolution,
      slaResponseHoursP3: data.slaPolicy.p3Response,
      slaResolutionHoursP3: data.slaPolicy.p3Resolution,
      slaResponseHoursP4: data.slaPolicy.p4Response,
      slaResolutionHoursP4: data.slaPolicy.p4Resolution,
    })
    .returning();

  // Create default automation rules
  try {
    const { createDefaultRules } =
      await import("@/lib/automation/default-rules");
    await createDefaultRules(org.id);
  } catch (error) {
    console.error("Failed to create default automation rules:", error);
  }

  // Create categories
  for (const categoryName of data.categories) {
    try {
      const slug = categoryName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      await db.insert(kbCategories).values({
        orgId: org.id,
        name: categoryName,
        slug,
        description: `Support category for ${categoryName}`,
        isPublic: true,
      });
    } catch (error) {
      console.error(`Failed to create category "${categoryName}":`, error);
    }
  }

  // Create default KB articles if requested
  if (data.createDefaultArticles) {
    const defaultArticles = [
      {
        title: "How to Connect to Hotel WiFi",
        content: `## How to Connect to Hotel WiFi

### Step 1: Select the Network
Look for the hotel's WiFi network name (SSID) on your device.

### Step 2: Enter the Password
Use the password provided at check-in or displayed in your room.

### Step 3: Accept Terms
Open your browser and accept the terms of service if prompted.

### Troubleshooting
- Try forgetting the network and reconnecting
- Ensure your device supports the network type
- Contact the front desk if issues persist`,
      },
      {
        title: "Using the In-Room Phone",
        content: `## Using the In-Room Phone

### Making Calls
- **Front Desk**: Dial 0
- **Room to Room**: Dial the room number directly
- **Outside Line**: Dial 9 + phone number

### Voicemail
- Press the "Voicemail" button or dial *98
- Default PIN is your room number

### Troubleshooting
- Check the phone cord is firmly connected
- For static, try hanging up and redialing`,
      },
      {
        title: "Troubleshooting TV Issues",
        content: `## Troubleshooting TV Issues

### No Signal
1. Check TV is on correct input (HDMI 1)
2. Ensure set-top box has power
3. Unplug set-top box for 10 seconds, then reconnect

### Remote Not Working
- Check battery orientation
- Point at set-top box, not TV
- Try replacing batteries

### Channels Missing
- Run channel scan from TV menu
- Contact front desk for premium channel issues`,
      },
    ];

    for (const article of defaultArticles) {
      try {
        await db.insert(kbArticles).values({
          orgId: org.id,
          title: article.title,
          slug: await generateKbKey(),
          content: article.content,
          contentType: "markdown",
          status: "PUBLISHED",
          visibility: "public",
          authorId: user.user.id,
        });
      } catch (error) {
        console.error(`Failed to create KB article "${article.title}":`, error);
      }
    }
  }

  // Invite team members
  for (const member of data.teamMembers) {
    try {
      let targetUser = await db.query.users.findFirst({
        where: eq(users.email, member.email),
      });

      if (!targetUser) {
        [targetUser] = await db
          .insert(users)
          .values({
            email: member.email,
            name: member.name,
            isInternal: false,
          })
          .returning();
        await ensureNotificationPreferencesForUser(targetUser.id);
      }

      await db.insert(memberships).values({
        userId: targetUser.id,
        orgId: org.id,
        role: member.role,
      });
    } catch (error) {
      console.error(`Failed to invite ${member.email}:`, error);
    }
  }

  // Configure Zabbix if provided
  if (data.zabbixUrl && data.zabbixToken) {
    try {
      await db.insert(zabbixConfigs).values({
        orgId: org.id,
        apiUrl: data.zabbixUrl,
        apiToken: data.zabbixToken,
        isActive: true,
        syncIntervalMinutes: 5,
      });
    } catch (error) {
      console.error("Failed to configure Zabbix:", error);
    }
  }

  await logAudit({
    userId: user.user.id,
    orgId: org.id,
    action: "ORG_CREATED",
    details: JSON.stringify({
      name: org.name,
      slug: org.slug,
      industry: data.industry,
      categories: data.categories.length,
      teamMembers: data.teamMembers.length,
    }),
  });

  revalidatePath("/app/organizations");
  return { orgId: org.id };
}

export async function updateOrganizationCustomerIdAction(
  orgId: string,
  customerId: string,
) {
  const session = await requireInternalRole();
  const normalizedCustomerId = customerId
    ? normalizeCustomerId(customerId)
    : null;

  await db
    .update(organizations)
    .set({
      customerId: normalizedCustomerId,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  await logAudit({
    actorId: session.user.id,
    actorKind: session.platformAdmin ? "platform_admin" : "user",
    orgId,
    action: "organization.customer_id_updated",
    resource: "organization",
    resourceId: orgId,
    details: { customerId: normalizedCustomerId },
  });

  await invalidateOrgSettings(orgId);
  revalidatePath(`/app/organizations/${orgId}`);
  return { success: true };
}

export async function updateOrg2FAPolicyAction(
  orgId: string,
  requireTwoFactor: boolean,
) {
  const user = await requireInternalRole();

  await db
    .update(organizations)
    .set({
      requireTwoFactor,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  await logAudit({
    userId: user.user.id,
    orgId,
    action: "ORG_UPDATED",
    details: JSON.stringify({ requireTwoFactor }),
  });

  // Invalidate org settings cache
  await invalidateOrgSettings(orgId);

  revalidatePath(`/app/organizations/${orgId}`);
  return { success: true, error: null };
}

export async function inviteUserAction(data: {
  orgId: string;
  email: string;
  name?: string;
  role: "CUSTOMER_ADMIN" | "REQUESTER" | "VIEWER";
}) {
  const user = await requireInternalRole();

  // Find or create user
  let targetUser = await db.query.users.findFirst({
    where: eq(users.email, data.email),
  });

  if (!targetUser) {
    [targetUser] = await db
      .insert(users)
      .values({
        email: data.email,
        name: data.name,
        isInternal: false,
      })
      .returning();
    await ensureNotificationPreferencesForUser(targetUser.id);
  }

  // Check if membership already exists
  const existingMembership = await db.query.memberships.findFirst({
    where: (memberships, { eq, and }) =>
      and(
        eq(memberships.userId, targetUser.id),
        eq(memberships.orgId, data.orgId),
      ),
  });

  if (existingMembership) {
    throw new Error("User is already a member of this organization");
  }

  // Create membership
  await db.insert(memberships).values({
    userId: targetUser.id,
    orgId: data.orgId,
    role: data.role,
  });

  await logAudit({
    userId: user.user.id,
    orgId: data.orgId,
    action: "USER_INVITED",
    details: JSON.stringify({ email: data.email, role: data.role }),
  });

  revalidatePath(`/app/organizations/${data.orgId}`);
}

export async function updateUserRoleAction(data: {
  orgId: string;
  userId: string;
  role: "CUSTOMER_ADMIN" | "REQUESTER" | "VIEWER";
}) {
  const user = await requireInternalRole();

  await db
    .update(memberships)
    .set({ role: data.role })
    .where(
      and(
        eq(memberships.userId, data.userId),
        eq(memberships.orgId, data.orgId),
      ),
    );

  await logAudit({
    userId: user.user.id,
    orgId: data.orgId,
    action: "USER_ROLE_CHANGED",
    details: JSON.stringify({ targetUserId: data.userId, role: data.role }),
  });

  revalidatePath(`/app/organizations/${data.orgId}`);
}

/**
 * Get all organizations (admin only)
 */
export async function getAllOrganizationsAction() {
  await requireInternalRole();

  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
    })
    .from(organizations)
    .orderBy(asc(organizations.name));

  return orgs;
}

/**
 * Disable an organization (soft disable - reversible)
 */
export async function disableOrganizationAction(orgId: string): Promise<void> {
  const user = await requireInternalRole();

  // Check if org exists and is not already disabled
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  if (!org.isActive) {
    throw new Error("Organization is already disabled");
  }

  // Update organization
  await db
    .update(organizations)
    .set({
      isActive: false,
      disabledAt: new Date(),
      disabledBy: user.user.id,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  // Log audit
  await logAudit({
    userId: user.user.id,
    orgId,
    action: "ORG_DISABLED",
    details: JSON.stringify({ name: org.name }),
  });

  // Invalidate cache
  await invalidateOrgSettings(orgId);
  await invalidateOrgAll(orgId);

  revalidatePath("/app/organizations");
  revalidatePath(`/app/organizations/${orgId}`);
}

/**
 * Enable a disabled organization
 */
export async function enableOrganizationAction(orgId: string): Promise<void> {
  const user = await requireInternalRole();

  // Check if org exists and is disabled
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  if (org.isActive) {
    throw new Error("Organization is already enabled");
  }

  // Update organization
  await db
    .update(organizations)
    .set({
      isActive: true,
      disabledAt: null,
      disabledBy: null,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  // Log audit
  await logAudit({
    userId: user.user.id,
    orgId,
    action: "ORG_ENABLED",
    details: JSON.stringify({ name: org.name }),
  });

  // Invalidate cache
  await invalidateOrgSettings(orgId);
  await invalidateOrgAll(orgId);

  revalidatePath("/app/organizations");
  revalidatePath(`/app/organizations/${orgId}`);
}

/**
 * Permanently delete an organization and all its data
 * REQUIRES: Organization must already be disabled
 * Uses CASCADE deletes from the database schema
 */
export async function deleteOrganizationAction(
  orgId: string,
  confirmationName: string,
): Promise<void> {
  const user = await requireInternalRole();

  // Get organization
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  // Verify confirmation name matches exactly
  if (confirmationName !== org.name) {
    throw new Error("Organization name does not match confirmation");
  }

  // Organization must be disabled before deletion
  if (org.isActive) {
    throw new Error("Organization must be disabled before it can be deleted");
  }

  // Log deletion BEFORE deleting (so we have the org reference)
  await logAudit({
    userId: user.user.id,
    orgId,
    action: "ORG_DELETED",
    details: JSON.stringify({
      deletedOrgId: orgId,
      deletedOrgName: org.name,
      deletedBy: user.user.id,
      deletedAt: new Date().toISOString(),
    }),
  });

  // Delete the organization - CASCADE will handle related records
  // Based on schema, these have onDelete: 'cascade' to organizations:
  // - services, assets, memberships, tickets, kbCategories, kbArticles, automationRules, escalationRules
  // auditLogs has onDelete: 'set null' so orgId will be nulled
  await db.delete(organizations).where(eq(organizations.id, orgId));

  // Invalidate all cache for this org
  await invalidateOrgAll(orgId);

  // Trigger blob storage cleanup (can be async)
  try {
    const { enqueueJob } = await import("@/lib/jobs/queue");
    await enqueueJob({
      type: "CLEANUP_ORG_STORAGE",
      data: { orgId },
      maxAttempts: 3,
    });
  } catch (error) {
    console.error("Failed to enqueue storage cleanup:", error);
    // Don't fail deletion if cleanup job fails
  }

  revalidatePath("/app/organizations");
}

/**
 * Update organization email-to-ticket settings
 */
export async function updateOrgEmailSettingsAction(
  orgId: string,
  settings: OrgEmailSettings,
) {
  const user = await requireInternalRole();

  // Validate intake email format if provided
  if (settings.intakeEmailAddress) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(settings.intakeEmailAddress)) {
      throw new Error("Invalid intake email address format");
    }
  }

  // Validate email domain format if provided
  if (settings.emailDomain) {
    const domainRegex =
      /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(settings.emailDomain)) {
      throw new Error("Invalid email domain format (e.g., hotel.com)");
    }
  }

  await db
    .update(organizations)
    .set({
      allowPublicIntake: settings.allowPublicIntake,
      intakeEmailAddress: settings.intakeEmailAddress || null,
      autoReplyEnabled: settings.autoReplyEnabled,
      autoReplyTemplate: settings.autoReplyTemplate || null,
      emailDomain: settings.emailDomain || null,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  await logAudit({
    userId: user.user.id,
    orgId,
    action: "ORG_UPDATED",
    details: JSON.stringify({
      emailSettings: {
        allowPublicIntake: settings.allowPublicIntake,
        intakeEmailAddress: settings.intakeEmailAddress,
        autoReplyEnabled: settings.autoReplyEnabled,
      },
    }),
  });

  // Invalidate org settings cache
  await invalidateOrgSettings(orgId);

  revalidatePath(`/app/organizations/${orgId}`);
  revalidatePath(`/app/organizations/${orgId}/email-settings`);
  return { success: true, error: null };
}
