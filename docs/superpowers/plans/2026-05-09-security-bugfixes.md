# Security & Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 confirmed security and reliability bugs across auth, queue, schema, and cron/AI layers.

**Architecture:** Four independent subsystems fixed in order — each section can be rolled back independently. No new dependencies introduced; all fixes operate on existing code and schema.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, BullMQ, TypeScript, Vitest

---

## File Map

| Action | File | Why |
|--------|------|-----|
| Modify | `lib/auth/permissions.ts` | Fix `requireInternalRole` role check (lines 38-45) |
| Modify | `app/api/ai/customer/route.ts` | Harden orgId validation + 403 on null |
| Delete | `lib/jobs/queue.ts` | Remove legacy PostgreSQL queue |
| Delete | `lib/jobs/worker.ts` | Remove legacy PostgreSQL worker |
| Modify | `lib/jobs/index.ts` | Remove toggle logic, export BullMQ directly |
| Create | `app/api/jobs/health/route.ts` | Queue health endpoint |
| Modify | `db/schema-extensions.ts` | Remove duplicate type re-exports |
| Modify | `drizzle/meta/_journal.json` | Register 6 untracked migration files |
| Modify | `app/api/cron/zabbix-sync/route.ts` | Remove stale CRON_SECRET_TOKEN comment lines |
| Create | `tests/unit/auth/permissions.test.ts` | Tests for requireInternalRole |
| Create | `tests/unit/api/jobs-health.test.ts` | Tests for health endpoint |

---

## Task 1: Fix `requireInternalRole()` — enforce roles via `users.role`

**Files:**
- Modify: `lib/auth/permissions.ts:38-45`
- Create: `tests/unit/auth/permissions.test.ts`

The `users` table has a `role` column with values `'ADMIN' | 'AGENT' | 'READONLY' | 'CUSTOMER_ADMIN' | 'REQUESTER' | 'VIEWER'`. Internal users have `isInternal = true` and will have role `ADMIN`, `AGENT`, or `READONLY`. Platform admins (`ctx.isPlatformAdmin`) should always pass as `ADMIN`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/auth/permissions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthorizationError } from '@/lib/auth/permissions';

// We test the role-check logic directly since getRequestContext is hard to mock end-to-end.
// Extract the role check into a pure helper so it can be unit tested.
describe('checkInternalRole', () => {
  it('allows ADMIN when ADMIN is required', () => {
    expect(() => checkInternalRole('ADMIN', ['ADMIN'])).not.toThrow();
  });

  it('allows AGENT when AGENT is in allowedRoles', () => {
    expect(() => checkInternalRole('AGENT', ['AGENT', 'ADMIN'])).not.toThrow();
  });

  it('throws when role is not in allowedRoles', () => {
    expect(() => checkInternalRole('AGENT', ['ADMIN'])).toThrow(AuthorizationError);
  });

  it('allows any role when allowedRoles is empty', () => {
    expect(() => checkInternalRole('READONLY', [])).not.toThrow();
  });

  it('allows any role when allowedRoles is undefined', () => {
    expect(() => checkInternalRole('AGENT', undefined)).not.toThrow();
  });

  it('throws for customer roles even if somehow passed', () => {
    expect(() => checkInternalRole('REQUESTER', ['ADMIN', 'AGENT'])).toThrow(AuthorizationError);
  });
});

