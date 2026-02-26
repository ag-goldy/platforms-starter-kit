import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { disable2FA } from '@/lib/auth/2fa-queries';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { logAudit } from '@/lib/audit/log';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { password } = await request.json();
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Verify password
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { passwordHash: true },
    });

    if (!dbUser?.passwordHash) {
      return NextResponse.json(
        { error: 'Password authentication not available' },
        { status: 400 }
      );
    }

    const passwordValid = await bcrypt.compare(password, dbUser.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 400 }
      );
    }

    await disable2FA(session.user.id);

    await logAudit({
      userId: session.user.id,
      action: 'USER_2FA_DISABLED',
      details: JSON.stringify({ userId: session.user.id }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    return NextResponse.json(
      { error: 'Failed to disable 2FA' },
      { status: 500 }
    );
  }
}
