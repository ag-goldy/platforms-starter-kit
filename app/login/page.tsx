import { signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createTwoFactorLoginToken, TWO_FACTOR_LOGIN_COOKIE } from '@/lib/auth/two-factor-login';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;
  
  // Store the explicit callback URL if provided (not /app default)
  const explicitCallbackUrl = params.callbackUrl && params.callbackUrl !== '/app' ? params.callbackUrl : null;

  async function loginAction(formData: FormData) {
    'use server';
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      // First verify password and check 2FA status
      const { db } = await import('@/db');
      const { users } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const bcrypt = await import('bcryptjs');
      const { getUser2FAStatus } = await import('@/lib/auth/2fa-queries');
      const { getDefaultRedirectUrl } = await import('@/lib/auth/redirect');
      
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user || !user.passwordHash) {
        redirect(`/login?error=Invalid credentials`);
      }

      // DEBUG: remove after fixing login
      console.log('[LOGIN-DEBUG] email:', email);
      console.log('[LOGIN-DEBUG] plain password:', password);
      console.log('[LOGIN-DEBUG] stored hash (first 30):', user.passwordHash?.substring(0, 30));
      const isValid = await bcrypt.default.compare(password, user.passwordHash);
      console.log('[LOGIN-DEBUG] bcrypt.compare result:', isValid);
      if (!isValid) {
        redirect(`/login?error=Invalid credentials`);
      }

      // Determine the correct redirect URL based on user type
      // Use explicit callback if provided, otherwise determine based on user type
      const callbackUrl = explicitCallbackUrl || await getDefaultRedirectUrl(user.id, user.isInternal);

      // Check if 2FA is enabled
      const twoFAStatus = await getUser2FAStatus(user.id);
      
      const cookieStore = await cookies();

      if (twoFAStatus.enabled) {
        const loginToken = await createTwoFactorLoginToken(user.id);
        cookieStore.set(TWO_FACTOR_LOGIN_COOKIE, loginToken, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 10 * 60,
          path: '/',
        });
        // Redirect to 2FA verification page
        redirect(`/login/verify-2fa?userId=${user.id}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
      }

      // No 2FA - proceed with normal login
      cookieStore.set(TWO_FACTOR_LOGIN_COOKIE, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 0,
        path: '/',
      });
      await signIn('credentials', {
        email,
        password,
        redirectTo: callbackUrl,
      });
    } catch (error) {
      const authError = error as { type?: string; code?: string };
      // NextAuth throws CredentialsSignin on failure
      if (authError?.type === 'CredentialsSignin' || authError?.code === 'credentials') {
        redirect(`/login?error=Invalid credentials`);
      }
      // Re-throw if it's not a credentials error
      throw error;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>AGR Support</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <form action={loginAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
            <div className="text-center">
              <a href="/forgot-password" className="text-sm text-gray-600 hover:underline">
                Forgot your password?
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
