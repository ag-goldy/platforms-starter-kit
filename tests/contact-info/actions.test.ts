import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { orgContactInfo, organizations, users, memberships } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  getOrgContactInfo,
  updateOrgContactInfo,
} from "@/app/app/settings/contact-info/actions";
import { getRequestContext } from "@/lib/auth/context";

vi.mock("@/lib/auth/context", () => ({
  getRequestContext: vi.fn(),
}));

const mockGetRequestContext = getRequestContext as ReturnType<typeof vi.fn>;

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("contact info server actions", () => {
  beforeEach(async () => {
    if (!process.env.DATABASE_URL) return;
    await db.execute(
      sql.raw(`DELETE FROM org_contact_info WHERE org_id IN (SELECT id FROM organizations WHERE name LIKE 'contact-info-test-%');`),
    );
    await db.execute(
      sql.raw(`DELETE FROM memberships WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'contact-info-test-%');`),
    );
    await db.execute(
      sql.raw(`DELETE FROM users WHERE email LIKE 'contact-info-test-%';`),
    );
    await db.execute(
      sql.raw(`DELETE FROM organizations WHERE name LIKE 'contact-info-test-%';`),
    );
  });

  afterEach(async () => {
    if (!process.env.DATABASE_URL) return;
    await db.execute(
      sql.raw(`DELETE FROM org_contact_info WHERE org_id IN (SELECT id FROM organizations WHERE name LIKE 'contact-info-test-%');`),
    );
    await db.execute(
      sql.raw(`DELETE FROM memberships WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'contact-info-test-%');`),
    );
    await db.execute(
      sql.raw(`DELETE FROM users WHERE email LIKE 'contact-info-test-%';`),
    );
    await db.execute(
      sql.raw(`DELETE FROM organizations WHERE name LIKE 'contact-info-test-%';`),
    );
  });

  async function createOrgAndAdmin(overrides: { adminRole?: string } = {}) {
    const [org] = await db
      .insert(organizations)
      .values({
        name: `contact-info-test-org-${Date.now()}`,
        slug: `contact-info-test-${Date.now()}`,
        subdomain: `contact-info-test-${Date.now()}`,
      })
      .returning();

    const [admin] = await db
      .insert(users)
      .values({
        email: `contact-info-test-admin-${Date.now()}@example.com`,
        name: "Test Admin",
        isInternal: false,
      })
      .returning();

    await db.insert(memberships).values({
      userId: admin.id,
      orgId: org.id,
      role: overrides.adminRole || "ADMIN",
      isActive: true,
    });

    return { org, admin };
  }

  async function createMember(orgId: string) {
    const [member] = await db
      .insert(users)
      .values({
        email: `contact-info-test-member-${Date.now()}@example.com`,
        name: "Test Member",
        isInternal: false,
      })
      .returning();

    await db.insert(memberships).values({
      userId: member.id,
      orgId,
      role: "READONLY",
      isActive: true,
    });

    return member;
  }

  it("getOrgContactInfo returns default shape when no row exists", async () => {
    const { org, admin } = await createOrgAndAdmin();

    mockGetRequestContext.mockResolvedValue({
      user: admin,
      isPlatformAdmin: false,
      platformAdmin: null,
      org: null,
      membership: null,
    });

    const result = await getOrgContactInfo();
    expect(result.orgId).toBe(org.id);
    expect(result.supportPhone).toBeNull();
    expect(result.supportEmail).toBeNull();
    expect(result.supportUrl).toBeNull();
  });

  it("getOrgContactInfo returns row when one exists", async () => {
    const { org, admin } = await createOrgAndAdmin();

    await db.insert(orgContactInfo).values({
      orgId: org.id,
      supportPhone: "+1 555 0100",
      supportEmail: "help@example.com",
      supportUrl: "https://help.example.com",
    });

    mockGetRequestContext.mockResolvedValue({
      user: admin,
      isPlatformAdmin: false,
      platformAdmin: null,
      org: null,
      membership: null,
    });

    const result = await getOrgContactInfo();
    expect(result.orgId).toBe(org.id);
    expect(result.supportPhone).toBe("+1 555 0100");
    expect(result.supportEmail).toBe("help@example.com");
    expect(result.supportUrl).toBe("https://help.example.com");
  });

  it("getOrgContactInfo uses context.org when subdomain-resolved", async () => {
    const { org, admin } = await createOrgAndAdmin();

    mockGetRequestContext.mockResolvedValue({
      user: admin,
      isPlatformAdmin: false,
      platformAdmin: null,
      org,
      membership: null,
    });

    const result = await getOrgContactInfo();
    expect(result.orgId).toBe(org.id);
  });

  it("getOrgContactInfo falls back to oldest active membership", async () => {
    const { org: org1, admin } = await createOrgAndAdmin();

    // Create a second org and membership (newer)
    const [org2] = await db
      .insert(organizations)
      .values({
        name: `contact-info-test-org2-${Date.now()}`,
        slug: `contact-info-test-org2-${Date.now()}`,
        subdomain: `contact-info-test-org2-${Date.now()}`,
      })
      .returning();

    await db.insert(memberships).values({
      userId: admin.id,
      orgId: org2.id,
      role: "ADMIN",
      isActive: true,
    });

    // No org in context, so it should fall back to oldest membership (org1)
    mockGetRequestContext.mockResolvedValue({
      user: admin,
      isPlatformAdmin: false,
      platformAdmin: null,
      org: null,
      membership: null,
    });

    const result = await getOrgContactInfo();
    expect(result.orgId).toBe(org1.id);
  });

  it("getOrgContactInfo throws when user is not an admin", async () => {
    const { org } = await createOrgAndAdmin();
    const member = await createMember(org.id);

    mockGetRequestContext.mockResolvedValue({
      user: member,
      isPlatformAdmin: false,
      platformAdmin: null,
      org: null,
      membership: null,
    });

    await expect(getOrgContactInfo()).rejects.toThrow("Insufficient organization role");
  });

  it("getOrgContactInfo throws when no org context and no memberships", async () => {
    const [lonelyUser] = await db
      .insert(users)
      .values({
        email: `contact-info-test-lonely-${Date.now()}@example.com`,
        name: "Lonely User",
        isInternal: false,
      })
      .returning();

    mockGetRequestContext.mockResolvedValue({
      user: lonelyUser,
      isPlatformAdmin: false,
      platformAdmin: null,
      org: null,
      membership: null,
    });

    await expect(getOrgContactInfo()).rejects.toThrow("No organization context available");
  });

  it("getOrgContactInfo throws when unauthenticated", async () => {
    mockGetRequestContext.mockResolvedValue({
      user: null,
      isPlatformAdmin: false,
      platformAdmin: null,
      org: null,
      membership: null,
    });

    await expect(getOrgContactInfo()).rejects.toThrow("Authentication required");
  });

  it("updateOrgContactInfo inserts new row when none exists", async () => {
    const { org, admin } = await createOrgAndAdmin();

    mockGetRequestContext.mockResolvedValue({
      user: admin,
      isPlatformAdmin: false,
      platformAdmin: null,
      org: null,
      membership: null,
    });

    const result = await updateOrgContactInfo({
      supportPhone: "+1 555 0100",
      supportEmail: "help@example.com",
      supportUrl: "https://help.example.com",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.contactInfo.orgId).toBe(org.id);
    expect(result.contactInfo.supportPhone).toBe("+1 555 0100");
    expect(result.contactInfo.supportEmail).toBe("help@example.com");
    expect(result.contactInfo.supportUrl).toBe("https://help.example.com");

    // Verify DB
    const row = await db.query.orgContactInfo.findFirst({
      where: eq(orgContactInfo.orgId, org.id),
    });
    expect(row).not.toBeNull();
    expect(row!.supportPhone).toBe("+1 555 0100");
  });

  it("updateOrgContactInfo updates existing row (UPSERT)", async () => {
    const { org, admin } = await createOrgAndAdmin();

    await db.insert(orgContactInfo).values({
      orgId: org.id,
      supportPhone: "+1 555 0000",
      supportEmail: "old@example.com",
      supportUrl: "https://old.example.com",
    });

    mockGetRequestContext.mockResolvedValue({
      user: admin,
      isPlatformAdmin: false,
      platformAdmin: null,
      org: null,
      membership: null,
    });

    const result = await updateOrgContactInfo({
      supportPhone: "+1 555 9999",
      supportEmail: "new@example.com",
      supportUrl: "https://new.example.com",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.contactInfo.supportPhone).toBe("+1 555 9999");

    // Verify DB
    const row = await db.query.orgContactInfo.findFirst({
      where: eq(orgContactInfo.orgId, org.id),
    });
    expect(row!.supportPhone).toBe("+1 555 9999");
    expect(row!.supportEmail).toBe("new@example.com");
  });

  it("updateOrgContactInfo rejects invalid email", async () => {
    const { org, admin } = await createOrgAndAdmin();

    mockGetRequestContext.mockResolvedValue({
      user: admin,
      isPlatformAdmin: false,
      platformAdmin: null,
      org: null,
      membership: null,
    });

    const result = await updateOrgContactInfo({
      supportEmail: "not-an-email",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid contact info data");
  });

  it("updateOrgContactInfo rejects URL without http(s) prefix", async () => {
    const { org, admin } = await createOrgAndAdmin();

    mockGetRequestContext.mockResolvedValue({
      user: admin,
      isPlatformAdmin: false,
      platformAdmin: null,
      org: null,
      membership: null,
    });

    const result = await updateOrgContactInfo({
      supportUrl: "ftp://help.example.com",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid contact info data");
  });

  it("updateOrgContactInfo rejects phone over 50 chars", async () => {
    const { org, admin } = await createOrgAndAdmin();

    mockGetRequestContext.mockResolvedValue({
      user: admin,
      isPlatformAdmin: false,
      platformAdmin: null,
      org: null,
      membership: null,
    });

    const result = await updateOrgContactInfo({
      supportPhone: "+1 555 0100 ".repeat(10),
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid contact info data");
  });

  it("updateOrgContactInfo cannot update another org's contact info (IDOR)", async () => {
    const { org: orgA, admin: adminA } = await createOrgAndAdmin();
    const { org: orgB, admin: adminB } = await createOrgAndAdmin();

    // Set up contact info for orgB
    await db.insert(orgContactInfo).values({
      orgId: orgB.id,
      supportPhone: "+1 555 0200",
      supportEmail: "orgB@example.com",
      supportUrl: "https://orgB.example.com",
    });

    // Authenticate as adminA (orgA) but try to update with orgB context
    mockGetRequestContext.mockResolvedValue({
      user: adminA,
      isPlatformAdmin: false,
      platformAdmin: null,
      org: null,
      membership: null,
    });

    // AdminA updates orgA's contact info
    const result = await updateOrgContactInfo({
      supportPhone: "+1 555 0300",
      supportEmail: "orgA@example.com",
      supportUrl: "https://orgA.example.com",
    });

    expect(result.success).toBe(true);

    // Verify orgA was updated
    const rowA = await db.query.orgContactInfo.findFirst({
      where: eq(orgContactInfo.orgId, orgA.id),
    });
    expect(rowA!.supportPhone).toBe("+1 555 0300");

    // Verify orgB was NOT changed
    const rowB = await db.query.orgContactInfo.findFirst({
      where: eq(orgContactInfo.orgId, orgB.id),
    });
    expect(rowB!.supportPhone).toBe("+1 555 0200");
    expect(rowB!.supportEmail).toBe("orgB@example.com");
  });

  it("updateOrgContactInfo rejects non-admin member", async () => {
    const { org } = await createOrgAndAdmin();
    const member = await createMember(org.id);

    mockGetRequestContext.mockResolvedValue({
      user: member,
      isPlatformAdmin: false,
      platformAdmin: null,
      org: null,
      membership: null,
    });

    await expect(
      updateOrgContactInfo({
        supportPhone: "+1 555 0100",
      }),
    ).rejects.toThrow("Insufficient organization role");
  });

  it("updateOrgContactInfo handles empty strings as null", async () => {
    const { org, admin } = await createOrgAndAdmin();

    mockGetRequestContext.mockResolvedValue({
      user: admin,
      isPlatformAdmin: false,
      platformAdmin: null,
      org: null,
      membership: null,
    });

    const result = await updateOrgContactInfo({
      supportPhone: "",
      supportEmail: "",
      supportUrl: "",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.contactInfo.supportPhone).toBeNull();
    expect(result.contactInfo.supportEmail).toBeNull();
    expect(result.contactInfo.supportUrl).toBeNull();
  });
});
