import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { db } from '@/db'; // Assuming db is exported from @/db
import * as schema from '@/db/schema';
import { magicLink, twoFactor } from 'better-auth/plugins';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      verification: schema.magicLinks, // Mapping verification to magic_links
      // We don't have account table in the plan since we only use credentials/passkeys/magic links
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token, url }) => {
        // TODO: Send email
        console.log(`Magic link for ${email}: ${url}`);
      },
    }),
    twoFactor({
      issuer: 'Atlas Helpdesk',
    }),
  ],
});
