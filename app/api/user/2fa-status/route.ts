import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUser2FAStatus } from '@/lib/auth/2fa-queries';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = await getUser2FAStatus(session.user.id);
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error fetching 2FA status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch 2FA status' },
      { status: 500 }
    );
  }
}
