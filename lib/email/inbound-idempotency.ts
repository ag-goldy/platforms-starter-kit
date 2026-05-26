import { db } from "@/db";
import { processedInboundEmails } from "@/db/schema";
import { eq } from "drizzle-orm";

export type InboundEmailSource = "graph" | "generic_inbound";

export async function claimInboundEmailProcessing(params: {
  internetMessageId?: string | null;
  source: InboundEmailSource;
}): Promise<{ claimed: boolean; internetMessageId?: string }> {
  const internetMessageId = params.internetMessageId?.trim();

  if (!internetMessageId) {
    console.warn(
      "[Inbound Idempotency] No Message-ID, processing without dedup",
      { source: params.source },
    );
    return { claimed: true };
  }

  const [claimed] = await db
    .insert(processedInboundEmails)
    .values({
      internetMessageId,
      source: params.source,
    })
    .onConflictDoNothing({
      target: processedInboundEmails.internetMessageId,
    })
    .returning({
      internetMessageId: processedInboundEmails.internetMessageId,
    });

  if (!claimed) {
    console.log("[Inbound Idempotency] Already processed", {
      messageId: internetMessageId,
      source: params.source,
    });
    return { claimed: false, internetMessageId };
  }

  console.log("[Inbound Idempotency] Claimed inbound email", {
    messageId: internetMessageId,
    source: params.source,
  });

  return { claimed: true, internetMessageId };
}

export async function recordInboundEmailProcessingResult(params: {
  internetMessageId?: string | null;
  ticketId?: string | null;
  orgId?: string | null;
}): Promise<void> {
  const internetMessageId = params.internetMessageId?.trim();

  if (!internetMessageId) {
    return;
  }

  try {
    await db
      .update(processedInboundEmails)
      .set({
        ticketId: params.ticketId ?? null,
        orgId: params.orgId ?? null,
      })
      .where(eq(processedInboundEmails.internetMessageId, internetMessageId));

    console.log("[Inbound Idempotency] Recorded processing result", {
      messageId: internetMessageId,
      ticketId: params.ticketId ?? null,
      orgId: params.orgId ?? null,
    });
  } catch (error) {
    console.warn("[Inbound Idempotency] Failed to record processing result", {
      messageId: internetMessageId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
