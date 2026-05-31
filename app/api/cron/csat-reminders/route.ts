export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sendCSATReminders, incrementReminderCount } from "@/lib/csat/queries";
import { sendWithOutbox } from "@/lib/email/outbox";
import { verifyCronAuth } from "@/lib/auth/cron";
import { appBaseUrl } from "@/lib/utils";

export async function GET(req: NextRequest) {
  // Fail-closed: rejects if CRON_SECRET not set or header mismatch
  const rejection = verifyCronAuth(req);
  if (rejection) return rejection;

  try {
    // Get pending surveys that need reminders
    const reminders = await sendCSATReminders(2); // Max 2 reminders

    let sent = 0;
    let skippedNoRecipient = 0;
    let errors = 0;

    for (const { survey, requesterEmail } of reminders) {
      // Skip surveys where the requester was deleted and has no email
      if (!requesterEmail) {
        skippedNoRecipient++;
        continue;
      }

      try {
        // Send reminder email via outbox for tracking
        const surveyUrl = `${appBaseUrl}/csat/${survey.tokenHash}`;

        await sendWithOutbox({
          type: "csat_reminder",
          to: requesterEmail,
          subject: "Reminder: How was your support experience?",
          html: `<p>We'd love to hear your feedback on your recent support ticket.</p><p><a href="${surveyUrl}">Take 30 seconds to rate your experience</a></p>`,
          text: `We'd love to hear your feedback on your recent support ticket. Rate your experience: ${surveyUrl}`,
          ticketId: survey.ticketId,
        });

        // Only mark as reminded if we actually attempted to send
        await incrementReminderCount(survey.id);
        sent++;
      } catch (error) {
        console.error(`[CSAT Reminder] Failed for survey ${survey.id}:`, error);
        errors++;
      }
    }

    return NextResponse.json({
      ok: true,
      total: reminders.length,
      sent,
      skipped_no_recipient: skippedNoRecipient,
      errors,
    });
  } catch (error) {
    console.error("Error sending CSAT reminders:", error);
    return NextResponse.json(
      { error: "Failed to send reminders" },
      { status: 500 },
    );
  }
}
