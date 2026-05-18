import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/db';
import { memberships, users, platformAdmins } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { verifyTwoFactorLoginToken } from '@/lib/auth/two-factor-login';
import { authConfig } from '@/auth.config';

// Structured auth logging — never logs passwords, tokens, or full emails.
// Format: [Auth] <event> <masked-email> (e.g. a***@example.com)
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local[0]}***@${domain}`;
}

function authLog(event: string, email?: string) {
  // Intentionally omits password, token, or session data
  console.info(`[Auth] ${event}${email ? ` ${maskEmail(email)}` : ''}`);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  // Explicitly set trustHost to true for Vercel deployment
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        loginToken: { label: 'Login Token', type: 'text' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email) {
            // No email provided — not logged (nothing to mask)
            return null;
          }

          const email = credentials.email as string;

          const loginToken = credentials.loginToken as string | undefined;

          if (loginToken) {
            const loginPayload = await verifyTwoFactorLoginToken(loginToken);
            if (!loginPayload) {
              // Invalid token — do NOT log the raw token value
              return null;
            }

            // Check if it's a platform admin
            const platformAdmin = await db.query.platformAdmins.findFirst({
              where: eq(platformAdmins.id, loginPayload.userId),
            });

            if (platformAdmin) {
              if (!platformAdmin.twoFactorEnabled) {
                // Token presented but 2FA not enabled for this account
                return null;
              }

              if (platformAdmin.email.toLowerCase() !== email.toLowerCase()) {
                // Token email mismatch — don't log email to avoid leaking valid addresses
                return null;
              }

              authLog('2FA login success (platform admin)', platformAdmin.email);
              return {
                id: platformAdmin.id,
                email: platformAdmin.email,
                name: platformAdmin.name,
                isPlatformAdmin: true,
                role: platformAdmin.role,
              };
            }

            // Check tenant users
            const user = await db.query.users.findFirst({
              where: eq(users.id, loginPayload.userId),
            });

            if (!user) {
              return null;
            }

            if (!user.twoFactorEnabled) {
              return null;
            }

            if (user.email.toLowerCase() !== email.toLowerCase()) {
              return null;
            }

            if (!user.isInternal) {
              const activeMembership = await db.query.memberships.findFirst({
                where: and(
                  eq(memberships.userId, user.id),
                  eq(memberships.isActive, true)
                ),
                columns: { id: true },
              });

              if (!activeMembership) {
                return null;
              }
            }

            authLog('2FA login success', user.email);
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              isInternal: user.isInternal,
            };
          }

          if (!credentials?.password) {
            return null;
          }

          // Check Platform Admins first (separate from tenant users)
          const platformAdmin = await db.query.platformAdmins.findFirst({
            where: eq(platformAdmins.email, email),
          });

          if (platformAdmin) {
            if (!platformAdmin.isActive) {
              authLog('login denied: account disabled', email);
              return null;
            }

            const isValid = await bcrypt.compare(
              credentials.password as string,
              platformAdmin.passwordHash
            );

            if (!isValid) {
              authLog('login denied: bad credentials', email);
              return null;
            }

            // Check if 2FA is enabled
            if (platformAdmin.twoFactorEnabled) {
              return null; // 2FA will be handled separately
            }

            // Update last login
            await db.update(platformAdmins)
              .set({ lastLoginAt: new Date() })
              .where(eq(platformAdmins.id, platformAdmin.id));

            authLog('login success (platform admin)', email);
            return {
              id: platformAdmin.id,
              email: platformAdmin.email,
              name: platformAdmin.name,
              isPlatformAdmin: true,
              role: platformAdmin.role,
            };
          }

          // Check Tenant Users (regular users table)
          const user = await db.query.users.findFirst({
            where: eq(users.email, email),
          });

          if (!user) {
            // Return null without logging — avoids user enumeration via timing/logs
            return null;
          }

          if (!user.isInternal) {
            const activeMembership = await db.query.memberships.findFirst({
              where: and(
                eq(memberships.userId, user.id),
                eq(memberships.isActive, true)
              ),
              columns: { id: true },
            });

            if (!activeMembership) {
              return null;
            }
          }

          // Normal password verification
          if (!user.passwordHash) {
            authLog('login denied: no password configured', email);
            return null;
          }

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );

          if (!isValid) {
            authLog('login denied: bad credentials', email);
            return null;
          }

          // Check if 2FA is enabled - if so, don't complete login here
          if (user.twoFactorEnabled) {
            // Return null to prevent auto-login - 2FA verification page will handle it
            return null;
          }

          authLog('login success', email);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            isInternal: user.isInternal,
          };
        } catch (error) {
          // Only log the error type, not the full error which may contain credentials
          console.error('[Auth] Error in authorize:', error instanceof Error ? error.message : 'unknown error');
          return null;
        }
      },
    }),
  ],
});
