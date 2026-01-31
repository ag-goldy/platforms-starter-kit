import { db } from '@/db';
import { users, passwordResetTokens } from '@/db/schema';
import { eq, and, gt, isNull, lt } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const TOKEN_EXPIRY_HOURS = 24;

/**
 * Generate a password reset token for a user
 */
export async function generatePasswordResetToken(email: string): Promise<string | null> {
    // Find user by email
    const user = await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase()),
    });

    if (!user) {
        // Don't reveal that user doesn't exist
        return null;
    }

    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);

    // Set expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

    // Insert token (delete any existing tokens for this user first)
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));

    await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
    });

    return token;
}

/**
 * Validate a password reset token
 */
export async function validatePasswordResetToken(
    token: string
): Promise<{ userId: string; email: string } | null> {
    // Get all unexpired, unused tokens
    const tokens = await db
        .select({
            id: passwordResetTokens.id,
            userId: passwordResetTokens.userId,
            tokenHash: passwordResetTokens.tokenHash,
            expiresAt: passwordResetTokens.expiresAt,
        })
        .from(passwordResetTokens)
        .where(
            and(
                gt(passwordResetTokens.expiresAt, new Date()),
                isNull(passwordResetTokens.usedAt)
            )
        );

    // Check each token hash
    for (const t of tokens) {
        const isValid = await bcrypt.compare(token, t.tokenHash);
        if (isValid) {
            const user = await db.query.users.findFirst({
                where: eq(users.id, t.userId),
            });
            if (user) {
                return { userId: user.id, email: user.email };
            }
        }
    }

    return null;
}

/**
 * Reset password using a valid token
 */
export async function resetPasswordWithToken(
    token: string,
    newPassword: string
): Promise<{ success: boolean; error?: string }> {
    const validation = await validatePasswordResetToken(token);

    if (!validation) {
        return { success: false, error: 'Invalid or expired reset token' };
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update user password
    await db
        .update(users)
        .set({
            passwordHash,
            updatedAt: new Date(),
        })
        .where(eq(users.id, validation.userId));

    // Mark token as used
    await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.userId, validation.userId));

    return { success: true };
}

/**
 * Admin-initiated password reset (sets a new password directly)
 */
export async function adminResetUserPassword(
    userId: string,
    newPassword: string
): Promise<{ success: boolean; error?: string }> {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    if (!user) {
        return { success: false, error: 'User not found' };
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db
        .update(users)
        .set({
            passwordHash,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

    return { success: true };
}

/**
 * Cleanup expired tokens
 */
export async function cleanupExpiredTokens(): Promise<number> {
    const result = await db
        .delete(passwordResetTokens)
        .where(lt(passwordResetTokens.expiresAt, new Date()))
        .returning({ id: passwordResetTokens.id });

    return result.length;
}
