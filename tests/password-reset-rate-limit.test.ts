import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/password-reset/request/route";
import { redis } from "@/lib/redis";
import { db } from "@/db";
import { users, emailOutbox } from "@/db/schema";
import { eq } from "drizzle-orm";

const run = process.env.DATABASE_URL ? describe : describe.skip;

async function makeRequest(email: string, ip: string = "127.0.0.1") {
  const req = new Request("http://localhost:3000/api/password-reset/request", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email }),
  });
  return POST(req as any);
}

run("Password reset rate limiting", () => {
  const testEmail = "rate-limit-test@example.com";
  const testIp = "192.0.2.1";

  beforeEach(async () => {
    if (!process.env.DATABASE_URL) return;

    // Clean up rate limit keys
    await redis.del(`rate_limit:reset:email:${testEmail}:900`);
    await redis.del(`rate_limit:reset:ip:${testIp}:900`);
    await redis.del(`rate_limit:reset:ip:127.0.0.1:900`);

    // Clean up outbox
    await db.delete(emailOutbox).where(eq(emailOutbox.to, testEmail));

    // Create a test user so token generation succeeds
    await db.insert(users).values({
      email: testEmail,
      name: "Rate Limit Test",
      status: "active",
    });
  });

  afterEach(async () => {
    if (!process.env.DATABASE_URL) return;
    await redis.del(`rate_limit:reset:email:${testEmail}:900`);
    await redis.del(`rate_limit:reset:ip:${testIp}:900`);
    await redis.del(`rate_limit:reset:ip:127.0.0.1:900`);
    await db.delete(users).where(eq(users.email, testEmail));
    await db.delete(emailOutbox).where(eq(emailOutbox.to, testEmail));
  });

  it("allows the first request normally", async () => {
    const res = await makeRequest(testEmail, testIp);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify email was queued
    const outbox = await db.query.emailOutbox.findMany({
      where: eq(emailOutbox.to, testEmail),
    });
    expect(outbox.length).toBeGreaterThanOrEqual(1);
  });

  it("returns generic success but does not send email when per-email limit exceeded", async () => {
    // Consume the email budget (3 requests)
    for (let i = 0; i < 3; i++) {
      const res = await makeRequest(testEmail, testIp);
      expect(res.status).toBe(200);
    }

    // Clear outbox to distinguish 4th request
    await db.delete(emailOutbox).where(eq(emailOutbox.to, testEmail));

    // 4th request from same email should be rate limited
    const res = await makeRequest(testEmail, testIp);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // No new email should have been queued
    const outbox = await db.query.emailOutbox.findMany({
      where: eq(emailOutbox.to, testEmail),
    });
    expect(outbox.length).toBe(0);
  });

  it("returns generic success but does not send email when per-IP limit exceeded", async () => {
    // Use different emails from same IP to hit IP limit
    const emails = Array.from({ length: 11 }, (_, i) => `ip-test-${i}@example.com`);

    // Create users for each email
    for (const email of emails) {
      await db.insert(users).values({
        email,
        name: "IP Test",
        status: "active",
      });
    }

    // Make 10 requests (the limit)
    for (let i = 0; i < 10; i++) {
      const res = await makeRequest(emails[i], testIp);
      expect(res.status).toBe(200);
    }

    // 11th request from same IP, different email
    const res = await makeRequest(emails[10], testIp);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // No email should have been queued for the 11th email
    const outbox = await db.query.emailOutbox.findMany({
      where: eq(emailOutbox.to, emails[10]),
    });
    expect(outbox.length).toBe(0);

    // Cleanup
    for (const email of emails) {
      await db.delete(users).where(eq(users.email, email));
      await db.delete(emailOutbox).where(eq(emailOutbox.to, email));
      await redis.del(`rate_limit:reset:email:${email}:900`);
    }
  }, 15000);
});
