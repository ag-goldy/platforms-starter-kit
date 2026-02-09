import type { NextAuthConfig } from 'next-auth';

// Use consistent cookie name - no __Secure- prefix for localhost dev
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
const cookiePrefix = isProduction ? '__Secure-' : '';

// Session max age: 30 days for better UX
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

// Note: Cookie domain is intentionally NOT set for Vercel compatibility
// Setting domain can cause CSRF issues on Vercel deployments
const cookieDomain = undefined;

// Ensure secret is set
const getSecret = () => {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret && isProduction) {
    console.error('[Auth] ERROR: AUTH_SECRET or NEXTAUTH_SECRET must be set in production!');
  }
  return secret;
};

export const authConfig = {
  pages: {
    signIn: '/login',
    verifyRequest: '/verify-email',
    error: '/login',
  },
  // Explicitly set secret - must be consistent across all environments
  secret: getSecret(),
  // Set the base URL for CSRF checks
  basePath: '/api/auth',
  // CSRF check is handled by trustHost
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE,
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Persist user data to token
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.isInternal = (user as { isInternal?: boolean }).isInternal || false;
      }
      
      // Handle session updates
      if (trigger === 'update' && session) {
        token.name = session.name;
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.isInternal = token.isInternal as boolean;
      }
      return session;
    },
  },
  // Trust the production host - required for Vercel
  trustHost: true,
  // Use standard cookie config with explicit maxAge
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        maxAge: SESSION_MAX_AGE,
      },
    },
    csrfToken: {
      name: `${cookiePrefix}authjs.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        maxAge: SESSION_MAX_AGE,
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}authjs.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        maxAge: SESSION_MAX_AGE,
      },
    },
  },
  providers: [], // Providers added in auth.ts
} satisfies NextAuthConfig;
