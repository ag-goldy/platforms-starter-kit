'use client';

import { useActionState, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { completeLoginAfter2FA } from '../actions';

interface TwoFAState {
  success: boolean;
  error?: string;
}

const initialState: TwoFAState = { success: false };

export default function Verify2FAPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [useBackupCode, setUseBackupCode] = useState(false);
  
  const userId = searchParams.get('userId');
  const callbackUrl = searchParams.get('callbackUrl') || '/app';
  const urlError = searchParams.get('error');

  // Redirect if no userId
  useEffect(() => {
    if (!userId) {
      router.push('/login?error=Invalid verification request');
    }
  }, [userId, router]);

  async function handle2FASubmit(prevState: TwoFAState, formData: FormData): Promise<TwoFAState> {
    if (!userId) {
      return { success: false, error: 'Invalid verification request' };
    }

    const token = (formData.get('token') as string)?.trim() || '';
    const backupCode = (formData.get('backupCode') as string)?.trim().toUpperCase() || '';

    // Validation
    if (!useBackupCode && token.length !== 6) {
      return { success: false, error: 'Please enter a 6-digit verification code' };
    }

    if (useBackupCode && backupCode.length < 8) {
      return { success: false, error: 'Please enter a valid backup code' };
    }

    try {
      await completeLoginAfter2FA(
        userId,
        token,
        useBackupCode ? backupCode : undefined,
        callbackUrl
      );
      
      // If we get here without redirect, something went wrong
      return { success: false, error: 'Failed to complete login' };
    } catch (error) {
      // Check if it's a redirect
      if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
        throw error;
      }
      
      console.error('[2FA] Error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'An error occurred. Please try again.' 
      };
    }
  }

  const [state, formAction, isPending] = useActionState(handle2FASubmit, initialState);
  const errorMessage = state?.error || urlError;

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-red-600">Invalid verification request</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            {useBackupCode 
              ? 'Enter one of your backup codes' 
              : 'Enter the 6-digit code from your authenticator app'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {decodeURIComponent(errorMessage)}
            </div>
          )}
          
          <form action={formAction} className="space-y-4">
            {!useBackupCode ? (
              <div className="space-y-2">
                <Label htmlFor="token">Verification Code</Label>
                <Input
                  id="token"
                  name="token"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  disabled={isPending}
                  className="text-center text-2xl tracking-widest"
                />
                <p className="text-xs text-gray-500">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="backupCode">Backup Code</Label>
                <Input
                  id="backupCode"
                  name="backupCode"
                  type="text"
                  placeholder="XXXXXXXX"
                  required
                  autoFocus
                  autoComplete="off"
                  disabled={isPending}
                  className="text-center text-lg tracking-widest uppercase"
                />
                <p className="text-xs text-gray-500">
                  Enter one of your backup codes (8 characters)
                </p>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setUseBackupCode(!useBackupCode)}
                className="text-sm text-blue-600 hover:underline"
                disabled={isPending}
              >
                {useBackupCode ? 'Use authenticator code' : 'Use backup code'}
              </button>
              <a href="/login" className="text-sm text-gray-600 hover:underline">
                Cancel
              </a>
            </div>
            
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Verifying...' : 'Verify'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
