'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { completeLoginAfter2FA } from '@/app/login/actions';

export default function Verify2FAPage() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  
  const userId = searchParams.get('userId');
  const callbackUrl = searchParams.get('callbackUrl') || '/app';
  const errorParam = searchParams.get('error');

  useEffect(() => {
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [errorParam]);
  
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
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    
    try {
      // Complete login after 2FA verification
      await completeLoginAfter2FA(
        userId,
        useBackupCode ? '' : token,
        useBackupCode ? backupCode : undefined,
        callbackUrl
      );
      // If no redirect happened, there was an error
      setError('Failed to complete login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>Enter your verification code</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {!useBackupCode ? (
              <div className="space-y-2">
                <Label htmlFor="token">Verification Code</Label>
                <Input
                  id="token"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  autoFocus
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
                  type="text"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                  placeholder="XXXXXXXX"
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-500">
                  Enter one of your backup codes
                </p>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setToken('');
                  setBackupCode('');
                  setError(null);
                }}
                className="text-sm text-blue-600 hover:underline"
              >
                {useBackupCode ? 'Use authenticator code' : 'Use backup code'}
              </button>
            </div>
            
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Verifying...' : 'Verify'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
