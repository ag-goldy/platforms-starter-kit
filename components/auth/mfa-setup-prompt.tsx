'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Shield, AlertTriangle, Loader2, Download, ArrowRight } from 'lucide-react';
import Image from 'next/image';

interface MFASetupPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function MFASetupPrompt({ isOpen, onClose, onComplete }: MFASetupPromptProps) {
  const [step, setStep] = useState<'prompt' | 'qr' | 'verify' | 'backup'>('prompt');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationToken, setVerificationToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartSetup = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/user/2fa-setup', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setQrCode(data.qrCode);
        setBackupCodes(data.backupCodes || []);
        setStep('qr');
      } else {
        setError(data.error || 'Failed to start MFA setup');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/user/2fa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep('backup');
      } else {
        setError(data.error || 'Invalid verification code');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    const content = `Atlas Helpdesk - Backup Codes\n\nSave these codes in a safe place. Each code can only be used once.\n\n${backupCodes.join('\n')}\n\nGenerated: ${new Date().toLocaleString()}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'atlas-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleComplete = () => {
    onComplete();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        {step === 'prompt' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-brand-500" />
                Secure Your Account
              </DialogTitle>
              <DialogDescription>
                Add an extra layer of security to your account with two-factor authentication.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">
                      Your account is not fully secured
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      Without two-factor authentication, your account is vulnerable to unauthorized access.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Why enable 2FA?</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Protects against password theft</li>
                  <li>• Required for accessing sensitive data</li>
                  <li>• Industry standard security practice</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={handleStartSetup} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Set Up Two-Factor Authentication
              </Button>
            </div>
          </>
        )}

        {step === 'qr' && (
          <>
            <DialogHeader>
              <DialogTitle>Scan QR Code</DialogTitle>
              <DialogDescription>
                Open your authenticator app and scan this QR code to add your account.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {qrCode && (
                <div className="flex justify-center">
                  <Image
                    src={qrCode}
                    alt="MFA QR Code"
                    width={200}
                    height={200}
                    unoptimized
                    className="border rounded-lg"
                  />
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-3">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={verificationToken}
                  onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit code from app"
                  className="text-center text-lg tracking-widest"
                />
                {error && (
                  <p className="text-sm text-red-600 text-center">{error}</p>
                )}
                <Button
                  type="submit"
                  disabled={isLoading || verificationToken.length !== 6}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Verify & Continue
                </Button>
              </form>
            </div>
          </>
        )}

        {step === 'backup' && (
          <>
            <DialogHeader>
              <DialogTitle>Save Your Backup Codes</DialogTitle>
              <DialogDescription>
                These codes can be used to access your account if you lose your authenticator device. Save them in a secure place.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 font-medium mb-2">
                  ⚠️ Important: Save these codes now!
                </p>
                <p className="text-sm text-amber-700">
                  You won&apos;t be able to see them again. Store them in a password manager.
                </p>
              </div>

              <div className="bg-gray-100 rounded-lg p-4 font-mono text-sm grid grid-cols-2 gap-2">
                {backupCodes.map((code, i) => (
                  <div key={i} className="text-gray-700">{code}</div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={downloadBackupCodes} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button onClick={handleComplete} className="flex-1">
                  I&apos;ve Saved Them
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
