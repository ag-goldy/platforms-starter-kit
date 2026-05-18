/**
 * Cron Job: Renew Microsoft Graph Subscription
 *
 * Runs daily to check and renew subscriptions before they expire.
 * Should be scheduled in vercel.json or via external cron service.
 *
 * Cron: 0 0 * * * (daily at midnight)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getStoredSubscriptionId,
  renewSubscription,
  listSubscriptions,
  createEmailSubscription,
} from "@/lib/email/graph-inbound";
import { verifyCronAuth } from "@/lib/auth/cron";

export async function GET(request: NextRequest) {
  // Fail-closed: rejects if CRON_SECRET not set or header mismatch
  const rejection = verifyCronAuth(request);
  if (rejection) return rejection;

  try {
    // Get stored subscription ID
    let subscriptionId = await getStoredSubscriptionId();

    // If no stored ID, try to find one from the list
    if (!subscriptionId) {
      const subscriptions = await listSubscriptions();
      const emailSubscription = subscriptions.find(
        (s) =>
          s.resource.includes("/messages") &&
          s.notificationUrl.includes("/api/graph/notifications"),
      );
      if (emailSubscription) {
        subscriptionId = emailSubscription.id;
      }
    }

    if (!subscriptionId) {
      // No subscription exists, create one
      console.log("[Cron Graph] No subscription found, creating new one...");
      const result = await createEmailSubscription();

      if (result.success) {
        return NextResponse.json({
          success: true,
          action: "created",
          subscriptionId: result.subscriptionId,
          message: "New subscription created successfully",
        });
      }

      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    // Check if subscription needs renewal (expires within 24 hours)
    const subscriptions = await listSubscriptions();
    const subscription = subscriptions.find((s) => s.id === subscriptionId);

    if (!subscription) {
      // Subscription was deleted or expired, create new one
      console.log("[Cron Graph] Subscription not found, creating new one...");
      const result = await createEmailSubscription();

      if (result.success) {
        return NextResponse.json({
          success: true,
          action: "created",
          subscriptionId: result.subscriptionId,
          message: "New subscription created (old one was missing)",
        });
      }

      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    const expirationDate = new Date(subscription.expirationDateTime);
    const now = new Date();
    const hoursUntilExpiry =
      (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Renew if expires within 24 hours
    if (hoursUntilExpiry < 24) {
      console.log(
        "[Cron Graph] Subscription expires in",
        hoursUntilExpiry.toFixed(1),
        "hours, renewing...",
      );
      const result = await renewSubscription(subscriptionId);

      if (result.success) {
        return NextResponse.json({
          success: true,
          action: "renewed",
          subscriptionId,
          message: "Subscription renewed successfully",
        });
      }

      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    // No action needed
    return NextResponse.json({
      success: true,
      action: "none",
      subscriptionId,
      expiresIn: Math.round(hoursUntilExpiry) + " hours",
      message: "Subscription is still valid",
    });
  } catch (error) {
    console.error("[Cron Graph] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
