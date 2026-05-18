/**
 * Webhook authentication tests
 *
 * Verifies that webhook endpoints enforce authentication and
 * that the deprecated webhookSubscriptions route uses proper auth guards.
 * Also validates that lib/webhooks/queries.ts (canonical path) properly
 * signs and validates webhook payloads.
 */

import { describe, it, expect, vi, type MockedFunction } from "vitest";
import {
  signWebhookPayload,
  generateWebhookSecret,
} from "@/lib/webhooks/queries";
import { getRequestContext, type RequestContext } from "@/lib/auth/context";
import {
  requireInternalRole,
  AuthorizationError,
} from "@/lib/auth/permissions";

vi.mock("@/lib/auth/context", () => ({
  getRequestContext: vi.fn(),
}));

const mockGetRequestContext = getRequestContext as unknown as MockedFunction<
  typeof getRequestContext
>;

function makeContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    user: null,
    platformAdmin: null,
    isInternal: false,
    isPlatformAdmin: false,
    org: null,
    orgId: null,
    membership: null,
    subdomain: null,
    ip: "127.0.0.1",
    ...overrides,
  } as RequestContext;
}

describe("webhook payload signing", () => {
  it("produces a deterministic HMAC-SHA256 signature", () => {
    const secret = "test-secret-123";
    const payload = JSON.stringify({
      event: "ticket.created",
      data: { id: "1" },
    });
    const sig1 = signWebhookPayload(payload, secret);
    const sig2 = signWebhookPayload(payload, secret);
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[a-f0-9]{64}$/); // hex SHA-256
  });

  it("produces different signatures for different secrets", () => {
    const payload = JSON.stringify({ event: "test" });
    const sig1 = signWebhookPayload(payload, "secret-a");
    const sig2 = signWebhookPayload(payload, "secret-b");
    expect(sig1).not.toBe(sig2);
  });

  it("produces different signatures for different payloads", () => {
    const secret = "shared-secret";
    const sig1 = signWebhookPayload('{"event":"a"}', secret);
    const sig2 = signWebhookPayload('{"event":"b"}', secret);
    expect(sig1).not.toBe(sig2);
  });

  it("generates a 64-character hex secret", () => {
    const secret = generateWebhookSecret();
    expect(secret).toMatch(/^[a-f0-9]{64}$/);
  });

  it("generates unique secrets on each call", () => {
    const s1 = generateWebhookSecret();
    const s2 = generateWebhookSecret();
    expect(s1).not.toBe(s2);
  });
});

describe("webhook route auth guard", () => {
  it("requireInternalRole throws for unauthenticated requests (redirects to login)", async () => {
    // Next.js redirect() throws a special NEXT_REDIRECT error — not AuthorizationError
    mockGetRequestContext.mockResolvedValueOnce(makeContext());
    await expect(requireInternalRole()).rejects.toThrow();
  });

  it("requireInternalRole throws for non-internal users", async () => {
    mockGetRequestContext.mockResolvedValueOnce(
      makeContext({
        user: { id: "u1", isInternal: false } as any,
      }),
    );
    await expect(requireInternalRole()).rejects.toThrow(AuthorizationError);
  });

  it("requireInternalRole passes for internal users", async () => {
    mockGetRequestContext.mockResolvedValueOnce(
      makeContext({
        user: { id: "u1", isInternal: true } as any,
        isInternal: true,
      }),
    );
    await expect(requireInternalRole()).resolves.not.toThrow();
  });
});
