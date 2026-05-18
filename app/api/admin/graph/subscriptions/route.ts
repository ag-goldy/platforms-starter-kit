/**
 * Admin API for Microsoft Graph Subscription Management
 *
 * POST /api/admin/graph/subscriptions - Create new subscription
 * PATCH /api/admin/graph/subscriptions - Renew existing subscription
 * DELETE /api/admin/graph/subscriptions - Delete subscription
 * GET /api/admin/graph/subscriptions - List subscriptions
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/permissions";
import { z } from "zod";
import {
  createEmailSubscription,
  renewSubscription,
  deleteSubscription,
  listSubscriptions,
  getStoredSubscriptionId,
} from "@/lib/email/graph-inbound";

const createSchema = z.object({
  action: z.enum(["create", "renew", "delete", "list"]),
  subscriptionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const data = createSchema.parse(body);

    switch (data.action) {
      case "create": {
        const result = await createEmailSubscription();
        if (result.success) {
          return NextResponse.json({
            success: true,
            message: "Subscription created successfully",
            subscriptionId: result.subscriptionId,
          });
        }
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 },
        );
      }

      case "renew": {
        const subId = data.subscriptionId || (await getStoredSubscriptionId());
        if (!subId) {
          return NextResponse.json(
            { success: false, error: "No subscription ID provided or stored" },
            { status: 400 },
          );
        }
        const result = await renewSubscription(subId);
        if (result.success) {
          return NextResponse.json({
            success: true,
            message: "Subscription renewed successfully",
          });
        }
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 },
        );
      }

      case "delete": {
        const subId = data.subscriptionId || (await getStoredSubscriptionId());
        if (!subId) {
          return NextResponse.json(
            { success: false, error: "No subscription ID provided or stored" },
            { status: 400 },
          );
        }
        await deleteSubscription(subId);
        return NextResponse.json({
          success: true,
          message: "Subscription deleted successfully",
        });
      }

      case "list": {
        const subscriptions = await listSubscriptions();
        return NextResponse.json({
          success: true,
          subscriptions,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 },
        );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AuthorizationError") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 },
      );
    }
    console.error("[Graph Subscriptions] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    await requireAuth();
    const subscriptions = await listSubscriptions();
    const storedId = await getStoredSubscriptionId();

    return NextResponse.json({
      success: true,
      subscriptions,
      storedSubscriptionId: storedId,
      configured: !!(
        process.env.MICROSOFT_GRAPH_TENANT_ID &&
        process.env.MICROSOFT_GRAPH_CLIENT_ID &&
        process.env.MICROSOFT_GRAPH_CLIENT_SECRET
      ),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AuthorizationError") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("[Graph Subscriptions] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
