import { type NextRequest, NextResponse } from 'next/server';
import { rootDomain } from '@/lib/utils';
import { getCorrelationIdFromHeaders, addCorrelationIdHeader } from '@/lib/monitoring/correlation';
import { neon } from '@neondatabase/serverless';

// Get the domain for cookies - in production, use the root domain for subdomain support
const getCookieDomain = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) return undefined;
  
  const domain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!domain) return undefined;
  
  // If it's a subdomain like atlas.agrnetworks.com, set cookie on .agrnetworks.com
  const parts = domain.split('.');
  if (parts.length >= 2) {
    return '.' + parts.slice(-2).join('.');
  }
  
  return undefined;
};

const cookieDomain = getCookieDomain();

/**
 * Check if organization is disabled (edge-compatible)
 */
async function isOrgDisabled(subdomain: string): Promise<boolean> {
  try {
    const sql = neon(process.env.DATABASE_URL || '');
    const result = await sql`SELECT is_active, deleted_at FROM organizations WHERE subdomain = ${subdomain} LIMIT 1`;
    if (result.length === 0) return false; // Org not found, let it 404 elsewhere
    const org = result[0] as { is_active: boolean; deleted_at: string | null };
    // Disabled if is_active is false OR deleted_at is set
    return !org.is_active || org.deleted_at !== null;
  } catch {
    // If we can't check, don't block (fail open for safety)
    return false;
  }
}

/**
 * Extract subdomain from request
 */
function extractSubdomain(request: NextRequest): string | null {
  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0];

  // Local development
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    if (hostname.includes('.localhost')) {
      return hostname.split('.')[0];
    }
    
    const pathname = request.nextUrl.pathname;
    if (pathname.startsWith('/s/')) {
      const pathParts = pathname.split('/');
      if (pathParts.length >= 3 && pathParts[2]) {
        return pathParts[2];
      }
    }

    return null;
  }

  // Production
  const rootDomainFormatted = rootDomain.split(':')[0];

  // Vercel preview URLs
  if (hostname.includes('---') && hostname.endsWith('.vercel.app')) {
    const parts = hostname.split('---');
    return parts.length > 0 ? parts[0] : null;
  }

  // Regular subdomain
  const isSubdomain =
    hostname !== rootDomainFormatted &&
    hostname !== `www.${rootDomainFormatted}` &&
    hostname.endsWith(`.${rootDomainFormatted}`);

  return isSubdomain ? hostname.replace(`.${rootDomainFormatted}`, '') : null;
}

/**
 * Clear all auth cookies
 */
function clearAuthCookies(response: NextResponse) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const cookieConfigs = [
    { name: 'authjs.session-token', secure: false },
    { name: '__Secure-authjs.session-token', secure: true },
    { name: 'next-auth.session-token', secure: false },
    { name: '__Secure-next-auth.session-token', secure: true },
    { name: 'authjs.callback-url', secure: false },
    { name: '__Secure-authjs.callback-url', secure: true },
    { name: 'authjs.csrf-token', secure: false },
    { name: '__Secure-authjs.csrf-token', secure: true },
  ];

  cookieConfigs.forEach(({ name, secure }) => {
    // Clear with domain (for production subdomain support)
    if (cookieDomain) {
      response.cookies.set(name, '', {
        path: '/',
        expires: new Date(0),
        domain: cookieDomain,
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction && secure,
      });
    }
    
    // Clear without domain (for localhost and direct access)
    response.cookies.set(name, '', {
      path: '/',
      expires: new Date(0),
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction && secure,
    });
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const subdomain = extractSubdomain(request);
  
  // Add correlation ID
  const correlationId = getCorrelationIdFromHeaders(request.headers);
  const response = NextResponse.next();
  addCorrelationIdHeader(response.headers, correlationId);

  // Check for auth cookie
  const sessionCookie = 
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value ||
    request.cookies.get('next-auth.session-token')?.value ||
    request.cookies.get('__Secure-next-auth.session-token')?.value;

  // Protect /app routes - redirect to login if no session cookie
  if (pathname.startsWith('/app')) {
    if (!sessionCookie) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      const redirectResponse = NextResponse.redirect(loginUrl);
      clearAuthCookies(redirectResponse);
      return redirectResponse;
    }
    // Note: Actual session validation happens in the page/layout
  }

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    if (!sessionCookie) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      const redirectResponse = NextResponse.redirect(loginUrl);
      clearAuthCookies(redirectResponse);
      return redirectResponse;
    }
  }

  if (subdomain) {
    // Check if organization is disabled
    const orgDisabled = await isOrgDisabled(subdomain);
    if (orgDisabled && !pathname.startsWith('/disabled')) {
      return NextResponse.redirect(new URL('/disabled', request.url));
    }

    // Block admin/app access from subdomains
    if (pathname.startsWith('/admin') || pathname.startsWith('/app')) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Protect all /s/[subdomain]/* routes - require authentication
    if (!sessionCookie) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      const redirectResponse = NextResponse.redirect(loginUrl);
      clearAuthCookies(redirectResponse);
      return redirectResponse;
    }

    // Rewrite root to subdomain page
    if (pathname === '/') {
      return NextResponse.rewrite(new URL(`/s/${subdomain}`, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next|static|.*\..*).*)',
  ],
};
