'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { signIn } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyTwoFactorLoginToken, TWO_FACTOR_LOGIN_COOKIE } from '@/lib/auth/two-factor-login';

export async function completeLoginAfter2FA(
  userId: string,
  token: string,
  backupCode: string | undefined,
  callbackUrl?: string
) {
  const { verify2FALoginAction } = await import('@/app/app/actions/2fa');
  
  // Verify 2FA
  const result = await verify2FALoginAction(userId, token, backupCode);
  
  if (!result.success) {
    const errorParam = encodeURIComponent(result.error || 'Invalid code');
    const callbackParam = callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : '';
    redirect(`/login/verify-2fa?userId=${userId}&error=${errorParam}${callbackParam}`);
  }

  const cookieStore = await cookies();
  const loginToken = cookieStore.get(TWO_FACTOR_LOGIN_COOKIE)?.value;
  
  if (!loginToken) {
    redirect('/login?error=Login session expired. Please try again.');
  }

  const loginPayload = await verifyTwoFactorLoginToken(loginToken);
  
  if (!loginPayload || loginPayload.userId !== userId) {
    redirect('/login?error=Login session expired. Please try again.');
  }
  
  // Get user to complete login
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  
  if (!user) {
    redirect('/login?error=User not found');
  }
  
  // Clear the 2FA login cookie
  cookieStore.set(TWO_FACTOR_LOGIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });

  // Complete login using the 2FA token
  await signIn('credentials', {
    email: user.email,
    loginToken,
    redirectTo: callbackUrl || '/app',
  });
}