// Import the helper after writing it in step 3
import { checkInternalRole } from '@/lib/auth/permissions';
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/unit/auth/permissions.test.ts
```

Expected: FAIL — `checkInternalRole` is not exported.

- [ ] **Step 3: Add `checkInternalRole` export and fix `requireInternalRole`**

In `lib/auth/permissions.ts`, replace lines 38-45 with:

```typescript
// Pure helper — exported for unit testing
export function checkInternalRole(userRole: string, allowedRoles?: string[]): void {
  if (!allowedRoles || allowedRoles.length === 0) return;
  if (!allowedRoles.includes(userRole)) {
    throw new AuthorizationError(
      `Role '${userRole}' is not authorized. Required: ${allowedRoles.join(', ')}`
    );
  }
}
```

Then update `requireInternalRole` to call it:

```typescript
export async function requireInternalRole(allowedRoles?: InternalRole[]) {
  const ctx = await getRequestContext();
  const user = ctx.user;

  if (!user) {
    redirect('/api/auth/signout?callbackUrl=/login?error=SessionExpired');
  }

  if (!ctx.isInternal) {
    throw new AuthorizationError('This resource is only accessible to internal users');
  }

  // Platform admins pass as ADMIN for all internal role checks
  const effectiveRole = ctx.isPlatformAdmin ? 'ADMIN' : (user.role ?? 'AGENT');
  checkInternalRole(effectiveRole, allowedRoles);

  return user;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run tests/unit/auth/permissions.test.ts
```

Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/permissions.ts tests/unit/auth/permissions.test.ts
git commit -m "fix: enforce role check in requireInternalRole via users.role"
```

---

## Task 2: Token plaintext audit — scrub raw tokens from logs and responses

**Files:**
- Scan: `lib/tickets/`, `app/api/tickets/[id]/`, `app/ticket/[token]/`

- [ ] **Step 1: Find all raw token usages**

```bash
grep -rn "plainToken\|rawToken\|token:" lib/tickets/ app/api/tickets/ app/ticket/ \
  | grep -v "tokenHash\|token_hash\|node_modules\|.next"
```

Also scan for console.log with token values:

```bash
grep -rn "console\.log.*token\|console\.error.*token\|console\.warn.*token" \
  lib/tickets/ app/api/tickets/ app/ticket/ | grep -v "node_modules\|.next"
```

- [ ] **Step 2: For each raw token found — remove it**

For each result from step 1: remove the raw token from the return value, response body, or log statement. Only `tokenHash` (the bcrypt hash) should persist server-side. The raw token sent via email URL is intentional — do not remove it from the email sending code. Only remove from:
  - API response bodies (any key that holds the raw token)
  - `console.log` / `console.error` statements
  - Return values from server functions that are not the email-sending path

- [ ] **Step 3: Verify no raw token in response bodies**

```bash
grep -rn "token.*response\|response.*token\|return.*token" \
  app/api/tickets/ | grep -v "tokenHash\|token_hash\|node_modules\|.next"
```

Expected: no results referencing raw token values in responses.

- [ ] **Step 4: Commit**

```bash
git add -p  # stage only token-related changes
git commit -m "security: remove raw token values from server logs and API responses"
```

---

## Task 3: Remove legacy PostgreSQL queue

**Files:**
- Delete: `lib/jobs/queue.ts`
- Delete: `lib/jobs/worker.ts`
- Modify: `lib/jobs/index.ts`

- [ ] **Step 1: Verify nothing outside lib/jobs imports queue.ts or worker.ts**

```bash
grep -rn "from '@/lib/jobs/queue'\|from '@/lib/jobs/worker'\|from \"@/lib/jobs/queue\"\|from \"@/lib/jobs/worker\"" \
  . --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next" | grep -v "lib/jobs/"
```

Expected: zero results. If any results appear, update those imports to use `@/lib/jobs` (the index) before proceeding.

- [ ] **Step 2: Delete legacy files**

```bash
rm lib/jobs/queue.ts lib/jobs/worker.ts
```

- [ ] **Step 3: Rewrite `lib/jobs/index.ts` — remove toggle, export BullMQ directly**

Replace the entire file with:

```typescript
export type { Job, JobType } from './types';

export {
  getEmailQueue,
  getExportQueue,
  getSyncQueue,
  getMaintenanceQueue,
  enqueueEmail,
  enqueueExport,
  enqueueZabbixSync,
  enqueueMaintenance,
  getQueueStats,
  cleanOldJobs,
  closeQueues,
  QUEUE_NAMES,
  type EmailJobData,
  type ExportJobData,
  type ZabbixSyncJobData,
  type MaintenanceJobData,
} from './redis-queue';

export {
  startWorkers,
  stopWorkers,
  getWorkerStatus,
  areWorkersRunning,
} from './redis-worker';

interface EnqueueOptions {
  type: JobType;
  data: unknown;
  maxAttempts?: number;
  delay?: number;
}

export async function enqueueJob(
  options: EnqueueOptions
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  if (!process.env.REDIS_URL) {
    console.error('[Jobs] REDIS_URL is not set — cannot enqueue job');
    return { success: false, error: 'Redis not configured' };
  }

  const { enqueueEmail, enqueueExport, enqueueZabbixSync, enqueueMaintenance } = await import('./redis-queue');

  switch (options.type) {
    case 'SEND_EMAIL':
      return enqueueEmail(options.data as { to: string; subject: string; html: string });

    case 'GENERATE_EXPORT':
      return enqueueExport(options.data as { orgId: string; exportType: string; format: string; userId: string }, false);

    case 'GENERATE_ORG_EXPORT':
      return enqueueExport(options.data as { orgId: string; exportType: string; format: string; userId: string }, true);

    case 'ZABBIX_SYNC':
      return enqueueZabbixSync(options.data as { orgId: string });

    case 'AUDIT_COMPACTION':
    case 'SLA_WARNING_CHECK':
    case 'RECALCULATE_SLA':
      return enqueueMaintenance({ type: options.type, ...(options.data as object) });

    default:
      return { success: false, error: `Unknown job type: ${options.type}` };
  }
}

export async function initializeWorkers(): Promise<void> {
  const { startWorkers } = await import('./redis-worker');
  startWorkers();
}

export async function shutdownWorkers(): Promise<void> {
  const { stopWorkers } = await import('./redis-worker');
  const { closeQueues } = await import('./redis-queue');
  await stopWorkers();
  await closeQueues();
}
```

- [ ] **Step 4: Verify TypeScript builds**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors referencing `queue.ts` or `worker.ts`. Fix any type errors before continuing.

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/index.ts
git rm lib/jobs/queue.ts lib/jobs/worker.ts
git commit -m "feat: remove legacy PostgreSQL queue, BullMQ is now the only backend"
```

---

## Task 4: Add `/api/jobs/health` endpoint

**Files:**
- Create: `app/api/jobs/health/route.ts`
- Create: `tests/unit/api/jobs-health.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/api/jobs-health.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/jobs', () => ({
  getQueueStats: vi.fn().mockResolvedValue({
    email: { waiting: 0, active: 1, completed: 42, failed: 0 },
    export: { waiting: 2, active: 0, completed: 10, failed: 1 },
    sync: { waiting: 0, active: 0, completed: 5, failed: 0 },
    maintenance: { waiting: 0, active: 0, completed: 3, failed: 0 },
  }),
  getWorkerStatus: vi.fn().mockReturnValue(
    new Map([
      ['email', 'running'],
      ['export', 'running'],
      ['zabbix-sync', 'running'],
      ['maintenance', 'running'],
    ])
  ),
}));

