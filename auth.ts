import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/db';
import { memberships, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { verifyTwoFactorLoginToken } from '@/lib/auth/two-factor-login';
import { authConfig } from '@/auth.config';

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
            console.log('[Auth] Missing email');
            return null;
          }

          const email = credentials.email as string;

          const loginToken = credentials.loginToken as string | undefined;

          if (loginToken) {
            const loginPayload = await verifyTwoFactorLoginToken(loginToken);
            if (!loginPayload) {
              console.log('[Auth] Invalid 2FA login token');
              return null;
            }

            const user = await db.query.users.findFirst({
              where: eq(users.id, loginPayload.userId),
            });

            if (!user) {
              console.log('[Auth] User not found for 2FA token');
              return null;
            }

            if (!user.twoFactorEnabled) {
              console.log('[Auth] 2FA token used for non-2FA user');
              return null;
            }

            if (user.email.toLowerCase() !== email.toLowerCase()) {
              console.log('[Auth] 2FA token email mismatch');
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
                console.log('[Auth] No active memberships for user');
                return null;
              }
            }

            console.log('[Auth] Successful 2FA login for:', user.email);
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              isInternal: user.isInternal,
            };
          }

          if (!credentials?.password) {
            console.log('[Auth] Missing password');
            return null;
          }

          const user = await db.query.users.findFirst({
            where: eq(users.email, email),
          });

          if (!user) {
            console.log('[Auth] User not found:', email);
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
              console.log('[Auth] No active memberships for user');
              return null;
            }
          }

          // Normal password verification
          if (!user.passwordHash) {
            console.log('[Auth] User has no password hash');
            return null;
          }

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );

          if (!isValid) {
            console.log('[Auth] Password mismatch for:', credentials.email);
            return null;
          }

          // Check if 2FA is enabled - if so, don't complete login here
          if (user.twoFactorEnabled) {
            // Return null to prevent auto-login - 2FA verification page will handle it
            return null;
          }

          console.log('[Auth] Successful login for:', credentials.email);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            isInternal: user.isInternal,
          };
        } catch (error) {
          console.error('[Auth] Error in authorize:', error);
          return null;
        }
      },
    }),
  ],
});
