/**
 * Two-Factor Authentication (2FA) using TOTP
 * 
 * Implements TOTP-based 2FA with backup codes
 */

import { authenticator } from 'otplib';
import { createHash, randomBytes } from 'crypto';
import QRCode from 'qrcode';

// Configure TOTP
authenticator.options = {
  step: 30, // 30-second time steps
  window: 1, // Allow 1 time step tolerance
};

/**
 * Generate a new TOTP secret for a user
 */
export function generateSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Generate QR code data URL for TOTP setup
 */
export async function generateQRCode(secret: string, email: string, issuer: string = 'AGR Support'): Promise<string> {
  const otpauth = authenticator.keyuri(email, issuer, secret);
  return QRCode.toDataURL(otpauth);
}

/**
 * Verify a TOTP token
 */
export function verifyTOTP(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/**
 * Generate backup codes (10 codes)
 * Returns array of plain codes and hashed codes for storage
 */
export function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const codes: string[] = [];
  const hashed: string[] = [];
  
  for (let i = 0; i < 10; i++) {
    // Generate 8-character alphanumeric code
    const code = randomBytes(4).toString('hex').toUpperCase().substring(0, 8);
    codes.push(code);
    
    // Hash the code for storage (SHA-256)
    const hash = createHash('sha256').update(code).digest('hex');
    hashed.push(hash);
  }
  
  return { plain: codes, hashed };
}

/**
 * Verify a backup code against hashed codes
 */
export function verifyBackupCode(code: string, hashedCodes: string[]): boolean {
  const hash = createHash('sha256').update(code.toUpperCase()).digest('hex');
  return hashedCodes.includes(hash);
}

/**
 * Encrypt secret for storage (simple base64 encoding for now)
 * In production, use proper encryption with a key management service
 */
export function encryptSecret(secret: string): string {
  // For now, just base64 encode (not secure, but better than plain text)
  // TODO: Use proper encryption with environment variable key
  const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
  const combined = `${encryptionKey}:${secret}`;
  return Buffer.from(combined).toString('base64');
}

/**
 * Decrypt secret from storage
 */
export function decryptSecret(encrypted: string): string {
  try {
    const combined = Buffer.from(encrypted, 'base64').toString('utf-8');
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
    const parts = combined.split(':');
    if (parts.length < 2 || parts[0] !== encryptionKey) {
      throw new Error('Invalid encrypted secret');
    }
    return parts.slice(1).join(':');
  } catch {
    throw new Error('Failed to decrypt secret');
  }
}

/**
 * Check if 2FA is required for a user based on org policy
 */
export async function is2FARequired(userId: string): Promise<boolean> {
  const { db } = await import('@/db');
  const { memberships } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  
  // Get user's memberships
  const userMemberships = await db.query.memberships.findMany({
    where: eq(memberships.userId, userId),
    with: {
      organization: {
        columns: {
          requireTwoFactor: true,
        },
      },
    },
  });
  
  // Check if any org requires 2FA
  return userMemberships.some((m) => m.organization.requireTwoFactor === true);
}
