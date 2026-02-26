import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateSecret, generateQRCode, generateBackupCodes } from '@/lib/auth/2fa';
import { save2FASecret } from '@/lib/auth/2fa-queries';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const secret = generateSecret();
    const qrCode = await generateQRCode(secret, session.user.email);
    const { plain: backupCodes, hashed } = generateBackupCodes();

    // Save secret and backup codes (but don't enable yet)
    await save2FASecret(session.user.id, secret, hashed);

    return NextResponse.json({
      success: true,
      secret,
      qrCode,
      backupCodes,
    });
  } catch (error) {
    console.error('Error starting 2FA setup:', error);
    return NextResponse.json(
      { error: 'Failed to start 2FA setup' },
      { status: 500 }
    );
  }
}
