import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyTOTP } from '@/lib/auth/2fa';
import { getUser2FASecret, enable2FA } from '@/lib/auth/2fa-queries';
import { logAudit } from '@/lib/audit/log';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json();
    if (!token || !/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: 'Invalid verification code format' },
        { status: 400 }
      );
    }

    const secret = await getUser2FASecret(session.user.id);
    if (!secret) {
      return NextResponse.json(
        { error: '2FA setup not started. Please start setup first.' },
        { status: 400 }
      );
    }

    const isValid = verifyTOTP(secret, token);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code. Please try again.' },
        { status: 400 }
      );
    }

    // Enable 2FA
    await enable2FA(session.user.id);

    await logAudit({
      userId: session.user.id,
      action: 'USER_2FA_ENABLED',
      details: JSON.stringify({ userId: session.user.id }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    return NextResponse.json(
      { error: 'Failed to verify 2FA' },
      { status: 500 }
    );
  }
}
