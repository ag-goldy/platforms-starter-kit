import { NextRequest, NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/utils";
import { sendWithOutbox } from "@/lib/email/outbox";
import { generatePasswordResetToken } from "@/lib/auth/password-reset";
import { renderPasswordResetEmail } from "@/lib/email/templates/password-reset";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

const RATE_LIMIT_WINDOW_SECONDS = 15 * 60; // 15 minutes
const MAX_REQUESTS_PER_EMAIL = 3;
const MAX_REQUESTS_PER_IP = 10;

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

    const headers = request.headers;
    const ip = getClientIP(headers);

    // Check per-IP rate limit
    const ipLimit = await rateLimit(`reset:ip:${ip}`, {
      maxRequests: MAX_REQUESTS_PER_IP,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    // Check per-email rate limit
    const emailLimit = await rateLimit(`reset:email:${email}`, {
      maxRequests: MAX_REQUESTS_PER_EMAIL,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    if (!ipLimit.allowed || !emailLimit.allowed) {
      console.info("[Password Reset] Rate limited", {
        email,
        ip,
        ipAllowed: ipLimit.allowed,
        emailAllowed: emailLimit.allowed,
      });
      // Return generic success to prevent account enumeration
      return NextResponse.json({ success: true });
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
