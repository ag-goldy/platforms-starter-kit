import { NextRequest, NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/utils";
import { sendWithOutbox } from "@/lib/email/outbox";
import { generatePasswordResetToken } from "@/lib/auth/password-reset";
import { renderPasswordResetEmail } from "@/lib/email/templates/password-reset";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "Email address is required" },
        { status: 400 },
      );
    }

    const token = await generatePasswordResetToken(email);

    if (!token) {
      return NextResponse.json({ success: true });
    }

    const resetUrl = new URL(
      `/reset-password?token=${encodeURIComponent(token)}`,
      appBaseUrl,
    ).toString();
    const rendered = renderPasswordResetEmail({
      email,
      url: resetUrl,
      expiresInMinutes: 24 * 60,
    });

    await sendWithOutbox({
      type: "password_reset",
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Password Reset] Failed to request reset:", error);
    return NextResponse.json(
      { error: "Failed to send reset email" },
      { status: 500 },
    );
  }
}
