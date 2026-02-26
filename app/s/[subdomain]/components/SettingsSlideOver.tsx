'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Bell,
  Shield,
  User,
  Mail,
  Moon,
  Sun,
  Smartphone,
  Globe,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Download,
  X,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Image from 'next/image';

interface SettingsSlideOverProps {
  onClose: () => void;
}

interface UserSettings {
  name: string;
  email: string;
  notifications: {
    email: boolean;
    push: boolean;
    ticketUpdates: boolean;
    teamActivity: boolean;
  };
  theme: 'light' | 'dark' | 'system';
  language: string;
}

interface TwoFAStatus {
  enabled: boolean;
  hasSecret: boolean;
  hasBackupCodes: boolean;
}

export function SettingsSlideOver({ onClose }: SettingsSlideOverProps) {
  const [settings, setSettings] = useState<UserSettings>({
    name: '',
    email: '',
    notifications: {
      email: true,
      push: false,
      ticketUpdates: true,
      teamActivity: false,
    },
    theme: 'light',
    language: 'en',
  });
  const [twoFAStatus, setTwoFAStatus] = useState<TwoFAStatus>({
    enabled: false,
    hasSecret: false,
    hasBackupCodes: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'preferences' | 'security'>('profile');
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // 2FA setup states
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'verify' | 'backup'>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationToken, setVerificationToken] = useState('');
  const [password, setPassword] = useState('');
  const [twoFAError, setTwoFAError] = useState<string | null>(null);
  const [isProcessing2FA, setIsProcessing2FA] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetch2FAStatus();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/user/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetch2FAStatus = async () => {
    try {
      const res = await fetch('/api/user/2fa-status');
      if (res.ok) {
        const data = await res.json();
        setTwoFAStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch 2FA status:', error);
    }
  };

  const handleStart2FASetup = async () => {
    setIsProcessing2FA(true);
    setTwoFAError(null);
    try {
      const res = await fetch('/api/user/2fa-setup', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setQrCode(data.qrCode);
        setBackupCodes(data.backupCodes || []);
        setSetupStep('qr');
      } else {
        setTwoFAError(data.error || 'Failed to start 2FA setup');
      }
    } catch (err) {
      setTwoFAError('An error occurred');
    } finally {
      setIsProcessing2FA(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing2FA(true);
    setTwoFAError(null);
    try {
      const res = await fetch('/api/user/2fa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setTwoFAStatus({ enabled: true, hasSecret: true, hasBackupCodes: true });
        setSetupStep('backup');
      } else {
        setTwoFAError(data.error || 'Invalid verification code');
      }
    } catch (err) {
      setTwoFAError('An error occurred');
    } finally {
      setIsProcessing2FA(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm('Are you sure you want to disable 2FA? This will make your account less secure.')) {
      return;
    }
    setIsProcessing2FA(true);
    setTwoFAError(null);
    try {
      const res = await fetch('/api/user/2fa-disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        setTwoFAStatus({ enabled: false, hasSecret: false, hasBackupCodes: false });
        setSetupStep('idle');
        setPassword('');
      } else {
        setTwoFAError(data.error || 'Failed to disable 2FA');
      }
    } catch (err) {
      setTwoFAError('An error occurred');
    } finally {
      setIsProcessing2FA(false);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'preferences', label: 'Preferences', icon: Settings },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Settings</h2>
          <p className="text-sm text-stone-500">Manage your account preferences</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-stone-500" />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 py-3 border-b border-stone-100">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-brand-500 text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-700">Display Name</label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-700">Email Address</label>
                <input
                  type="email"
                  value={settings.email}
                  disabled
                  className="w-full px-4 py-2 rounded-lg border border-stone-200 bg-stone-50 text-stone-500 cursor-not-allowed"
                />
                <p className="text-xs text-stone-500">Contact your admin to change your email</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <h3 className="text-sm font-semibold text-stone-900 mb-4">Email Notifications</h3>

              <label className="flex items-center justify-between p-4 rounded-lg border border-stone-200 hover:border-brand-300 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-stone-400" />
                  <div>
                    <p className="font-medium text-stone-900">Email Notifications</p>
                    <p className="text-sm text-stone-500">Receive updates via email</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.email}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      notifications: { ...prev.notifications, email: e.target.checked },
                    }))
                  }
                  className="w-5 h-5 rounded border-stone-300 text-brand-500 focus:ring-brand-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-lg border border-stone-200 hover:border-brand-300 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-stone-400" />
                  <div>
                    <p className="font-medium text-stone-900">Push Notifications</p>
                    <p className="text-sm text-stone-500">Receive push notifications</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.push}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      notifications: { ...prev.notifications, push: e.target.checked },
                    }))
                  }
                  className="w-5 h-5 rounded border-stone-300 text-brand-500 focus:ring-brand-500"
                />
              </label>

              <h3 className="text-sm font-semibold text-stone-900 mb-4 mt-6">Notification Types</h3>

              <label className="flex items-center justify-between p-4 rounded-lg border border-stone-200 hover:border-brand-300 transition-colors cursor-pointer">
                <div>
                  <p className="font-medium text-stone-900">Ticket Updates</p>
                  <p className="text-sm text-stone-500">When your tickets are updated</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.ticketUpdates}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      notifications: { ...prev.notifications, ticketUpdates: e.target.checked },
                    }))
                  }
                  className="w-5 h-5 rounded border-stone-300 text-brand-500 focus:ring-brand-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-lg border border-stone-200 hover:border-brand-300 transition-colors cursor-pointer">
                <div>
                  <p className="font-medium text-stone-900">Team Activity</p>
                  <p className="text-sm text-stone-500">New members and team changes</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.teamActivity}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      notifications: { ...prev.notifications, teamActivity: e.target.checked },
                    }))
                  }
                  className="w-5 h-5 rounded border-stone-300 text-brand-500 focus:ring-brand-500"
                />
              </label>
            </motion.div>
          )}

          {activeTab === 'preferences' && (
            <motion.div
              key="preferences"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="space-y-3">
                <label className="text-sm font-medium text-stone-700">Theme</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['light', 'dark', 'system'] as const).map((theme) => (
                    <button
                      key={theme}
                      onClick={() => setSettings((prev) => ({ ...prev, theme }))}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                        settings.theme === theme
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      {theme === 'light' && <Sun className="w-6 h-6 text-amber-500" />}
                      {theme === 'dark' && <Moon className="w-6 h-6 text-indigo-500" />}
                      {theme === 'system' && <Settings className="w-6 h-6 text-stone-500" />}
                      <span className="text-sm font-medium text-stone-900 capitalize">{theme}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-700">Language</label>
                <select
                  value={settings.language}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, language: e.target.value }))
                  }
                  className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div
              key="security"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* 2FA Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-stone-900">Two-Factor Authentication</h3>
                
                {setupStep === 'idle' && (
                  <div className="p-4 rounded-lg border border-stone-200">
                    {twoFAStatus.enabled ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <div>
                            <p className="font-medium text-stone-900">2FA Enabled</p>
                            <p className="text-sm text-stone-500">Your account is protected</p>
                          </div>
                        </div>
                        
                        <form onSubmit={handleDisable2FA} className="space-y-3 pt-4 border-t">
                          <p className="text-sm text-stone-600">
                            To disable 2FA, enter your password:
                          </p>
                          <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Your password"
                            className="max-w-sm"
                          />
                          {twoFAError && (
                            <p className="text-sm text-red-600">{twoFAError}</p>
                          )}
                          <Button
                            type="submit"
                            variant="outline"
                            disabled={isProcessing2FA || !password}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            {isProcessing2FA ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : null}
                            Disable 2FA
                          </Button>
                        </form>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-500" />
                          <div>
                            <p className="font-medium text-stone-900">2FA Not Enabled</p>
                            <p className="text-sm text-stone-500">
                              Add an extra layer of security to your account
                            </p>
                          </div>
                        </div>
                        
                        <Button
                          onClick={handleStart2FASetup}
                          disabled={isProcessing2FA}
                        >
                          {isProcessing2FA ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : null}
                          Enable Two-Factor Authentication
                        </Button>
                        
                        {twoFAError && (
                          <p className="text-sm text-red-600">{twoFAError}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {setupStep === 'qr' && (
                  <div className="space-y-4">
                    <button
                      onClick={() => setSetupStep('idle')}
                      className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    
                    <div className="p-6 rounded-lg border border-stone-200 text-center space-y-4">
                      <h4 className="font-medium text-stone-900">Scan QR Code</h4>
                      <p className="text-sm text-stone-600">
                        Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                      </p>
                      
                      {qrCode && (
                        <div className="flex justify-center py-4">
                          <Image
                            src={qrCode}
                            alt="2FA QR Code"
                            width={200}
                            height={200}
                            unoptimized
                            className="border rounded-lg"
                          />
                        </div>
                      )}
                      
                      <form onSubmit={handleVerify2FA} className="space-y-3 max-w-sm mx-auto">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          value={verificationToken}
                          onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, ''))}
                          placeholder="Enter 6-digit code"
                          className="text-center text-lg tracking-widest"
                        />
                        {twoFAError && (
                          <p className="text-sm text-red-600">{twoFAError}</p>
                        )}
                        <Button
                          type="submit"
                          disabled={isProcessing2FA || verificationToken.length !== 6}
                          className="w-full"
                        >
                          {isProcessing2FA ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : null}
                          Verify & Enable
                        </Button>
                      </form>
                    </div>
                  </div>
                )}

                {setupStep === 'backup' && (
                  <div className="space-y-4">
                    <div className="p-6 rounded-lg border border-amber-200 bg-amber-50">
                      <h4 className="font-medium text-amber-900 mb-2">Save Your Backup Codes</h4>
                      <p className="text-sm text-amber-800 mb-4">
                        These codes can be used to access your account if you lose your authenticator device.
                        Each code can only be used once.
                      </p>
                      
                      <div className="bg-white rounded-lg p-4 font-mono text-sm grid grid-cols-2 gap-2 mb-4">
                        {backupCodes.map((code, i) => (
                          <div key={i} className="text-stone-700">{code}</div>
                        ))}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button onClick={downloadBackupCodes} variant="outline">
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          onClick={() => {
                            setSetupStep('idle');
                            setActiveTab('profile');
                          }}
                        >
                          I&apos;ve Saved These
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Password Change Section */}
              <div className="pt-6 border-t border-stone-200">
                <h3 className="text-sm font-semibold text-stone-900 mb-4">Password</h3>
                <p className="text-sm text-stone-600 mb-4">
                  To change your password, please contact your administrator.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {activeTab !== 'security' && (
        <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-between">
          {saveSuccess ? (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-emerald-600"
            >
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Saved successfully</span>
            </motion.div>
          ) : (
            <div />
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
