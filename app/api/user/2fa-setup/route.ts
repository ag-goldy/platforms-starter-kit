import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  generateSecret,
  generateQRCode,
  generateBackupCodes,
} from "@/lib/auth/2fa";
import { save2FASecret } from "@/lib/auth/2fa-queries";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 5 setup attempts per hour — prevents brute-force secret cycling
    const rl = await rateLimit(`2fa-setup:${session.user.id}`, {
      maxRequests: 5,
      windowSeconds: 3600,
    });
    if (!rl.allowed)
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      );

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
    console.error("Error starting 2FA setup:", error);
    return NextResponse.json(
      { error: "Failed to start 2FA setup" },
      { status: 500 },
    );
  }
}
