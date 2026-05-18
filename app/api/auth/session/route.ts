import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const session = await auth();
    const response = NextResponse.json(session);

    if (!session) {
      const cookieStore = await cookies();
      const hasSessionCookie =
        !!cookieStore.get('authjs.session-token')?.value ||
        !!cookieStore.get('__Secure-authjs.session-token')?.value ||
        !!cookieStore.get('next-auth.session-token')?.value ||
        !!cookieStore.get('__Secure-next-auth.session-token')?.value;

      if (hasSessionCookie) {
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

        for (const name of cookieNames) {
          response.cookies.set(name, '', {
            path: '/',
            expires: new Date(0),
            httpOnly: true,
            sameSite: 'lax',
          });
        }
      }
    }

    return response;
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}
