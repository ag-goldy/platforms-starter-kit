import type { NextAuthConfig } from 'next-auth';
import { rootDomain } from '@/lib/utils';

const useSecureCookies = process.env.NODE_ENV === 'production';
const cookiePrefix = useSecureCookies ? '__Secure-' : '';
const hostName = rootDomain.split(':')[0];

export const authConfig = {
  pages: {
    signIn: '/login',
    verifyRequest: '/verify-email',
  },
  session: {
    strategy: 'jwt',
  },
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
  trustHost: true,
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        domain: hostName.includes('localhost') ? 'localhost' : `.${hostName}`,
      },
    },
  },
  providers: [], // Providers added in auth.ts
} satisfies NextAuthConfig;
