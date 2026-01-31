import { NextRequest, NextResponse } from 'next/server';
import { signIn } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { TWO_FACTOR_LOGIN_COOKIE, verifyTwoFactorLoginToken } from '@/lib/auth/two-factor-login';

/**
 * Complete login after 2FA verification
 * This route is called after password and 2FA are both verified
 * 
 * Note: This is a simplified approach. In production, use a more secure method
 * such as temporary session tokens stored in Redis.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');
  const callbackUrl = searchParams.get('callbackUrl') || '/app';
  
  if (!userId) {
    redirect('/login?error=Invalid request');
  }

  const loginToken = request.cookies.get(TWO_FACTOR_LOGIN_COOKIE)?.value;
  if (!loginToken) {
    redirect('/login?error=Login session expired');
  }

  const loginPayload = await verifyTwoFactorLoginToken(loginToken);
  if (!loginPayload || loginPayload.userId !== userId) {
    redirect('/login?error=Login session expired');
  }
  
  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  
  if (!user) {
    redirect('/login?error=User not found');
  }
  
  // Complete login using the 2FA login token
  await signIn('credentials', {
    email: user.email,
    loginToken,
    redirectTo: callbackUrl,
  });

  const response = NextResponse.redirect(new URL(callbackUrl, request.url));
  response.cookies.set(TWO_FACTOR_LOGIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });

  return response;
}
