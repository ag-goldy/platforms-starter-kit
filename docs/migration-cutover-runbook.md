# Phase 9 Migration and Cutover Runbook

## Prerequisites

- Source database: legacy Atlas schema (`db/schema.ts`).
- Target database: new modular schema (`db/schema/*.ts`) applied via Drizzle migrations.
- Environment variable `DATABASE_URL` points to source during normal ops.
- A Neon branch (or separate Postgres) exists with the new schema and is reachable.

## Migration Order

Run these sequentially. Each step is idempotent (`ON CONFLICT DO NOTHING`).

| Step | Domain | Source → Target |
|------|--------|-----------------|
| 1 | Orgs | `organizations` → `organizations` + `org_settings` |
| 2 | Identity | `users` → `users` |
| 3 | Identity | `platform_admins` → `platform_admins` |
| 4 | Membership | `memberships` → `memberships` (role mapped) |
| 5 | Tickets | `tickets` → `tickets` (number + key generated per org) |
| 6 | Tickets | `ticket_comments` → `ticket_messages` |
| 7 | Tickets | Synthesize `ticket_events` from messages + audit |
| 8 | Tickets | `ticket_assets`, `ticket_tags`, `ticket_tag_assignments` |
| 9 | Tickets | `ticket_merges` + `ticket_dependencies` → `ticket_links` |
| 10 | KB | `kb_categories`, `kb_articles`, `kb_article_versions` → `kb_revisions`, `kb_article_feedback` → `kb_feedback` |
| 11 | Assets | `assets` → `assets` |
| 12 | Audit | `audit_logs` → `audit_log` (actor_kind + resource derived) |
| 13 | Audit | `ai_audit_log` → `ai_audit` (hashes generated) |
| 14 | Automation | `automation_rules` → `automations`, `automation_runs` → `automation_runs` |

## Key Transformations

- **Organization status**: derived from `is_active` + `disabled_at` + `deleted_at`.
- **Membership roles**: `ADMIN`→`admin`, `AGENT`→`agent`, `READONLY`→`analyst`, `CUSTOMER_ADMIN`/`REQUESTER`/`VIEWER`→`end_user`.
- **Ticket statuses**: `NEW`→`new`, `OPEN`/`IN_PROGRESS`→`open`, `WAITING_ON_CUSTOMER`→`pending`, `RESOLVED`→`resolved`, `CLOSED`→`closed`, `MERGED`→`merged`.
- **Ticket numbers**: generated sequentially per org on target.
- **Ticket keys**: `org_id::text || '-' || number::text`.
- **Ticket messages**: `is_internal` → `visibility`, platform admin authors become `author_kind='system'`.
- **Audit log**: `action` enum split into `resource` type; `actor_kind` derived from `user_id`/`platform_admin_id`.
- **AI audit**: `user_query`/`ai_response` hashed into `request_hash`/`response_hash`.

## Commands

### Dry-run (counts only)

```bash
pnpm migration:dry-run -- --source "$SOURCE_DATABASE_URL" --target "$TARGET_DATABASE_URL"
```

### Full migration

```bash
pnpm migration:run -- --source "$SOURCE_DATABASE_URL" --target "$TARGET_DATABASE_URL"
```

### Incremental migration (since last checkpoint)

```bash
pnpm migration:run -- --source "$SOURCE_DATABASE_URL" --target "$TARGET_DATABASE_URL" --since "2025-05-10T00:00:00Z"
```

### Validation

```bash
pnpm migration:validate -- --source "$SOURCE_DATABASE_URL" --target "$TARGET_DATABASE_URL"
```

## Cutover Procedure

1. **Announce maintenance window** (suggested: Sunday 02:00 SGT, 30-minute window).
2. **Freeze writes** in the source system (return 503 on POST/PATCH/DELETE).
3. **Run final incremental sync**:
   ```bash
   pnpm migration:run -- --source "$SOURCE_DATABASE_URL" --target "$TARGET_DATABASE_URL" --since "<last-sync-timestamp>"
   ```
4. **Run validation** and resolve all errors:
   ```bash
   pnpm migration:validate -- --source "$SOURCE_DATABASE_URL" --target "$TARGET_DATABASE_URL"
   ```
5. **Spot-check**:
   - 3–5 sample tickets load correctly in the new UI.
   - Ticket message thread renders.
   - KB article view works.
   - Asset detail shows ticket history.
6. **Swap `DATABASE_URL`** to the target database.
7. **Smoke tests** (automated or manual):
   - Login (platform + tenant)
   - Create ticket
   - Reply to ticket
   - View KB article
   - Run a search
8. **Unfreeze writes** once smoke tests pass.
9. **Monitor error rates** for 4 hours post-cutover.

## Rollback

1. Re-freeze writes.
2. Restore previous `DATABASE_URL` to the source database.
3. Restart the app.
4. Re-run smoke tests against the source database.
5. Document the failure reason before retrying cutover.

## Post-Cutover

- Keep the source database read-only for 30 days.
- Run `db:seed` on the new system only if this is a fresh instance (not for cutover).
- Schedule a follow-up to regenerate HTML from migrated markdown messages if needed.
- Assign `owner` roles manually for each tenant (legacy had no `owner` role; first `admin` should be promoted).
