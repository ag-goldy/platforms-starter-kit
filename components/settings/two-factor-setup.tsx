'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  start2FASetupAction,
  verify2FASetupAction,
  disable2FAAction,
  regenerateBackupCodesAction,
} from '@/app/app/actions/2fa';
import { AlertCircle, CheckCircle2, Download } from 'lucide-react';
import Image from 'next/image';

interface TwoFactorSetupProps {
  initialStatus: {
    enabled: boolean;
    hasSecret: boolean;
    hasBackupCodes: boolean;
  };
}

export function TwoFactorSetup({ initialStatus }: TwoFactorSetupProps) {
  const [status, setStatus] = useState(initialStatus);
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'verify' | 'backup'>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationToken, setVerificationToken] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleStartSetup = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await start2FASetupAction();
      if (result.success) {
        setQrCode(result.qrCode);
        setBackupCodes(result.backupCodes || []);
        setSetupStep('qr');
      } else {
        setError(result.error || 'Failed to start 2FA setup');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await verify2FASetupAction(verificationToken);
      if (result.success) {
        setStatus({ enabled: true, hasSecret: true, hasBackupCodes: true });
        setSetupStep('backup');
      } else {
        setError(result.error || 'Invalid verification code');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm('Are you sure you want to disable 2FA? This will make your account less secure.')) {
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await disable2FAAction(password);
      if (result.success) {
        setStatus({ enabled: false, hasSecret: false, hasBackupCodes: false });
        setSetupStep('idle');
        setPassword('');
      } else {
        setError(result.error || 'Failed to disable 2FA');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleRegenerateBackupCodes = async () => {
    if (!confirm('This will invalidate your existing backup codes. Are you sure?')) {
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await regenerateBackupCodesAction();
      if (result.success && result.backupCodes) {
        setBackupCodes(result.backupCodes);
      } else {
        setError(result.error || 'Failed to regenerate backup codes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const downloadBackupCodes = () => {
    const content = `AGR Support - Backup Codes\n\nSave these codes in a safe place. Each code can only be used once.\n\n${backupCodes.join('\n')}\n\nGenerated: ${new Date().toLocaleString()}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agr-support-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };
  
  if (status.enabled && setupStep === 'idle') {
    // 2FA is enabled - show disable option
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Two-Factor Authentication Enabled
          </CardTitle>
          <CardDescription>
            Your account is protected with two-factor authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-green-50 border border-green-200 p-4">
            <p className="text-sm text-green-800">
              ✓ Two-factor authentication is active on your account
            </p>
          </div>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Backup Codes</h3>
              <p className="text-sm text-gray-600 mb-3">
                Backup codes can be used to access your account if you lose access to your authenticator app.
              </p>
              <Button
                variant="outline"
                onClick={handleRegenerateBackupCodes}
                disabled={isProcessing}
              >
                Regenerate Backup Codes
              </Button>
            </div>
            
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-2 text-red-600">Disable 2FA</h3>
              <p className="text-sm text-gray-600 mb-3">
                Disabling 2FA will make your account less secure. You&apos;ll need to enter your password to confirm.
              </p>
              <form onSubmit={handleDisable} className="space-y-3">
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" variant="destructive" disabled={isProcessing}>
                  {isProcessing ? 'Disabling...' : 'Disable 2FA'}
                </Button>
              </form>
            </div>
          </div>
          
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
  
  if (setupStep === 'backup') {
    // Show backup codes (one-time view)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Save Your Backup Codes</CardTitle>
          <CardDescription>
            These codes can be used to access your account if you lose your authenticator device.
            Each code can only be used once.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
            <p className="text-sm text-yellow-800 font-medium mb-2">
              ⚠️ Save these codes now - you won&apos;t be able to see them again!
            </p>
            <p className="text-sm text-yellow-700">
              Store them in a secure location like a password manager.
            </p>
          </div>
          
          <div className="bg-gray-50 rounded-md p-4 font-mono text-sm space-y-1">
            {backupCodes.map((code, i) => (
              <div key={i} className="flex items-center justify-between">
                <span>{code}</span>
              </div>
            ))}
          </div>
          
          <div className="flex gap-2">
            <Button onClick={downloadBackupCodes} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Codes
            </Button>
            <Button
              onClick={() => {
                setSetupStep('idle');
                window.location.reload();
              }}
            >
              I&apos;ve Saved These Codes
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (setupStep === 'qr') {
    // Show QR code and verification
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set Up Two-Factor Authentication</CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app, then enter the verification code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {qrCode && (
            <div className="flex justify-center">
              <Image
                src={qrCode}
                alt="QR Code"
                width={200}
                height={200}
                unoptimized
                className="border rounded"
              />
            </div>
          )}
          
          <form onSubmit={handleVerifySetup} className="space-y-4">
            <div>
              <Label htmlFor="verificationToken">Verification Code</Label>
              <Input
                id="verificationToken"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={verificationToken}
                onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                required
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
            
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                {error}
              </div>
            )}
            
            <div className="flex gap-2">
              <Button type="submit" disabled={isProcessing}>
                {isProcessing ? 'Verifying...' : 'Verify & Enable'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSetupStep('idle');
                  setQrCode(null);
                  setVerificationToken('');
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }
  
  // Initial state - show enable button
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status.enabled ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Two-Factor Authentication Enabled
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-gray-400" />
              Two-Factor Authentication
            </>
          )}
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status.enabled ? (
          <div className="rounded-md bg-green-50 border border-green-200 p-4">
            <p className="text-sm text-green-800">
              ✓ Two-factor authentication is active on your account
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Two-factor authentication adds an extra layer of security by requiring a code from your authenticator app in addition to your password.
            </p>
            <Button onClick={handleStartSetup} disabled={isProcessing}>
              {isProcessing ? 'Starting Setup...' : 'Enable Two-Factor Authentication'}
            </Button>
          </div>
        )}
        
        {error && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
