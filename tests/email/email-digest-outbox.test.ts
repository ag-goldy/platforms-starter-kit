import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendWithOutbox } from "@/lib/email/outbox";

vi.mock("@/lib/email", () => ({
  emailService: {
    send: vi.fn(async () => ({})),
  },
}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("email digest outbox tracking", () => {
  const testEmail = "digest-outbox@example.com";

  afterEach(async () => {
    if (!process.env.DATABASE_URL) return;
    await db.delete(emailOutbox).where(eq(emailOutbox.to, testEmail));
  });

  it("creates a SENT email_outbox row for an email_digest send", async () => {
    const result = await sendWithOutbox({
      type: "email_digest",
      to: testEmail,
      subject: "Atlas digest: 1 unread notification",
      html: "<p>Hello there,</p><p>Here are your unread Atlas notifications.</p><ul><li><strong>Digest notification</strong><br/>This notification should be included in the digest.</li></ul>",
      text: "Digest notification\nThis notification should be included in the digest.",
    });

    expect(result.status).toBe("SENT");

    const rows = await db.query.emailOutbox.findMany({
      where: eq(emailOutbox.to, testEmail),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(result.outboxId);
    expect(rows[0].type).toBe("email_digest");
    expect(rows[0].subject).toBe("Atlas digest: 1 unread notification");
    expect(rows[0].status).toBe("SENT");
    expect(rows[0].sentAt).toBeInstanceOf(Date);
  });
});
