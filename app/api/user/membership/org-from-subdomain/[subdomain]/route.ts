import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { memberships, organizations } from "@/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ subdomain: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subdomain } = await params;

    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.subdomain, subdomain),
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, organization.id),
        eq(memberships.isActive, true),
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 404 });
    }

    return NextResponse.json({
      orgId: organization.id,
      orgName: organization.name,
      subdomain: organization.subdomain,
      role: membership.role,
      joinedAt: membership.createdAt,
    });
  } catch (error) {
    console.error("Error fetching membership by subdomain:", error);
    return NextResponse.json(
      { error: "Failed to fetch membership" },
      { status: 500 },
    );
  }
}
