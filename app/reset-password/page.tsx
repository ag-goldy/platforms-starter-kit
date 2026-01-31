import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { validatePasswordResetToken } from '@/lib/auth/password-reset';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;
  const error = params.error;
  const success = params.success === 'true';

  // Success state
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Password Reset Complete</CardTitle>
            <CardDescription>
              Your password has been successfully reset.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full">Continue to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Validate token
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Reset Link</CardTitle>
            <CardDescription>
              This password reset link is invalid or missing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
              Request a new reset link
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if token is valid
  const validation = await validatePasswordResetToken(token);
  if (!validation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Link Expired</CardTitle>
            <CardDescription>
              This password reset link has expired or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
              Request a new reset link
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function resetPasswordAction(formData: FormData) {
    'use server';
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    const resetToken = formData.get('token') as string;

    if (!password || password.length < 8) {
      redirect(`/reset-password?token=${resetToken}&error=Password must be at least 8 characters`);
    }

    if (password !== confirmPassword) {
      redirect(`/reset-password?token=${resetToken}&error=Passwords do not match`);
    }

    try {
      const { resetPasswordWithToken } = await import('@/lib/auth/password-reset');
      const result = await resetPasswordWithToken(resetToken, password);

      if (!result.success) {
        redirect(`/reset-password?token=${resetToken}&error=${result.error}`);
      }

      redirect('/reset-password?success=true');
    } catch (err) {
      console.error('Password reset error:', err);
      redirect(`/reset-password?token=${resetToken}&error=An error occurred. Please try again.`);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset Your Password</CardTitle>
          <CardDescription>
            Enter a new password for {validation.email}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <form action={resetPasswordAction} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter new password"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Reset Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
