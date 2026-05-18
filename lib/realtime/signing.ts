import crypto from "crypto";

const DEFAULT_TOLERANCE_SECONDS = 300;

export function getRealtimeSecret() {
  return (
    process.env.REALTIME_BROADCAST_SECRET || process.env.WORKER_API_KEY || ""
  );
}

export function signRealtimePayload(
  body: string,
  timestamp: string,
  secret = getRealtimeSecret(),
) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

export function verifyRealtimeSignature({
  body,
  timestamp,
  signature,
  secret = getRealtimeSecret(),
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
}: {
  body: string;
  timestamp: string | null;
  signature: string | null;
  secret?: string;
  toleranceSeconds?: number;
}) {
  if (!secret || !timestamp || !signature) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - timestampNumber);
  if (ageSeconds > toleranceSeconds) return false;

  const expected = signRealtimePayload(body, timestamp, secret);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");

  return (
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
}
