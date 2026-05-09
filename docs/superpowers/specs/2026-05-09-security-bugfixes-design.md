# Sub-project A: Security & Bug Fixes

**Date:** 2026-05-09  
**Status:** Approved  
**Scope:** Atlas Helpdesk — security hardening and bug fixes across auth, queue, schema, and cron layers

---

## Overview

Eight confirmed bugs and security issues across four subsystems. Fixed in subsystem order (auth → queue → schema → cron/AI) to minimize file-touching overlap and keep rollback clean per layer.

---

## Section 1: Auth Layer

### Fix 1 — `requireInternalRole()` role enforcement

**File:** `lib/auth/permissions.ts:38-45`

**Problem:** The `allowedRoles` parameter is accepted but never checked. All internal users pass regardless of their role.

**Fix:** Read `user.role` from the `platform_admins` record (already on `ctx.user` from `getRequestContext()`). If `allowedRoles` is provided and non-empty, throw `AuthorizationError` if `user.role` is not in the list.

```ts
if (allowedRoles && allowedRoles.length > 0) {
  if (!allowedRoles.includes(user.role as InternalRole)) {
    throw new AuthorizationError(`Role '${user.role}' is not authorized for this resource`);
  }
}
```

No schema changes required. Role field already exists on `platform_admins`.

### Fix 2 — Token plaintext audit

**Files:** `lib/tickets/`, `app/api/tickets/[id]/`, `app/ticket/[token]/`

**Problem:** Raw tokens may appear in function return values, API responses, or log statements. Only `tokenHash` (bcrypt) should persist server-side.

**Fix:**
- Audit all callers of token creation/verification functions
- Remove raw token from any server-side return value, response body, or log call
- Raw token is only allowed in the magic-link URL sent via email — never stored or logged server-side
- Token in URL/email is intentional and correct; token in DB column is the bug

---

## Section 2: Queue Layer

### Fix 3 — Remove legacy PostgreSQL queue

**Files:** `lib/jobs/queue.ts` (delete), `lib/jobs/worker.ts` (delete), `lib/jobs/index.ts` (simplify)

**Problem:** Two job queue backends (`queue.ts` legacy PostgreSQL, `redis-queue.ts` BullMQ) coexist behind an env var toggle. Legacy is deprecated but still maintained.

**Fix:**
- Delete `lib/jobs/queue.ts` and the legacy `lib/jobs/worker.ts`
- Remove `JOB_QUEUE_BACKEND` toggle logic from `lib/jobs/index.ts`
- Export BullMQ functions directly from `lib/jobs/index.ts`
- Keep `enqueueJob()` unified wrapper pointing to BullMQ only
- Fail fast at startup if `REDIS_URL` is missing (log fatal error, do not start)

### Fix 4 — Verify BullMQ worker registration

**Files:** `lib/jobs/redis-worker.ts`, `app/api/jobs/health/route.ts` (new)

**Problem:** BullMQ workers exist but no mechanism confirms all four queues (`email`, `export`, `sync`, `maintenance`) have registered processors at runtime.

**Fix:**
- Add startup assertion in `redis-worker.ts` confirming all queue processors are registered
- Add `/api/jobs/health` GET endpoint returning queue depths and worker status per queue
- Health endpoint is cron-accessible (protected by `CRON_SECRET`) for uptime monitoring

---

## Section 3: Schema & Types

### Fix 5 — Consolidate duplicate type exports

**Files:** `db/schema-extensions.ts`, all files importing from `schema-extensions.ts`

**Problem:** `ticketSubtasks`, `ticketDependencies` and their TypeScript types are defined in `db/schema.ts` and re-exported + re-declared in `db/schema-extensions.ts`, causing type conflicts and confusion.

**Fix:**
- Remove the re-exports and duplicate type declarations from `db/schema-extensions.ts`
- Update all imports across the codebase to source these from `db/schema.ts` only
- No migration required — TypeScript-only change

### Fix 6 — Migration file naming collisions

**Files:** `drizzle/` migration files, `drizzle/meta/_journal.json`

**Problem:** Files with prefixes `0003`, `0004`, and `0028` have duplicates. Drizzle runs migrations in filename order — duplicates cause non-deterministic execution.

**Fix:**
- Rename collision files to unused high numbers (e.g., `0060`, `0061`, `0062`)
- Update `drizzle/meta/_journal.json` to reflect new filenames
- SQL content inside files stays identical — only filenames change
- Document the renaming in a comment inside each renamed file

---

## Section 4: Cron & AI Tenant Scoping

### Fix 7 — CRON_SECRET naming standardization

**Files:** All cron route handlers, `vercel.json`, `.env.local.template`

**Problem:** Two env var names in use: `CRON_SECRET` (graph-subscription) and `CRON_SECRET_TOKEN` (zabbix-sync). Inconsistency causes silent auth failures if the wrong var is set.

**Fix:**
- Standardize all cron routes to read `CRON_SECRET`
- Update `vercel.json` cron config header references
- Update `.env.local.template` with single correct variable name
- Search-replace `CRON_SECRET_TOKEN` → `CRON_SECRET` across entire codebase

### Fix 8 — AI customer orgId tenant guard

**File:** `app/api/ai/customer/route.ts`

**Problem:** If subdomain lookup fails or returns null, the AI endpoint falls through without a tenant boundary, potentially leaking cross-tenant data.

**Fix:**
- Add explicit early return: if `orgId` cannot be resolved from the authenticated session, return `403 Forbidden` immediately
- No AI inference runs without a confirmed, non-null `orgId`
- Log the failed resolution attempt (subdomain, userId) for security audit trail

---

## Execution Order

1. Auth (Fix 1, Fix 2) — touches `lib/auth/` and token handlers
2. Queue (Fix 3, Fix 4) — touches `lib/jobs/` only
3. Schema (Fix 5, Fix 6) — touches `db/` and imports only
4. Cron & AI (Fix 7, Fix 8) — touches cron routes and AI customer route

Each section is independent. A failure in section 2 does not block section 3.

---

## Success Criteria

- `requireInternalRole(['ADMIN'])` rejects a user with role `AGENT`
- No raw token value appears in any server log or API response body
- `JOB_QUEUE_BACKEND` env var is removed; app fails to start without `REDIS_URL`
- `/api/jobs/health` returns 200 with all four queues healthy
- `db/schema-extensions.ts` has zero re-exports of tables defined in `db/schema.ts`
- `drizzle/` has no duplicate migration number prefixes
- All cron routes use `CRON_SECRET` exclusively
- `app/api/ai/customer/route.ts` returns 403 when orgId is null
