import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrgCSATSurveys, getCSATAnalytics } from "@/lib/csat/queries";
import { requireInternalRole } from "@/lib/auth/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID required" },
        { status: 400 },
      );
    }

    await requireInternalRole();

    const responded = searchParams.get("responded");
    const includeAnalytics = searchParams.get("analytics") === "true";

    const [surveys, analytics] = await Promise.all([
      getOrgCSATSurveys(orgId, {
        responded:
          responded === "true"
            ? true
            : responded === "false"
              ? false
              : undefined,
        limit: 50,
      }),
      includeAnalytics ? getCSATAnalytics(orgId) : null,
    ]);

    return NextResponse.json({ surveys, analytics });
  } catch (error) {
    console.error("Error fetching CSAT data:", error);
    return NextResponse.json(
      { error: "Failed to fetch CSAT data" },
      { status: 500 },
    );
  }
}
