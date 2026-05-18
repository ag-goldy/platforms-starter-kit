/**
 * 2FA database queries
 */

import { db } from '@/db';
import { users, platformAdmins } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { encryptSecret, decryptSecret } from './2fa';

export interface User2FAStatus {
  enabled: boolean;
  hasSecret: boolean;
  hasBackupCodes: boolean;
}

/**
 * Get user's 2FA status
 * Checks both tenant users and platform admins
 */
export async function getUser2FAStatus(userId: string): Promise<User2FAStatus> {
  // Check tenant users first
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorBackupCodes: true,
    },
  });

  if (user) {
    return {
      enabled: user.twoFactorEnabled || false,
      hasSecret: !!user.twoFactorSecret,
      hasBackupCodes: !!user.twoFactorBackupCodes,
    };
  }

  // Check platform admins
  const platformAdmin = await db.query.platformAdmins.findFirst({
    where: eq(platformAdmins.id, userId),
    columns: {
      twoFactorEnabled: true,
      twoFactorSecret: true,
    },
  });

  if (platformAdmin) {
    return {
      enabled: platformAdmin.twoFactorEnabled || false,
      hasSecret: !!platformAdmin.twoFactorSecret,
      hasBackupCodes: false, // Platform admins don't use backup codes (for now)
    };
  }

  throw new Error('User not found');
}

/**
 * Save 2FA secret and backup codes for a user
 */
export async function save2FASecret(
  userId: string,
  secret: string,
  backupCodes: string[]
): Promise<void> {
  const encryptedSecret = encryptSecret(secret);
  const backupCodesJson = JSON.stringify(backupCodes);

  // Check if this is a tenant user
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true },
  });

  if (user) {
    await db
      .update(users)
      .set({
        twoFactorSecret: encryptedSecret,
        twoFactorBackupCodes: backupCodesJson,
        twoFactorEnabled: false, // Not enabled until verified
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return;
  }

  // Check if this is a platform admin
  const platformAdmin = await db.query.platformAdmins.findFirst({
    where: eq(platformAdmins.id, userId),
    columns: { id: true },
  });

  if (platformAdmin) {
    await db
      .update(platformAdmins)
      .set({
        twoFactorSecret: encryptedSecret,
        twoFactorEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(platformAdmins.id, userId));
    return;
  }

  throw new Error('User not found');
}

/**
 * Enable 2FA for a user (after verification)
 */
export async function enable2FA(userId: string): Promise<void> {
  // Check if this is a tenant user
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true },
  });

  if (user) {
    await db
      .update(users)
      .set({
        twoFactorEnabled: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return;
  }

  // Check if this is a platform admin
  const platformAdmin = await db.query.platformAdmins.findFirst({
    where: eq(platformAdmins.id, userId),
    columns: { id: true },
  });

  if (platformAdmin) {
    await db
      .update(platformAdmins)
      .set({
        twoFactorEnabled: true,
        updatedAt: new Date(),
      })
      .where(eq(platformAdmins.id, userId));
    return;
  }

  throw new Error('User not found');
}

/**
 * Disable 2FA for a user
 */
export async function disable2FA(userId: string): Promise<void> {
  // Check if this is a tenant user
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true },
  });

  if (user) {
    await db
      .update(users)
      .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return;
  }

  // Check if this is a platform admin
  const platformAdmin = await db.query.platformAdmins.findFirst({
    where: eq(platformAdmins.id, userId),
    columns: { id: true },
  });

  if (platformAdmin) {
    await db
      .update(platformAdmins)
      .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        updatedAt: new Date(),
      })
      .where(eq(platformAdmins.id, userId));
    return;
  }

  throw new Error('User not found');
}

/**
 * Get user's 2FA secret (decrypted)
 */
export async function getUser2FASecret(userId: string): Promise<string | null> {
  // Check tenant users first
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      twoFactorSecret: true,
    },
  });

  if (user?.twoFactorSecret) {
    try {
      return decryptSecret(user.twoFactorSecret);
    } catch {
      return null;
    }
  }

  // Check platform admins
  const platformAdmin = await db.query.platformAdmins.findFirst({
    where: eq(platformAdmins.id, userId),
    columns: {
      twoFactorSecret: true,
    },
  });

  if (platformAdmin?.twoFactorSecret) {
    try {
      return decryptSecret(platformAdmin.twoFactorSecret);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Get user's backup codes (hashed)
 * Note: Platform admins don't have backup codes
 */
export async function getUserBackupCodes(userId: string): Promise<string[]> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      twoFactorBackupCodes: true,
    },
  });

  if (!user || !user.twoFactorBackupCodes) {
    return [];
  }

  try {
    return JSON.parse(user.twoFactorBackupCodes) as string[];
  } catch {
    return [];
  }
}

/**
 * Update backup codes
 * Note: Only tenant users have backup codes, platform admins don't
 */
export async function updateBackupCodes(userId: string, backupCodes: string[]): Promise<void> {
  const backupCodesJson = JSON.stringify(backupCodes);

  await db
    .update(users)
    .set({
      twoFactorBackupCodes: backupCodesJson,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Remove a used backup code
 */
export async function removeBackupCode(userId: string, usedCodeHash: string): Promise<void> {
  const codes = await getUserBackupCodes(userId);
  const updatedCodes = codes.filter((code) => code !== usedCodeHash);

  await updateBackupCodes(userId, updatedCodes);
}

