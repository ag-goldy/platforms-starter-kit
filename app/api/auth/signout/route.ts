import { NextResponse } from 'next/server';

// Get the domain for cookies - in production, use the root domain for subdomain support
const getCookieDomain = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) return undefined;
  
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!rootDomain) return undefined;
  
  // If it's a subdomain like atlas.agrnetworks.com, set cookie on .agrnetworks.com
  const parts = rootDomain.split('.');
  if (parts.length >= 2) {
    return '.' + parts.slice(-2).join('.');
  }
  
  return undefined;
};

const cookieDomain = getCookieDomain();

/**
 * Server-side signout that clears all auth cookies
 * Use this when session is invalid but client-side signOut won't work
 */
function createSignoutResponse(request: Request) {
  const url = new URL(request.url);
  const callbackUrl = url.searchParams.get('callbackUrl') || '/login';
  
  const response = NextResponse.redirect(new URL(callbackUrl, request.url));
  
  // Clear all auth cookies with various combinations
  const cookieConfigs = [
    // Standard authjs cookies
    { name: 'authjs.session-token', secure: false },
    { name: '__Secure-authjs.session-token', secure: true },
    { name: 'authjs.callback-url', secure: false },
    { name: '__Secure-authjs.callback-url', secure: true },
    { name: 'authjs.csrf-token', secure: false },
    { name: '__Secure-authjs.csrf-token', secure: true },
    // Legacy next-auth cookies
    { name: 'next-auth.session-token', secure: false },
    { name: '__Secure-next-auth.session-token', secure: true },
    { name: 'next-auth.callback-url', secure: false },
    { name: '__Secure-next-auth.callback-url', secure: true },
    { name: 'next-auth.csrf-token', secure: false },
    { name: '__Secure-next-auth.csrf-token', secure: true },
  ];

  const isProduction = process.env.NODE_ENV === 'production';

  cookieConfigs.forEach(({ name, secure }) => {
    // Clear with domain-specific cookie
    response.cookies.set(name, '', {
      path: '/',
      expires: new Date(0),
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction && secure,
      domain: cookieDomain,
    });
    
    // Also clear without domain (for localhost and fallback)
    response.cookies.set(name, '', {
      path: '/',
      expires: new Date(0),
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction && secure,
    });
    
    // Clear with maxAge for extra measure
    response.cookies.set(name, '', {
      path: '/',
      maxAge: 0,
    });
  });

  return response;
}

export async function GET(request: Request) {
  return createSignoutResponse(request);
}

export async function POST(request: Request) {
  return createSignoutResponse(request);
}
