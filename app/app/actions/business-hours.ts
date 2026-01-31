'use server';

import { requireInternalRole, requireInternalAdmin } from '@/lib/auth/permissions';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { BusinessHoursConfig } from '@/lib/sla/business-hours';
import { getDefaultBusinessHours } from '@/lib/sla/business-hours';

/**
 * Get business hours configuration for an organization
 */
export async function getBusinessHoursAction(orgId: string) {
  await requireInternalRole();
  
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: {
      businessHours: true,
    },
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  return org.businessHours || getDefaultBusinessHours();
}

/**
 * Update business hours configuration for an organization (admin only)
 */
export async function updateBusinessHoursAction(
  orgId: string,
  config: BusinessHoursConfig
) {
  await requireInternalAdmin();

  // Validate configuration
  if (!config.timezone) {
    throw new Error('Timezone is required');
  }
  if (!config.workingDays || config.workingDays.length === 0) {
    throw new Error('At least one working day is required');
  }
  if (!config.workingHours?.start || !config.workingHours?.end) {
    throw new Error('Working hours start and end are required');
  }

  await db
    .update(organizations)
    .set({
      businessHours: {
        ...config,
        holidays: config.holidays || [],
      },
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  return { success: true };
}

/**
 * Reset business hours to default (admin only)
 */
export async function resetBusinessHoursAction(orgId: string) {
  await requireInternalAdmin();

  const defaultConfig = getDefaultBusinessHours();

  await db
    .update(organizations)
    .set({
      businessHours: {
        ...defaultConfig,
        holidays: defaultConfig.holidays || [],
      },
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  return { success: true };
}

