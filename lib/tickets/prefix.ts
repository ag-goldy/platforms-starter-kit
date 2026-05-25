export const RESERVED_PREFIXES = [
  "SUP",
  "PUBLIC",
  "ADMIN",
  "SYSTEM",
  "API",
  "TEST",
  "INTERNAL",
  "ROOT",
  "NULL",
  "NONE",
] as const;

const RESERVED_PREFIX_SET = new Set<string>(RESERVED_PREFIXES);

export function validatePrefix(prefix: string): {
  valid: boolean;
  reason?: string;
} {
  if (!prefix) {
    return { valid: false, reason: "Prefix is required" };
  }

  if (!/^[A-Z]+$/.test(prefix)) {
    return {
      valid: false,
      reason: "Prefix must contain only uppercase letters",
    };
  }

  if (prefix.length < 2 || prefix.length > 6) {
    return {
      valid: false,
      reason: "Prefix must be between 2 and 6 letters",
    };
  }

  if (RESERVED_PREFIX_SET.has(prefix)) {
    return { valid: false, reason: "Prefix is reserved" };
  }

  return { valid: true };
}

export function generateAutoPrefix(slug: string): string {
  const prefix = slug.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);

  if (prefix.length < 2) {
    throw new Error("Organization slug must contain at least 2 letters");
  }

  const validation = validatePrefix(prefix);
  if (!validation.valid) {
    throw new Error(validation.reason || "Invalid ticket prefix");
  }

  return prefix;
}

export function resolvePrefix(org: {
  id: string;
  slug: string;
  ticketPrefix: string | null;
}): string {
  if (org.ticketPrefix) {
    const validation = validatePrefix(org.ticketPrefix);
    if (!validation.valid) {
      throw new Error(validation.reason || "Invalid ticket prefix");
    }
    return org.ticketPrefix;
  }

  const overrideKey = `TICKET_PREFIX_OVERRIDE_${org.slug
    .toUpperCase()
    .replace(/[^A-Z]/g, "")}`;
  const override = process.env[overrideKey];

  if (override) {
    const validation = validatePrefix(override);
    if (validation.valid) {
      return override;
    }

    console.warn("[Ticket Prefix] Ignoring invalid env override", {
      orgId: org.id,
      slug: org.slug,
      overrideKey,
      reason: validation.reason,
    });
  }

  return generateAutoPrefix(org.slug);
}
