export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sendCSATReminders, incrementReminderCount } from "@/lib/csat/queries";
import { sendEmail } from "@/lib/email";
import { verifyCronAuth } from "@/lib/auth/cron";

export async function GET(req: NextRequest) {
  // Fail-closed: rejects if CRON_SECRET not set or header mismatch
  const rejection = verifyCronAuth(req);
  if (rejection) return rejection;

  try {
    // Get pending surveys that need reminders
    const reminders = await sendCSATReminders(2); // Max 2 reminders

    const results = [];
    for (const { survey } of reminders) {
      try {
        // Send reminder email
        const surveyUrl = `${process.env.APP_BASE_URL}/csat/${survey.tokenHash}`;

        await sendEmail({
          to: survey.requesterId || "", // Would need to look up email
          subject: "Reminder: How was your support experience?",
          html: `
            <p>We'd love to hear your feedback on your recent support ticket.</p>
            <p><a href="${surveyUrl}">Take 30 seconds to rate your experience</a></p>
          `,
        });

        await incrementReminderCount(survey.id);
        results.push({ surveyId: survey.id, sent: true });
      } catch (error) {
        results.push({
          surveyId: survey.id,
          sent: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      remindersSent: results.filter((r) => r.sent).length,
      results,
    });
  } catch (error) {
    console.error("Error sending CSAT reminders:", error);
    return NextResponse.json(
      { error: "Failed to send reminders" },
      { status: 500 },
    );
  }
}