vi.mock('@/lib/api/verify-cron', () => ({
  verifyCronRequest: vi.fn().mockResolvedValue({ valid: true }),
}));

describe('GET /api/jobs/health', () => {
  it('returns 200 with queue stats when all workers running', async () => {
    const { GET } = await import('@/app/api/jobs/health/route');
    const req = new Request('http://localhost/api/jobs/health', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? 'test-secret'}` },
    });
    process.env.CRON_SECRET = 'test-secret';

    const res = await GET(req as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.healthy).toBe(true);
    expect(body.queues.email.active).toBe(1);
    expect(body.workers.email).toBe('running');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm vitest run tests/unit/api/jobs-health.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the health route**

Create `app/api/jobs/health/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getQueueStats, getWorkerStatus } from '@/lib/jobs';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [stats, workerMap] = await Promise.all([
      getQueueStats(),
      Promise.resolve(getWorkerStatus()),
    ]);

    const workers = Object.fromEntries(workerMap);
    const allRunning = Object.values(workers).every((s) => s === 'running');

    const totalFailed = Object.values(stats).reduce((sum, q) => sum + (q.failed ?? 0), 0);
    const healthy = allRunning && totalFailed === 0;

    return NextResponse.json(
      { healthy, queues: stats, workers },
      { status: healthy ? 200 : 503 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ healthy: false, error: message }, { status: 503 });
  }
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pnpm vitest run tests/unit/api/jobs-health.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/jobs/health/route.ts tests/unit/api/jobs-health.test.ts
git commit -m "feat: add /api/jobs/health endpoint for queue and worker monitoring"
```

---

## Task 5: Consolidate schema type re-exports

**Files:**
- Modify: `db/schema-extensions.ts:309-312`

- [ ] **Step 1: Verify no files import TicketSubtask/TicketDependency from schema-extensions**

```bash
grep -rn "TicketSubtask\|TicketDependency\|NewTicketSubtask\|NewTicketDependency" \
  --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v ".next" | grep -v "schema"
```

Expected: zero results (types are not in use outside schema files).

- [ ] **Step 2: Remove duplicate type re-exports from schema-extensions.ts**

In `db/schema-extensions.ts`, delete lines 309-312:

```typescript
// DELETE these four lines:
export type TicketSubtask = typeof ticketSubtasks.$inferSelect;
export type NewTicketSubtask = typeof ticketSubtasks.$inferInsert;
export type TicketDependency = typeof ticketDependencies.$inferSelect;
export type NewTicketDependency = typeof ticketDependencies.$inferInsert;
```

Also remove the re-import lines at the top of `schema-extensions.ts` that pull `ticketSubtasks` and `ticketDependencies` from `schema.ts` if they are only used for those type exports. Verify the import is used elsewhere before removing it.

- [ ] **Step 3: Verify TypeScript builds cleanly**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add db/schema-extensions.ts
git commit -m "refactor: remove duplicate TicketSubtask/TicketDependency type exports from schema-extensions"
```

---

## Task 6: Register untracked migration files in journal

**Files:**
- Modify: `drizzle/meta/_journal.json`

Six migration files exist on disk but are not in `_journal.json` (journal ends at idx 7):
`023_add_zabbix_to_services.sql`, `024_add_asset_archive.sql`, `025_fix_asset_type_enum.sql`,
`026_custom_asset_types_statuses.sql`, `027_advanced_features.sql`, `028_performance_indexes.sql`

- [ ] **Step 1: Check which migrations Drizzle has already applied to the database**

```bash
# Run this only if you have DATABASE_URL set — it queries the Drizzle migrations table
pnpm tsx -e "
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
const rows = await sql\`SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at\`;
console.log(JSON.stringify(rows, null, 2));
" 2>/dev/null || echo "Run manually with: psql \$DATABASE_URL -c 'SELECT * FROM drizzle.__drizzle_migrations'"
```

- [ ] **Step 2: Add the 6 files to `_journal.json` after idx 7**

Open `drizzle/meta/_journal.json` and append these entries to the `entries` array after the existing idx 7 entry:

```json
{
  "idx": 8,
  "version": "7",
  "when": 1770000000000,
  "tag": "023_add_zabbix_to_services",
  "breakpoints": true
},
{
  "idx": 9,
  "version": "7",
  "when": 1770000001000,
  "tag": "024_add_asset_archive",
  "breakpoints": true
},
{
  "idx": 10,
  "version": "7",
  "when": 1770000002000,
  "tag": "025_fix_asset_type_enum",
  "breakpoints": true
},
{
  "idx": 11,
  "version": "7",
  "when": 1770000003000,
  "tag": "026_custom_asset_types_statuses",
  "breakpoints": true
},
{
  "idx": 12,
  "version": "7",
  "when": 1770000004000,
  "tag": "027_advanced_features",
  "breakpoints": true
},
{
  "idx": 13,
  "version": "7",
  "when": 1770000005000,
  "tag": "028_performance_indexes",
  "breakpoints": true
}
```

- [ ] **Step 3: Verify `drizzle generate` runs without errors**

```bash
pnpm drizzle-kit check 2>&1 || echo "check command unavailable — verify journal JSON is valid"
# At minimum verify valid JSON:
python3 -m json.tool drizzle/meta/_journal.json > /dev/null && echo "JSON valid"
```

- [ ] **Step 4: Commit**

```bash
git add drizzle/meta/_journal.json
git commit -m "fix: register 6 untracked migration files in drizzle journal (idx 8-13)"
```

---

## Task 7: Remove stale CRON_SECRET_TOKEN comments from zabbix-sync route

**Files:**
- Modify: `app/api/cron/zabbix-sync/route.ts:14-15,27`

All routes now use `CRON_SECRET`. The zabbix-sync route still contains two comment lines referencing the old `CRON_SECRET_TOKEN` pattern — remove them.

- [ ] **Step 1: Open the file and delete the stale comment lines**

In `app/api/cron/zabbix-sync/route.ts`, remove these lines:

```typescript
// NOTE: Previously used CRON_SECRET_TOKEN via query param — migrated to standard
// CRON_SECRET Bearer header for consistency and to avoid token leakage in logs.
```

And:

```typescript
// Replaces the old CRON_SECRET_TOKEN query-param pattern.
```

- [ ] **Step 2: Confirm no remaining CRON_SECRET_TOKEN references**

```bash
grep -rn "CRON_SECRET_TOKEN" . --include="*.ts" --include="*.tsx" --include="*.json" \
  | grep -v node_modules | grep -v ".next"
```

Expected: zero results.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/zabbix-sync/route.ts
git commit -m "chore: remove stale CRON_SECRET_TOKEN comment references"
```

---

## Task 8: Harden AI customer orgId — validate UUID and add schema field

**Files:**
- Modify: `app/api/ai/customer/route.ts`

Currently `orgId` is extracted directly from the raw body (line 94) before Zod validation. The membership check prevents cross-tenant access but there is no type/format validation on `orgId` itself, and no audit log entry when the guard fires.

- [ ] **Step 1: Add orgId to the Zod request schema**

In `app/api/ai/customer/route.ts`, find `requestSchema`:

```typescript
const requestSchema = z.object({
  query: z.string().min(2).max(2000),
  sessionId: z.string().optional(),
});
```

Replace with:

```typescript
const requestSchema = z.object({
  query: z.string().min(2).max(2000),
  sessionId: z.string().optional(),
  orgId: z.string().uuid('orgId must be a valid UUID'),
});
```

- [ ] **Step 2: Move orgId extraction into the schema parse — remove the early raw extraction**

Find and remove line 94:

```typescript
const { orgId } = body; // This comes from the client but MUST be verified
```

And find the existing early `if (!orgId)` return (line 96). Delete it.

Then move the schema parse to happen **before** any orgId usage. Locate the `safeParse` call (currently around line 133) and move it up to immediately after `const body = await req.json()`. Then derive `orgId` from `parsed.data.orgId`:

```typescript
const body = await req.json();
const parsed = requestSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json(
    { error: 'Invalid request', details: parsed.error.flatten() },
    { status: 400 }
  );
}

const { query, sessionId, orgId } = parsed.data;
```

- [ ] **Step 3: Add 403 with audit log when membership check fails**

Find the section after the membership query where it returns 403 on missing membership:

```typescript
if (!membership) {
  return NextResponse.json({ error: 'Access denied' }, { status: 403 });
}
```

Replace with:

```typescript
if (!membership) {
  console.warn('[AI:Customer] Access denied — no active membership', {
    userId: session.user.id,
    orgId,
    ip,
  });
  return NextResponse.json({ error: 'Access denied' }, { status: 403 });
}
```

- [ ] **Step 4: Remove the now-duplicate safeParse block further down in the function**

The original `safeParse` call around line 133 now duplicates the one moved to the top. Delete it and the error return that followed it. Ensure `query` is still sourced from `parsed.data.query`.

- [ ] **Step 5: Build check**

```bash
pnpm tsc --noEmit 2>&1 | grep "customer/route" | head -10
```

Expected: no errors on `customer/route.ts`.

- [ ] **Step 6: Commit**

```bash
git add app/api/ai/customer/route.ts
git commit -m "security: validate orgId as UUID via Zod schema in AI customer endpoint"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
pnpm vitest run
```

Expected: all tests pass.

- [ ] **TypeScript build check**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Confirm all 8 success criteria from spec**

```bash
# 1. requireInternalRole(['ADMIN']) rejects AGENT
pnpm vitest run tests/unit/auth/permissions.test.ts

# 2. No raw token in logs
grep -rn "plainToken\|rawToken" lib/tickets/ app/api/tickets/ | grep -v tokenHash | grep -v node_modules

# 3. JOB_QUEUE_BACKEND removed
grep -rn "JOB_QUEUE_BACKEND" . --include="*.ts" | grep -v node_modules | grep -v ".next"

# 4. Health endpoint exists
ls app/api/jobs/health/route.ts

# 5. No re-exports in schema-extensions for ticketSubtasks
grep -n "TicketSubtask\|TicketDependency" db/schema-extensions.ts

# 6. No duplicate migration prefixes
ls drizzle/*.sql | sed 's/_.*$//' | sort | uniq -d

# 7. No CRON_SECRET_TOKEN references
grep -rn "CRON_SECRET_TOKEN" . --include="*.ts" | grep -v node_modules

# 8. orgId validated as UUID in AI customer route
grep -n "z.string().uuid" app/api/ai/customer/route.ts
```
