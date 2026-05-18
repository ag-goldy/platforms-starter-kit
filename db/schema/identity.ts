import {
  pgTable,
  uuid,
  text,
  timestamp,
  check,
  customType,
  bigint,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./tenancy";

const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

const inet = customType<{ data: string }>({
  dataType() {
    return "inet";
  },
});

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const platformAdmins = pgTable(
  "platform_admins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: citext("email").unique().notNull(),
    hashedPassword: text("hashed_password"),
    totpSecretEnc: text("totp_secret_enc"),
    role: text("role").notNull(), // 'SUPER_ADMIN', 'ADMIN', 'SUPPORT'
    status: text("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return [
      check(
        "role_enum",
        sql`${table.role} IN ('SUPER_ADMIN', 'ADMIN', 'SUPPORT')`,
      ),
    ];
  },
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: citext("email").unique().notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    hashedPassword: text("hashed_password"),
    totpSecretEnc: text("totp_secret_enc"),
    status: text("status").notNull().default("active"), // 'active', 'locked', 'deleted'
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    lastLoginIp: inet("last_login_ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return [
      check(
        "status_enum",
        sql`${table.status} IN ('active', 'locked', 'deleted')`,
      ),
    ];
  },
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    platformAdminId: uuid("platform_admin_id").references(
      () => platformAdmins.id,
      { onDelete: "cascade" },
    ),
    kind: text("kind"), // 'tenant', 'platform', 'impersonation'
    impersonatingOrgId: uuid("impersonating_org_id").references(
      () => organizations.id,
    ),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    deviceHash: text("device_hash"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => {
    return [
      check(
        "kind_enum",
        sql`${table.kind} IN ('tenant', 'platform', 'impersonation')`,
      ),
      check(
        "exclusive_user",
        sql`(${table.userId} IS NOT NULL AND ${table.platformAdminId} IS NULL) OR (${table.userId} IS NULL AND ${table.platformAdminId} IS NOT NULL)`,
      ),
    ];
  },
);

export const passkeys = pgTable("passkeys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  platformAdminId: uuid("platform_admin_id").references(
    () => platformAdmins.id,
    { onDelete: "cascade" },
  ),
  credentialId: text("credential_id").unique().notNull(),
  publicKey: bytea("public_key").notNull(),
  signCount: bigint("sign_count", { mode: "number" }).default(0),
  transports: text("transports").array(),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const magicLinks = pgTable(
  "magic_links",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    platformAdminId: uuid("platform_admin_id").references(
      () => platformAdmins.id,
      { onDelete: "cascade" },
    ),
    purpose: text("purpose").notNull(), // 'login', 'email_verify', 'reset_password', 'invite'
    payloadJson: jsonb("payload_json"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (table) => {
    return [
      check(
        "purpose_enum",
        sql`${table.purpose} IN ('login', 'email_verify', 'reset_password', 'invite')`,
      ),
    ];
  },
);
