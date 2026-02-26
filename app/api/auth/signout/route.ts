import { NextResponse } from 'next/server';
import { signOut } from '@/auth';

export async function POST() {
  try {
    // Call signOut without redirect - we'll handle it client-side
    await signOut({ redirect: false });
    
    // Create response with cache-busting headers
    const response = NextResponse.json({ success: true });
    
    // Clear any remaining auth cookies that might be set
    const cookieNames = [
      'authjs.session-token',
      '__Secure-authjs.session-token',
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      'authjs.callback-url',
      '__Secure-authjs.callback-url',
      'authjs.csrf-token',
      '__Secure-authjs.csrf-token',
    ];
    
    cookieNames.forEach(name => {
      response.cookies.set(name, '', {
        path: '/',
        expires: new Date(0),
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    });
    
    return response;
  } catch (error) {
    console.error('Error signing out:', error);
    // Still return success so client can force redirect
    return NextResponse.json({ success: true, warning: 'Partial signout' });
  }
}
