import { signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { redirect } from 'next/navigation';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;
  
  // Default callback URL - internal users go to /app, customers will be redirected by the page
  const callbackUrl = params.callbackUrl || '/app';

  async function loginAction(formData: FormData) {
    'use server';
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      // Sign in - NextAuth will handle the redirect
      await signIn('credentials', {
        email,
        password,
        redirectTo: callbackUrl,
      });
    } catch (error) {
      const authError = error as { type?: string; code?: string };
      // NextAuth throws CredentialsSignin on failure
      if (authError?.type === 'CredentialsSignin' || authError?.code === 'credentials') {
        redirect(`/login?error=Invalid credentials&callbackUrl=${encodeURIComponent(callbackUrl)}`);
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
