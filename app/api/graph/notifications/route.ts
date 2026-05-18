/**
 * Microsoft Graph Webhook Notifications Endpoint
 *
 * Receives change notifications when new emails arrive.
 * Validates Microsoft's JWT tokens and processes emails into tickets.
 *
 * Microsoft Docs: https://learn.microsoft.com/en-us/graph/webhooks
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchEmail, processInboundEmail } from "@/lib/email/graph-inbound";
import { constantTimeEquals } from "@/lib/security/secrets";

// Validation token for initial webhook registration
const VALIDATION_TOKEN_PARAM = "validationToken";

/**
 * Handle Graph webhook notifications (POST)
 *
 * Microsoft sends notifications when:
 * - New email arrives (changeType: 'created')
 * - Subscription is about to expire
 */
export async function POST(request: NextRequest) {
  try {
    // Handle subscription validation (Microsoft sends this when creating subscription)
    const url = new URL(request.url);
    const validationToken = url.searchParams.get(VALIDATION_TOKEN_PARAM);

    if (validationToken) {
      // Microsoft requires us to return the validation token in plain text
      return new NextResponse(validationToken, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const expectedClientState = process.env.GRAPH_WEBHOOK_SECRET;
    if (!expectedClientState) {
      console.error(
        "[SECURITY] GRAPH_WEBHOOK_SECRET is not configured - rejecting Graph notification",
      );
      return NextResponse.json(
        { error: "Graph webhook not configured" },
        { status: 503 },
      );
    }

    // Parse the notification payload
    const body = await request.json();

    if (!body.value || !Array.isArray(body.value)) {
      return NextResponse.json(
        { error: "Invalid notification format" },
        { status: 400 },
      );
    }

    // Process each notification
    for (const notification of body.value) {
      // Validate clientState
      if (
        !constantTimeEquals(
          String(notification.clientState || ""),
          expectedClientState,
        )
      ) {
        console.error(
          "[Graph Webhook] Invalid clientState - possible spoofing attempt",
        );
        continue;
      }

      // Handle different notification types
      if (notification.changeType === "created" && notification.resourceData) {
        const messageId = notification.resourceData.id;

        console.log("[Graph Webhook] New email notification:", messageId);

        // Fetch the full email details
        const email = await fetchEmail(messageId);

        if (email) {
          // Process email into ticket
          const result = await processInboundEmail(email);

          if (result.success) {
            console.log(
              "[Graph Webhook] Processed email:",
              result.ticketKey,
              "isReply:",
              result.isReply,
            );
          } else {
            console.error(
              "[Graph Webhook] Failed to process email:",
              result.error,
            );
          }
        } else {
          console.error("[Graph Webhook] Could not fetch email:", messageId);
        }
      }
    }

    // Always return 202 Accepted (acknowledge receipt)
    return NextResponse.json({ status: "accepted" }, { status: 202 });
  } catch (error) {
    console.error("[Graph Webhook] Error processing notification:", error);
    // Still return 202 to prevent Microsoft from retrying
    return NextResponse.json({ status: "error" }, { status: 202 });
  }
}

/**
 * Handle validation requests (GET)
 *
 * Some webhook configurations use GET for initial validation
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const validationToken = url.searchParams.get(VALIDATION_TOKEN_PARAM);

  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({
    status: "ok",
    message: "Microsoft Graph webhook endpoint",
    configured: !!process.env.MICROSOFT_GRAPH_TENANT_ID,
  });
}
