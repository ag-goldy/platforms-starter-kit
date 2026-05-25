import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db"; // Assuming db is exported from @/db
import * as schema from "@/db/schema";
import { magicLink, twoFactor } from "better-auth/plugins";
import { sendEmail } from "@/lib/email";
import { renderMagicLinkEmail } from "@/lib/email/templates/magic-link";
import { renderPasswordResetEmail } from "@/lib/email/templates/password-reset";

const MAGIC_LINK_EXPIRES_IN_SECONDS = 5 * 60;
const PASSWORD_RESET_EXPIRES_IN_SECONDS = 60 * 60;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      verification: schema.magicLinks, // Mapping verification to magic_links
      // We don't have account table in the plan since we only use credentials/passkeys/magic links
    },
  }),
  emailAndPassword: {
    enabled: true,
    resetPasswordTokenExpiresIn: PASSWORD_RESET_EXPIRES_IN_SECONDS,
    sendResetPassword: async ({ user, url }) => {
      const rendered = renderPasswordResetEmail({
        email: user.email,
        url,
        expiresInMinutes: Math.round(PASSWORD_RESET_EXPIRES_IN_SECONDS / 60),
      });

      await sendEmail({
        to: user.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
    },
  },
  plugins: [
    magicLink({
      expiresIn: MAGIC_LINK_EXPIRES_IN_SECONDS,
      sendMagicLink: async ({ email, url }) => {
        const rendered = renderMagicLinkEmail({
          email,
          url,
          expiresInMinutes: Math.round(MAGIC_LINK_EXPIRES_IN_SECONDS / 60),
        });

        await sendEmail({
          to: email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });
      },
    }),
    twoFactor({
      issuer: "Atlas Helpdesk",
    }),
  ],
});
