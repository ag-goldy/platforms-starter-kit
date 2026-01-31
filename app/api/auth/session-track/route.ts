/**
 * API route to create session after login
 * This is called as a side effect after successful authentication
 */

import { auth } from '@/auth';
import { createSessionAfterLogin } from '@/lib/auth/session-tracking';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await createSessionAfterLogin(session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Session Track] Error creating session:', error);
    // Don't fail the request - session tracking is best effort
    return NextResponse.json({ success: false, error: 'Failed to track session' }, { status: 500 });
  }
}

