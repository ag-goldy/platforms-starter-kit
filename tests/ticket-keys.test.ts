import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { generateTicketKey } from "@/lib/tickets/keys";
import {
  generateAutoPrefix,
  resolvePrefix,
  validatePrefix,
} from "@/lib/tickets/prefix";

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

describe("ticket prefix helpers", () => {
  const originalOverride = process.env.TICKET_PREFIX_OVERRIDE_ACMECORP;

  afterEach(() => {
    if (originalOverride === undefined) {
      delete process.env.TICKET_PREFIX_OVERRIDE_ACMECORP;
    } else {
      process.env.TICKET_PREFIX_OVERRIDE_ACMECORP = originalOverride;
    }
    vi.restoreAllMocks();
  });

  describe("generateAutoPrefix", () => {
    it("uses the first four letters from a slug", () => {
      expect(generateAutoPrefix("agrnetworks")).toBe("AGRN");
      expect(generateAutoPrefix("acme-corp")).toBe("ACME");
    });

    it("allows a two-letter generated prefix", () => {
      expect(generateAutoPrefix("ab1")).toBe("AB");
    });

    it("throws when fewer than two letters remain", () => {
      expect(() => generateAutoPrefix("12")).toThrow(
        "Organization slug must contain at least 2 letters",
      );
    });
  });

  describe("resolvePrefix", () => {
    it("returns org.ticketPrefix when set", () => {
      process.env.TICKET_PREFIX_OVERRIDE_ACMECORP = "OVRD";

      expect(
        resolvePrefix({
          id: "org-1",
          slug: "acme-corp",
          ticketPrefix: "ACME",
        }),
      ).toBe("ACME");
    });

    it("returns a valid env override when org.ticketPrefix is missing", () => {
      process.env.TICKET_PREFIX_OVERRIDE_ACMECORP = "OVRD";

      expect(
        resolvePrefix({
          id: "org-1",
          slug: "acme-corp",
          ticketPrefix: null,
        }),
      ).toBe("OVRD");
    });

    it("falls back to auto-generation when no stored or env prefix exists", () => {
      delete process.env.TICKET_PREFIX_OVERRIDE_ACMECORP;

      expect(
        resolvePrefix({
          id: "org-1",
          slug: "acme-corp",
          ticketPrefix: null,
        }),
      ).toBe("ACME");
    });

    it("warns and falls back to auto-generation for invalid env overrides", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      process.env.TICKET_PREFIX_OVERRIDE_ACMECORP = "SUP";

      expect(
        resolvePrefix({
          id: "org-1",
          slug: "acme-corp",
          ticketPrefix: null,
        }),
      ).toBe("ACME");
      expect(warn).toHaveBeenCalledWith(
        "[Ticket Prefix] Ignoring invalid env override",
        expect.objectContaining({
          orgId: "org-1",
          overrideKey: "TICKET_PREFIX_OVERRIDE_ACMECORP",
        }),
      );
    });
  });

  describe("validatePrefix", () => {
    it("accepts valid prefixes", () => {
      expect(validatePrefix("AGRN")).toEqual({ valid: true });
    });

    it("rejects invalid prefix lengths", () => {
      expect(validatePrefix("A").valid).toBe(false);
      expect(validatePrefix("ABCDEFG").valid).toBe(false);
    });

    it("rejects invalid characters and digit prefixes", () => {
      expect(validatePrefix("AGR-X").valid).toBe(false);
      expect(validatePrefix("1ABC").valid).toBe(false);
    });

    it("rejects reserved prefixes", () => {
      expect(validatePrefix("SUP").valid).toBe(false);
      expect(validatePrefix("PUBLIC").valid).toBe(false);
    });
  });
});

describe("generateTicketKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates a SUP key without orgId", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.mocked(db.query.tickets.findFirst).mockResolvedValue(undefined);

    const key = await generateTicketKey();

    expect(key).toBe("SUP-100000");
    expect(db.query.organizations.findFirst).not.toHaveBeenCalled();
  });

  it("generates an org-scoped key with the stored prefix", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.mocked(db.query.organizations.findFirst).mockResolvedValue({
      id: "org-123",
      slug: "acme-corp",
      ticketPrefix: "AGRN",
    } as Awaited<ReturnType<typeof db.query.organizations.findFirst>>);
    vi.mocked(db.query.tickets.findFirst).mockResolvedValue(undefined);

    const key = await generateTicketKey("org-123");

    expect(key).toBe("AGRN-550000");
  });

  it("retries when a generated key already exists", async () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2 / 900_000);
    vi.mocked(db.query.tickets.findFirst)
      .mockResolvedValueOnce({
        id: "ticket-1",
        key: "SUP-100000",
      } as Awaited<ReturnType<typeof db.query.tickets.findFirst>>)
      .mockResolvedValueOnce(undefined);

    const key = await generateTicketKey(null);

    expect(key).toBe("SUP-100001");
    expect(db.query.tickets.findFirst).toHaveBeenCalledTimes(2);
  });
});
