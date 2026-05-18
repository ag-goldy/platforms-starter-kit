import { createAuthClient } from 'better-auth/react';
import { magicLinkClient, twoFactorClient } from 'better-auth/client/plugins';

const authBaseURL =
  (typeof window !== 'undefined' ? window.location.origin : undefined) ||
  process.env.NEXT_PUBLIC_APP_URL;

export const authClient = createAuthClient({
  ...(authBaseURL ? { baseURL: authBaseURL } : {}),
  plugins: [
    magicLinkClient(),
    twoFactorClient(),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
