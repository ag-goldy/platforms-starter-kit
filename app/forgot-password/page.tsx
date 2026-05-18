'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const { error: resetError } = await authClient.forgetPassword({
      email,
      redirectTo: '/reset-password',
    });

    if (resetError) {
      setError(resetError.message || 'Failed to send reset email');
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Reset your password</h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {success ? (
            <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
              If an account exists with that email, a password reset link has been sent.
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending link...' : 'Send reset link'}
              </Button>
            </>
          )}

          <div className="flex items-center justify-center">
            <div className="text-sm">
              <Link href="/login" className="font-medium text-orange-600 hover:text-orange-500">
                Back to login
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
