'use server';

import { db } from '@/db';
import { organizations } from '@/db/schema';
import { requireInternalAdmin } from '@/lib/auth/permissions';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function updateOrgBrandingAction(orgId: string, branding: {
  nameOverride?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}) {
  await requireInternalAdmin();
  await db
    .update(organizations)
    .set({ branding, updatedAt: new Date() })
    .where(eq(organizations.id, orgId));
  revalidatePath(`/app/organizations/${orgId}`);
  return { success: true };
}

export async function updateOrgFeaturesAction(orgId: string, features: {
  assets?: boolean;
  exports?: boolean;
  team?: boolean;
  services?: boolean;
  knowledge?: boolean;
}) {
  await requireInternalAdmin();
  await db
    .update(organizations)
    .set({ features, updatedAt: new Date() })
    .where(eq(organizations.id, orgId));
  revalidatePath(`/app/organizations/${orgId}`);
  return { success: true };
}

