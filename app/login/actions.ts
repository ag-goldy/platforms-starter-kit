'use server';

import { signIn } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verify2FALoginAction } from '@/app/app/actions/2fa';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { TWO_FACTOR_LOGIN_COOKIE, verifyTwoFactorLoginToken } from '@/lib/auth/two-factor-login';

/**
 * Complete login after 2FA verification
 * This is called after password and 2FA are both verified
 */
export async function completeLoginAfter2FA(
  userId: string,
  token: string,
  backupCode?: string,
  callbackUrl?: string
) {
  // Verify 2FA
  const result = await verify2FALoginAction(userId, token, backupCode);
  
  if (!result.success) {
    redirect(`/login/verify-2fa?userId=${userId}&error=${encodeURIComponent(result.error || 'Invalid code')}&callbackUrl=${encodeURIComponent(callbackUrl || '/app')}`);
  }

  const cookieStore = await cookies();
  const loginToken = cookieStore.get(TWO_FACTOR_LOGIN_COOKIE)?.value;
  if (!loginToken) {
    redirect('/login?error=Login session expired');
  }

  const loginPayload = await verifyTwoFactorLoginToken(loginToken);
  if (!loginPayload || loginPayload.userId !== userId) {
    redirect('/login?error=Login session expired');
  }
  
  // Get user to complete login
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  
  if (!user) {
    redirect('/login?error=User not found');
  }
  
  cookieStore.set(TWO_FACTOR_LOGIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });

  // Complete login by signing in with the 2FA login token
  await signIn('credentials', {
    email: user.email,
    loginToken,
    redirectTo: callbackUrl || '/app',
  });
}
