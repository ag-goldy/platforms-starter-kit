/**
 * 2FA database queries
 */

import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { encryptSecret, decryptSecret } from './2fa';

export interface User2FAStatus {
  enabled: boolean;
  hasSecret: boolean;
  hasBackupCodes: boolean;
}

/**
 * Get user's 2FA status
 */
export async function getUser2FAStatus(userId: string): Promise<User2FAStatus> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorBackupCodes: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return {
    enabled: user.twoFactorEnabled || false,
    hasSecret: !!user.twoFactorSecret,
    hasBackupCodes: !!user.twoFactorBackupCodes,
  };
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

  await db
    .update(users)
    .set({
      twoFactorSecret: encryptedSecret,
      twoFactorBackupCodes: backupCodesJson,
      twoFactorEnabled: false, // Not enabled until verified
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Enable 2FA for a user (after verification)
 */
export async function enable2FA(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      twoFactorEnabled: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Disable 2FA for a user
 */
export async function disable2FA(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Get user's 2FA secret (decrypted)
 */
export async function getUser2FASecret(userId: string): Promise<string | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      twoFactorSecret: true,
    },
  });

  if (!user || !user.twoFactorSecret) {
    return null;
  }

  try {
    return decryptSecret(user.twoFactorSecret);
  } catch {
    return null;
  }
}

/**
 * Get user's backup codes (hashed)
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

