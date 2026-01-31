'use server';

import { requireAuth } from '@/lib/auth/permissions';
import { generateSecret, generateQRCode, verifyTOTP, generateBackupCodes, verifyBackupCode } from '@/lib/auth/2fa';
import {
  save2FASecret,
  enable2FA,
  disable2FA,
  getUser2FASecret,
  getUserBackupCodes,
  updateBackupCodes,
  removeBackupCode,
  getUser2FAStatus,
} from '@/lib/auth/2fa-queries';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit/log';

/**
 * Start 2FA setup - generate secret and QR code
 */
export async function start2FASetupAction() {
  const user = await requireAuth();
  
  const secret = generateSecret();
  const qrCode = await generateQRCode(secret, user.email);
  const { plain: backupCodes, hashed } = generateBackupCodes();
  
  // Save secret and backup codes (but don't enable yet)
  await save2FASecret(user.id, secret, hashed);
  
  return {
    success: true,
    secret, // Only returned during setup
    qrCode,
    backupCodes, // Show once, user should save them
    error: null,
  };
}

/**
 * Verify 2FA setup token and enable 2FA
 */
export async function verify2FASetupAction(token: string) {
  const user = await requireAuth();
  
  const secret = await getUser2FASecret(user.id);
  if (!secret) {
    return {
      success: false,
      error: '2FA setup not started. Please start setup first.',
    };
  }
  
  const isValid = verifyTOTP(secret, token);
  if (!isValid) {
    return {
      success: false,
      error: 'Invalid verification code. Please try again.',
    };
  }
  
  // Enable 2FA
  await enable2FA(user.id);
  
  await logAudit({
    userId: user.id,
    action: 'USER_2FA_ENABLED',
    details: JSON.stringify({ userId: user.id }),
  });
  
  revalidatePath('/app/settings/security');
  return {
    success: true,
    error: null,
  };
}

/**
 * Disable 2FA (requires password verification)
 */
export async function disable2FAAction(password: string) {
  const user = await requireAuth();
  
  // Verify password
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: {
      passwordHash: true,
    },
  });
  
  if (!dbUser?.passwordHash) {
    return {
      success: false,
      error: 'Password authentication not available',
    };
  }
  
  const passwordValid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!passwordValid) {
    return {
      success: false,
      error: 'Invalid password',
    };
  }
  
  await disable2FA(user.id);
  
  await logAudit({
    userId: user.id,
    action: 'USER_2FA_DISABLED',
    details: JSON.stringify({ userId: user.id }),
  });
  
  revalidatePath('/app/settings/security');
  return {
    success: true,
    error: null,
  };
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodesAction() {
  const user = await requireAuth();
  
  const status = await getUser2FAStatus(user.id);
  if (!status.enabled) {
    return {
      success: false,
      error: '2FA is not enabled',
    };
  }
  
  const { plain: backupCodes, hashed } = generateBackupCodes();
  await updateBackupCodes(user.id, hashed);
  
  await logAudit({
    userId: user.id,
    action: 'USER_2FA_BACKUP_CODES_REGENERATED',
    details: JSON.stringify({ userId: user.id }),
  });
  
  return {
    success: true,
    backupCodes, // Show once
    error: null,
  };
}

/**
 * Verify 2FA token during login
 */
export async function verify2FALoginAction(
  userId: string,
  token: string,
  backupCode?: string
): Promise<{ success: boolean; error?: string }> {
  const secret = await getUser2FASecret(userId);
  if (!secret) {
    return {
      success: false,
      error: '2FA is not configured for this user',
    };
  }
  
  // Try TOTP first
  if (token && verifyTOTP(secret, token)) {
    return { success: true };
  }
  
  // Try backup code if provided
  if (backupCode) {
    const codes = await getUserBackupCodes(userId);
    const isValid = verifyBackupCode(backupCode, codes);
    
    if (isValid) {
      // Remove used backup code
      const { createHash } = await import('crypto');
      const hash = createHash('sha256').update(backupCode.toUpperCase()).digest('hex');
      await removeBackupCode(userId, hash);
      return { success: true };
    }
  }
  
  return {
    success: false,
    error: 'Invalid verification code',
  };
}

/**
 * Get 2FA status
 */
export async function get2FAStatusAction() {
  const user = await requireAuth();
  const status = await getUser2FAStatus(user.id);
  return status;
}

