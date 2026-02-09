import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const success = params.success === 'true';
  const error = params.error;

  async function requestResetAction(formData: FormData) {
    'use server';
    const email = formData.get('email') as string;

    if (!email) {
      redirect('/forgot-password?error=Email is required');
    }

    try {
      const { generatePasswordResetToken } = await import('@/lib/auth/password-reset');
      const { sendWithOutbox } = await import('@/lib/email/outbox');
      
      const token = await generatePasswordResetToken(email);
      
      if (token) {
        // Queue password reset email
        const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
        
        await sendWithOutbox({
          type: 'password_reset',
          to: email,
          subject: 'Reset Your Password',
          html: `
            <h2>Password Reset Request</h2>
            <p>You requested to reset your password. Click the link below to set a new password:</p>
            <p><a href="${resetUrl}">Reset Password</a></p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
          `,
          text: `Reset your password by visiting: ${resetUrl}`,
        });
      }
    } catch (err) {
      console.error('Password reset error:', err);
      redirect('/forgot-password?error=An error occurred. Please try again.');
    }

    // Always show success to prevent email enumeration
    redirect('/forgot-password?success=true');
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>
              If an account exists with that email, we&apos;ve sent password reset instructions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="text-sm text-blue-600 hover:underline">
              ← Back to login
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Forgot Password</CardTitle>
          <CardDescription>
            Enter your email address and we&apos;ll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <form action={requestResetAction} className="space-y-4">
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
            <Button type="submit" className="w-full">
              Send Reset Link
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link href="/login" className="text-sm text-gray-600 hover:underline">
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
