import { describe, it, expect, beforeEach, vi } from "vitest";
import { generateTicketKey } from "@/lib/tickets/keys";
import { db } from "@/db";

// Mock the database
vi.mock("@/db", () => ({
  db: {
    query: {
      organizations: {
        findFirst: vi.fn(),
      },
      tickets: {
        findFirst: vi.fn(),
      },
    },
  },
}));

describe("generateTicketKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate a public key without orgId", async () => {
    vi.mocked(db.query.tickets.findFirst).mockResolvedValue(undefined);

    const key = await generateTicketKey();

    expect(key).toMatch(/^PUBLIC\(INC\)\d{6}$/);
  });

  it("should generate an org-scoped key with customerId prefix", async () => {
    vi.mocked(db.query.organizations.findFirst).mockResolvedValue({
      customerId: "acme-corp",
      slug: "acme",
    } as unknown as NonNullable<ReturnType<typeof db.query.organizations.findFirst>>);
    vi.mocked(db.query.tickets.findFirst).mockResolvedValue(undefined);

    const key = await generateTicketKey("org-123");

    expect(key).toMatch(/^ACMECORP\(INC\)\d{6}$/);
  });

  it("should generate an org-scoped key with slug fallback", async () => {
    vi.mocked(db.query.organizations.findFirst).mockResolvedValue({
      customerId: null,
      slug: "globex",
    } as unknown as NonNullable<ReturnType<typeof db.query.organizations.findFirst>>);
    vi.mocked(db.query.tickets.findFirst).mockResolvedValue(undefined);

    const key = await generateTicketKey("org-456");

    expect(key).toMatch(/^GLOBEX\(INC\)\d{6}$/);
  });

  it("should handle collision detection with multiple existing keys", async () => {
    vi.mocked(db.query.tickets.findFirst)
      .mockResolvedValueOnce({ key: "PUBLIC(INC)000001" } as unknown as NonNullable<ReturnType<typeof db.query.tickets.findFirst>>)
      .mockResolvedValueOnce({ key: "PUBLIC(INC)000002" } as unknown as NonNullable<ReturnType<typeof db.query.tickets.findFirst>>)
      .mockResolvedValueOnce(undefined);

    const key = await generateTicketKey();

    expect(key).toMatch(/^PUBLIC\(INC\)\d{6}$/);
    expect(key).not.toBe("PUBLIC(INC)000001");
    expect(key).not.toBe("PUBLIC(INC)000002");
  });
});
