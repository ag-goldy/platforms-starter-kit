import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Stub: notification_preferences feature is being rebuilt.
  // The full implementation lands in a follow-up commit.
  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "notification_preferences feature not yet installed",
  });
}
