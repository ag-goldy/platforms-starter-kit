/**
 * Environment Variable Validation
 *
 * Validates required and optional environment variables on application startup.
 * Logs clear error messages for missing configuration.
 */

const required = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"] as const;

const optional = [
  { key: "BASETEN_API_KEY", warning: "Zeus AI will not work" },
  { key: "KV_REST_API_URL", warning: "Vercel KV unavailable" },
  { key: "BLOB_READ_WRITE_TOKEN", warning: "File uploads will be disabled" },
  { key: "MICROSOFT_GRAPH_CLIENT_ID", warning: "Email integration disabled" },
  {
    key: "MICROSOFT_GRAPH_CLIENT_SECRET",
    warning: "Email integration disabled",
  },
  { key: "MICROSOFT_GRAPH_TENANT_ID", warning: "Email integration disabled" },
  {
    key: "GRAPH_WEBHOOK_SECRET",
    warning: "Graph webhook clientState not secured",
  },
  { key: "TOKEN_PEPPER", warning: "Magic links will be less secure" },
  { key: "INBOUND_EMAIL_SECRET", warning: "Inbound email webhook not secured" },
] as const;

let validated = false;

export function validateEnv() {
  if (validated) return;
  validated = true;

  const missing: string[] = [];

  // Check required variables
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
      console.error(`❌ FATAL: Missing required env var: ${key}`);
    }
  }

  // Check optional variables
  for (const { key, warning } of optional) {
    if (!process.env[key]) {
      // Skip INBOUND_EMAIL_SECRET warning if using Microsoft Graph (different inbound mechanism)
      if (
        key === "INBOUND_EMAIL_SECRET" &&
        process.env.MICROSOFT_GRAPH_TENANT_ID
      ) {
        // Using Graph email - inbound webhooks not needed
        continue;
      }
      console.warn(`⚠️  Missing optional env var: ${key} — ${warning}`);
    }
  }

  // Check Redis configuration (REDIS_URL or TCKREDIS_REDIS_URL or KV_REST_API_URL)
  const hasRedis =
    process.env.REDIS_URL ||
    process.env.TCKREDIS_REDIS_URL ||
    process.env.KV_REST_API_URL;
  if (!hasRedis) {
    console.warn(
      "⚠️  No Redis configuration found — Caching will use in-memory fallback",
    );
  } else if (process.env.TCKREDIS_REDIS_URL && !process.env.REDIS_URL) {
    console.log("✅ Redis configured via TCKREDIS_REDIS_URL");
  } else if (process.env.REDIS_URL) {
    console.log("✅ Redis configured via REDIS_URL");
  }

  if (missing.length > 0) {
    console.error(
      `\n🚨 ${missing.length} required environment variable(s) missing. Application may crash.\n`,
    );
  } else {
    console.log("✅ All required environment variables present");
  }
}
