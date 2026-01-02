import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// Note: Email provider removed for now to avoid Edge runtime issues with nodemailer
// Can be added back later when email-based auth is needed (with proper Edge runtime handling)

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.log('[Auth] Missing credentials');
            return null;
          }

          const user = await db.query.users.findFirst({
            where: eq(users.email, credentials.email as string),
          });

          if (!user) {
            console.log('[Auth] User not found:', credentials.email);
            return null;
          }

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
  session: {
    strategy: 'jwt',
  },
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.isInternal = (user as { isInternal?: boolean }).isInternal || false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isInternal = token.isInternal as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    verifyRequest: '/verify-email',
  },
});

