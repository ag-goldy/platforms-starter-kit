'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn, signOut, getCsrfToken, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Shield, Lock, Mail, ArrowRight, Ticket, BookOpen, Clock, Sparkles } from 'lucide-react';

interface OrgBranding {
  name: string;
  slug: string;
  branding?: {
    nameOverride?: string | null;
    logoUrl?: string | null;
    primaryColor?: string | null;
  } | null;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const callbackUrl = searchParams.get('callbackUrl') || '/app';
  const urlError = searchParams.get('error');
  const isSessionExpired = urlError === 'SessionExpired';
  const orgSlug = typeof window !== 'undefined' ? window.location.hostname.split('.')[0] : null;
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hasAttemptedSignout, setHasAttemptedSignout] = useState(false);
  const [orgBranding, setOrgBranding] = useState<OrgBranding | null>(null);
  const [loadingBranding, setLoadingBranding] = useState(true);

  // Fetch org branding
  useEffect(() => {
    async function fetchBranding() {
      if (!orgSlug || orgSlug === 'localhost' || orgSlug === 'www') {
        setLoadingBranding(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/organizations/branding?slug=${orgSlug}`);
        if (response.ok) {
          const data = await response.json();
          setOrgBranding(data.organization);
        }
      } catch (error) {
        console.error('Failed to fetch branding:', error);
      } finally {
        setLoadingBranding(false);
      }
    }

    fetchBranding();
  }, [orgSlug]);

  useEffect(() => {
    if (isSessionExpired && !hasAttemptedSignout) {
      setHasAttemptedSignout(true);
      setError('Your session has expired. Please sign in again.');
      signOut({ redirect: false });
    }
  }, [isSessionExpired, hasAttemptedSignout]);

  useEffect(() => {
    if (status === 'authenticated' && session && !isSessionExpired) {
      const redirectTo = callbackUrl.startsWith('/login') ? '/app' : callbackUrl;
      router.replace(redirectTo);
    }
  }, [status, session, callbackUrl, router, isSessionExpired]);

  useEffect(() => {
    getCsrfToken().then((token) => {
      if (token) setCsrfToken(token);
    });
  }, []);

  useEffect(() => {
    if (urlError && !isSessionExpired) {
      if (urlError === 'CredentialsSignin') {
        setError('Invalid email or password');
      } else if (urlError === 'SessionRequired') {
        setError('Please sign in to continue');
      } else {
        setError(urlError);
      }
    }
  }, [urlError, isSessionExpired]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email: email.trim(),
        password,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === 'CredentialsSignin') {
          setError('Invalid email or password');
        } else if (result.error === 'AccessDenied') {
          setError('Access denied');
        } else {
          setError(result.error);
        }
        setIsLoading(false);
        return;
      }

      if (result?.ok && result?.url) {
        window.location.href = result.url;
        return;
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  }

  const primaryColor = orgBranding?.branding?.primaryColor || '#F97316';
  const logoUrl = orgBranding?.branding?.logoUrl;
  const orgName = orgBranding?.branding?.nameOverride || orgBranding?.name || 'AGR Networks';

  if (status === 'loading' && !isSessionExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    );
  }

  if (status === 'authenticated' && !isSessionExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background Pattern */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
        
        {/* Top - Logo */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3">
            <img 
              src="/logo/AGR_logo.png" 
              alt="AGR Networks" 
              className="h-10 w-auto"
            />
            <span className="text-gray-500">|</span>
            <img 
              src="/logo/atlas-logo.png" 
              alt="Atlas" 
              className="h-9 w-auto"
            />
          </Link>
        </div>

        {/* Middle - Features */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">
              Welcome to {orgName}
            </h2>
            <p className="text-gray-400">Sign in to access your support portal</p>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div 
                className="p-3 rounded-lg" 
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <Ticket className="h-6 w-6" style={{ color: primaryColor }} />
              </div>
              <div>
                <h3 className="text-white font-semibold">Ticket Management</h3>
                <p className="text-gray-400 text-sm mt-1">Track and manage support requests efficiently</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div 
                className="p-3 rounded-lg" 
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <BookOpen className="h-6 w-6" style={{ color: primaryColor }} />
              </div>
              <div>
                <h3 className="text-white font-semibold">Knowledge Base</h3>
                <p className="text-gray-400 text-sm mt-1">Access articles, guides, and FAQs</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div 
                className="p-3 rounded-lg" 
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <Sparkles className="h-6 w-6" style={{ color: primaryColor }} />
              </div>
              <div>
                <h3 className="text-white font-semibold">AI Assistant</h3>
                <p className="text-gray-400 text-sm mt-1">Get instant answers with AI-powered support</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-gray-500 text-sm">
            © 2026 {orgName}. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 bg-white">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <img 
                src="/logo/AGR_logo.png" 
                alt="AGR Networks" 
                className="h-8 w-auto"
              />
              <span className="text-gray-300">|</span>
              <img 
                src="/logo/atlas-logo.png" 
                alt="Atlas" 
                className="h-7 w-auto"
              />
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Sign in to your account</h1>
            <p className="text-gray-500 mt-2">
              Enter your credentials to access the {orgName} support portal
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
              <Shield className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <input type="hidden" name="csrfToken" value={csrfToken} />
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-900 font-medium">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="pl-10 h-12 border-gray-300 text-black placeholder:text-gray-400 focus:border-orange-500 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-gray-900 font-medium">
                  Password
                </Label>
                <Link 
                  href="/forgot-password" 
                  className="text-sm font-medium text-orange-500 hover:text-orange-600 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pl-10 h-12 border-gray-300 text-black placeholder:text-gray-400 focus:border-orange-500 focus:ring-orange-500"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-base"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600">
              Need help?{' '}
              <Link href="/support" className="font-medium text-orange-500 hover:text-orange-600 transition-colors">
                Contact Support
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#F97316]" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
