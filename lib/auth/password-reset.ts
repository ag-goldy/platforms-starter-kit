import { db } from "@/db";
import { users, platformAdmins, passwordResetTokens } from "@/db/schema";
import { eq, and, gt, isNull, lt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendWithOutbox } from "@/lib/email/outbox";
import { renderPasswordResetConfirmationEmail } from "@/lib/email/templates/password-reset-confirmation";

const TOKEN_EXPIRY_HOURS = 24;

/**
 * Generate a password reset token for a user
 */
export async function generatePasswordResetToken(
  email: string,
): Promise<string | null> {
  const normalizedEmail = email.toLowerCase();

  const user = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  const platformAdmin = user
    ? null
    : await db.query.platformAdmins.findFirst({
        where: eq(platformAdmins.email, normalizedEmail),
      });

  if (!user && !platformAdmin) {
    return null;
  }

  // Generate secure random token
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = await bcrypt.hash(token, 10);

  // Set expiry
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

  await db.insert(passwordResetTokens).values({
    userId: user?.id ?? null,
    platformAdminId: platformAdmin?.id ?? null,
    tokenHash,
    expiresAt,
  });

  return token;
}

/**
 * Validate a password reset token
 */
export async function validatePasswordResetToken(token: string): Promise<{
  tokenId: string;
  userId: string | null;
  platformAdminId: string | null;
  email: string;
} | null> {
  // Get all unexpired, unused tokens
  const tokens = await db
    .select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      platformAdminId: passwordResetTokens.platformAdminId,
      tokenHash: passwordResetTokens.tokenHash,
      expiresAt: passwordResetTokens.expiresAt,
    })
    .from(passwordResetTokens)
    .where(
      and(
        gt(passwordResetTokens.expiresAt, new Date()),
        isNull(passwordResetTokens.usedAt),
      ),
    );

  // Check each token hash
  for (const t of tokens) {
    const isValid = await bcrypt.compare(token, t.tokenHash);
    if (isValid) {
      if (t.userId) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, t.userId),
        });
        if (user) {
          return {
            tokenId: t.id,
            userId: user.id,
            platformAdminId: null,
            email: user.email,
          };
        }
      }

      if (t.platformAdminId) {
        const admin = await db.query.platformAdmins.findFirst({
          where: eq(platformAdmins.id, t.platformAdminId),
        });
        if (admin) {
          return {
            tokenId: t.id,
            userId: null,
            platformAdminId: admin.id,
            email: admin.email,
          };
        }
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
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const validation = await validatePasswordResetToken(token);

  if (!validation) {
    return { success: false, error: "Invalid or expired reset token" };
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 12);

  if (validation.userId) {
    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, validation.userId));
  } else if (validation.platformAdminId) {
    await db
      .update(platformAdmins)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(platformAdmins.id, validation.platformAdminId));
  } else {
    return { success: false, error: "Invalid reset token" };
  }

  const resetAt = new Date();

  // Mark token as used
  await db
    .update(passwordResetTokens)
    .set({ usedAt: resetAt })
    .where(eq(passwordResetTokens.id, validation.tokenId));

  try {
    const rendered = renderPasswordResetConfirmationEmail({
      email: validation.email,
      resetAt,
    });

    await sendWithOutbox({
      type: "password_reset_confirmation",
      to: validation.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  } catch (error) {
    console.error("[Password Reset] Failed to send reset confirmation:", error);
  }

  return { success: true };
}

/**
 * Admin-initiated password reset (sets a new password directly)
 */
export async function adminResetUserPassword(
  userId: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return { success: false, error: "User not found" };
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
    .returning();

  return result.length;
}
