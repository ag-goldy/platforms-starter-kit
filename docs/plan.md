# Atlas Helpdesk: Master Rebuild Plan

Single source of truth for the full architectural rebuild. Every decision below is locked unless flagged "DECIDE". Paste sections into Claude Code or Kimi as you build.

Carrying forward from the existing system: the platform/tenant separation principle, audit logging concept, PII guard, GDPR/PDPA framework, Zabbix integration, and the email outbox pattern. Throwing away: subdomain routing, NextAuth, dual queue mess, schema duplication, two-table session tracking, the 170+ component sprawl.

---

## Table of Contents

0. Locked decisions
1. Foundations: identity, tenancy, permissions
2. Information architecture
3. Data model
4. Workflows (every workflow, end to end)
5. UI experience and design system
6. Cybersecurity (defense in depth)
7. Accessibility (WCAG 2.2 AA)
8. Feasibility, performance, cost
9. Build sequence

---

## 0. Locked Decisions

| Area                | Decision                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------- |
| Stack               | Next.js 15 App Router, React 19, TypeScript strict, PostgreSQL 16 (Neon)                      |
| Hosting             | Vercel for web, single 2GB VPS (Hetzner CX21, Singapore region) for workers, Socket.io, Redis |
| Multi-tenancy       | Path-based: `atlas.agrnetworks.com/{slug}/...` (no more wildcard subdomains)                  |
| Auth                | Better Auth: credentials + TOTP 2FA + passkeys + magic links                                  |
| Real-time           | Socket.io on VPS, broadcast triggered from Vercel via signed HTTP API                         |
| Background jobs     | BullMQ on VPS, single queue system, no fallback path                                          |
| Email               | Resend (transactional), Microsoft Graph (tenant-bound inbound + outbound)                     |
| Files               | Vercel Blob, signed URLs only, never direct                                                   |
| Cache + queue store | Redis on VPS, localhost bound, never exposed                                                  |
| ORM                 | Drizzle, single schema directory, split by domain                                             |
| UI library          | shadcn/ui primitives + Radix, Tailwind CSS v4                                                 |
| Product scope       | Tickets, KB, customer portal, multi-tenant, asset management. No PDF generation anywhere.     |

Hard rules carried over:

- Append-only audit log with row-level HMAC signing.
- PII redaction on every AI surface.
- WCAG 2.2 AA target on every screen.
- No em dashes in product copy.
- Platform admins live in their own table, never in `users`.
- Workers never touch the database directly. Workers call back to Vercel API with `WORKER_API_KEY`.

---

## 1. Foundations

### 1.1 Platform vs tenant separation (carried forward)

Two identity tables, no mixing. Auth flow checks `platform_admins` first, then `users`. Sessions are tagged with `kind: 'platform' | 'tenant' | 'impersonation'`. Every API route asserts the correct kind. A platform admin who needs to act inside a tenant uses an explicit "impersonate" flow that is fully audited and time-limited (max 1 hour, requires reason).

### 1.2 Path-based tenancy

URL: `https://atlas.agrnetworks.com/{slug}/...`

Edge middleware does exactly four things:

1. Extract `slug` from the first path segment.
2. Resolve org via Neon edge query: `SELECT id, status FROM organizations WHERE slug = $1`. Cache in edge cache for 60s with stale-while-revalidate.
3. Reject if `status != 'active'` (suspended orgs get a static page).
4. Inject `x-org-id`, `x-org-slug` headers for downstream consumption.

The `/admin` and `/api/platform/*` routes are platform-scoped and have no slug. Anything outside `/{slug}/...`, `/admin/...`, `/api/...`, `/login`, `/signup`, `/kb-public/...` returns 404.

DECIDE later: optional vanity domains (`help.acme.com` mapped to `/{acme}`). Keep schema-ready (`organizations.custom_domain`) but don't build the cert/CNAME flow in v1.

### 1.3 Roles and permissions

Per-tenant roles:

| Role         | Scope              | Can                                                            |
| ------------ | ------------------ | -------------------------------------------------------------- |
| `owner`      | tenant             | everything including billing and deletion                      |
| `admin`      | tenant             | configure SLA, automations, KB publish, user roles, asset edit |
| `agent_lead` | tenant             | assign across teams, edit any ticket SLA, approve KB           |
| `agent`      | own team's tickets | reply, internal notes, status, time, link assets               |
| `analyst`    | tenant             | read-only across tickets/assets/KB/reports, export             |
| `end_user`   | own tickets        | create, view, comment on own tickets, view org KB              |
| `system`     | bot                | tagged in audit log; automations, AI, webhooks                 |

Platform roles (never visible to tenants): `platform_super_admin`, `platform_admin`, `platform_support`.

One permission function used everywhere:

```ts
requirePermission(action: Action, resource: Resource, ctx: AuthCtx): asserts ctx.allowed
```

`Action` and `Resource` are typed unions. Resolution order:

1. Platform super-admin: bypass with audit entry tagged `bypass_reason`.
2. Platform admin during impersonation: scoped to impersonated tenant only.
3. Tenant role from `memberships` table.
4. Resource-level checks: ownership, team assignment, watcher list, visibility level.

No more boolean role gates. Every call site names the action. Examples:

- `requirePermission('ticket.reply', ticket, ctx)`
- `requirePermission('kb.publish', article, ctx)`
- `requirePermission('asset.edit', asset, ctx)`
- `requirePermission('settings.sla.edit', org, ctx)`

### 1.4 Auth flows (Better Auth)

Better Auth handles credentials, TOTP 2FA, passkeys, magic links, email verification, password reset. Configure with Drizzle adapter pointing at `users`, `passkeys`, `magic_links`, `sessions` tables.

Sign-in priority order on the unified `/login` page:

1. **Passkey** (default if browser supports WebAuthn and user has any registered passkey on this account).
2. **Magic link** (email-only flow, link valid 10 minutes, single-use).
3. **Password + 2FA** (fallback, 2FA mandatory for `admin` and `owner` roles, optional below).

Password rules: 12+ characters, breach check via HIBP k-anonymity API on registration and password change, no composition rules (per NIST 800-63B).

Session: 30-day max age, 7-day idle timeout, sliding window. Sessions stored in DB for revocation. Cookie `__Host-atlas.sid`, HttpOnly, Secure, SameSite=Lax, no Domain attribute.

Account lockout: after 5 failed password attempts in 15 minutes, lock for 15 minutes. Bypass via passkey or magic link still allowed.

Suspicious login alerts: new IP geolocation or new device fingerprint (UA + screen + language hash) triggers an email to the user with revoke link.

---

## 2. Information Architecture

### 2.1 URL map

```
PUBLIC
/                              marketing landing
/login                         universal login
/signup                        org creation (gated by env flag)
/forgot-password
/reset-password?token=
/magic?token=
/passkey/register              in-flow passkey enrollment
/kb-public/{slug}/{article}    public KB articles, indexed by org

PLATFORM (AGR staff only, no slug)
/admin                         platform home
/admin/tenants                 list/create/suspend orgs
/admin/tenants/{id}            tenant detail (read-only by default)
/admin/tenants/{id}/impersonate
/admin/users                   platform admin user management
/admin/audit                   cross-tenant audit log search
/admin/system                  health checks, queue depth, failed jobs
/admin/billing                 plan management
/admin/feature-flags
/admin/incidents               platform-level incidents

TENANT (under /{slug})
/{slug}/                       auto-redirect by role
/{slug}/inbox                  agent inbox (default for agents)
/{slug}/portal                 customer portal (default for end_users)
/{slug}/tickets                ticket list
/{slug}/tickets/{number}       ticket detail
/{slug}/tickets/new
/{slug}/kb                     internal KB
/{slug}/kb/{slug}/{article}
/{slug}/assets
/{slug}/assets/{id}
/{slug}/reports
/{slug}/reports/csat
/{slug}/reports/sla
/{slug}/reports/agent-performance
/{slug}/settings/profile
/{slug}/settings/notifications
/{slug}/settings/security      (2FA, passkeys, sessions)
/{slug}/settings/team          (admin only)
/{slug}/settings/sla           (admin only)
/{slug}/settings/automations   (admin only)
/{slug}/settings/branding      (admin only)
/{slug}/settings/integrations  (admin only)
/{slug}/settings/data          (admin only: retention, exports, deletion)
/{slug}/disabled               static page if org suspended
```

### 2.2 Three audiences, three navigations

| Audience           | Default route    | Top-level nav                                               |
| ------------------ | ---------------- | ----------------------------------------------------------- |
| Platform admin     | `/admin`         | Tenants, Users, Audit, System, Billing, Flags, Incidents    |
| Tenant agent/admin | `/{slug}/inbox`  | Inbox, Tickets, KB, Assets, Reports, Settings               |
| End user           | `/{slug}/portal` | Home, My tickets, New ticket, Knowledge, My assets, Profile |

Portal navigation is feature-flag aware. If org disables KB, the nav item disappears. If assets are disabled, `/assets` returns 404.

### 2.3 Layout patterns

**Platform admin layout**: dense, table-first, no marketing chrome. Sidebar fixed. Black/white with single accent color. Designed to look intentionally different from tenant UI to prevent confusion during impersonation.

**Tenant agent layout**: three-pane on desktop (list + detail + context), two-pane on tablet, single-pane on mobile with stack navigation. Top bar shows org name, user, notifications, command palette trigger.

**End-user portal layout**: simpler, customer-facing. Floating top bar, mobile bottom nav, generous whitespace. Branded per org (logo, primary color, support email). Modal slot for ticket detail when clicked from list (parallel route, deep-linkable).

---

## 3. Data Model

Schema split by domain in `src/db/schema/`. Single re-export `index.ts`. No barrel exports for components, but `db/schema` is the one place barrel makes sense.

### 3.1 Files

```
src/db/schema/
  tenancy.ts        organizations, org_settings, custom_domains
  identity.ts       users, platform_admins, sessions, passkeys, magic_links
  membership.ts     memberships, teams, business_hours
  tickets.ts        tickets, ticket_messages, ticket_events, ticket_links, ticket_assets
  sla.ts            sla_policies, escalation_rules
  kb.ts             kb_categories, kb_articles, kb_revisions, kb_feedback, kb_chunks
  assets.ts         assets, asset_events, asset_attachments, sites, areas
  automation.ts     automations, automation_runs
  notifications.ts  notifications, notification_preferences, push_subscriptions
  files.ts          files, file_scans
  audit.ts          audit_log, login_events
  ai.ts             ai_configs, ai_audit, ai_memory, pii_rules, pii_detections
  webhooks.ts       webhooks, webhook_deliveries
  index.ts          re-exports + relations
```

### 3.2 Tenancy + identity (canonical definitions)

```sql
organizations (
  id              uuid pk default gen_random_uuid(),
  slug            citext unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,31}$'),
  name            text not null,
  status          text not null default 'active' check (status in ('active','suspended','deleted')),
  plan            text not null default 'trial',
  region          text not null default 'sg',
  custom_domain   citext unique,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);

org_settings (
  org_id              uuid pk references organizations on delete cascade,
  branding_json       jsonb default '{}',
  features_json       jsonb default '{}',
  business_hours_id   uuid,
  data_retention_days integer default 730,
  pii_policy          text default 'standard' check (pii_policy in ('strict','standard','off')),
  ai_data_access_json jsonb default '{}'
);

platform_admins (
  id              uuid pk default gen_random_uuid(),
  email           citext unique not null,
  hashed_password text,
  totp_secret_enc text,
  role            text not null check (role in ('SUPER_ADMIN','ADMIN','SUPPORT')),
  status          text not null default 'active',
  last_login_at   timestamptz,
  created_at      timestamptz default now()
);

users (
  id              uuid pk default gen_random_uuid(),
  email           citext unique not null,
  email_verified_at timestamptz,
  hashed_password text,
  totp_secret_enc text,
  status          text not null default 'active' check (status in ('active','locked','deleted')),
  last_login_at   timestamptz,
  last_login_ip   inet,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

memberships (
  id              uuid pk default gen_random_uuid(),
  user_id         uuid not null references users on delete cascade,
  org_id          uuid not null references organizations on delete cascade,
  role            text not null check (role in ('owner','admin','agent_lead','agent','analyst','end_user')),
  team_id         uuid references teams,
  invited_by      uuid references users,
  invited_at      timestamptz,
  accepted_at     timestamptz,
  removed_at      timestamptz,
  unique (user_id, org_id)
);

sessions (
  id              text pk,
  user_id         uuid,
  platform_admin_id uuid,
  kind            text check (kind in ('tenant','platform','impersonation')),
  impersonating_org_id uuid,
  expires_at      timestamptz not null,
  created_at      timestamptz default now(),
  last_used_at    timestamptz,
  ip              inet,
  user_agent      text,
  device_hash     text,
  revoked_at      timestamptz,
  check (
    (user_id is not null and platform_admin_id is null)
    or (user_id is null and platform_admin_id is not null)
  )
);

passkeys (
  id              uuid pk default gen_random_uuid(),
  user_id         uuid references users on delete cascade,
  platform_admin_id uuid references platform_admins on delete cascade,
  credential_id   text unique not null,
  public_key      bytea not null,
  sign_count      bigint default 0,
  transports      text[],
  label           text,
  created_at      timestamptz default now(),
  last_used_at    timestamptz
);

magic_links (
  token_hash      text pk,
  user_id         uuid references users on delete cascade,
  platform_admin_id uuid references platform_admins on delete cascade,
  purpose         text not null check (purpose in ('login','email_verify','reset_password','invite')),
  payload_json    jsonb,
  expires_at      timestamptz not null,
  consumed_at     timestamptz
);
```

Key indexes: `memberships(org_id, role)`, `memberships(user_id)`, `sessions(user_id)`, `sessions(expires_at) where revoked_at is null`.

### 3.3 Tickets (canonical)

```sql
tickets (
  id              uuid pk default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  number          integer not null,
  key             text generated always as (org_id::text || '-' || number) stored,
  title           text not null,
  description_md  text not null,
  type            text not null default 'incident' check (type in ('incident','request','problem','change')),
  status          text not null default 'new' check (status in ('new','open','pending','on_hold','resolved','closed','merged')),
  priority        text not null default 'p3' check (priority in ('p1','p2','p3','p4')),
  source          text not null check (source in ('portal','email','phone','chat','api','automation')),
  requester_id    uuid not null references users,
  assignee_id     uuid references users,
  team_id         uuid references teams,
  sla_policy_id   uuid references sla_policies,
  response_due_at      timestamptz,
  resolution_due_at    timestamptz,
  response_breached_at timestamptz,
  resolution_breached_at timestamptz,
  paused_at       timestamptz,
  paused_total_seconds integer default 0,
  merged_into_id  uuid references tickets,
  custom_fields_json jsonb default '{}',
  csat_score      smallint check (csat_score between 1 and 5),
  csat_comment    text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  resolved_at     timestamptz,
  closed_at       timestamptz,
  deleted_at      timestamptz,
  unique (org_id, number)
);

ticket_messages (
  id              uuid pk default gen_random_uuid(),
  org_id          uuid not null,
  ticket_id       uuid not null references tickets on delete cascade,
  author_id       uuid references users,
  author_kind     text check (author_kind in ('user','system','bot')),
  body_md         text not null,
  body_html_sanitized text not null,
  visibility      text not null check (visibility in ('public','internal','system')),
  channel         text check (channel in ('portal','email','api','automation')),
  email_message_id text,
  email_in_reply_to text,
  reply_to_id     uuid references ticket_messages,
  attachment_ids  uuid[] default '{}',
  created_at      timestamptz default now(),
  edited_at       timestamptz,
  deleted_at      timestamptz
);

ticket_events (
  id              uuid pk default gen_random_uuid(),
  org_id          uuid not null,
  ticket_id       uuid not null references tickets on delete cascade,
  actor_id        uuid,
  actor_kind      text,
  event_type      text not null,
  payload_json    jsonb,
  created_at      timestamptz default now()
);

ticket_links (
  parent_id       uuid not null references tickets on delete cascade,
  child_id        uuid not null references tickets on delete cascade,
  link_type       text not null check (link_type in ('related','duplicate','blocks','blocked_by','parent','child')),
  created_by      uuid,
  created_at      timestamptz default now(),
  primary key (parent_id, child_id, link_type)
);

ticket_assets   (ticket_id, asset_id, primary key (ticket_id, asset_id));
ticket_watchers (ticket_id, user_id, primary key (ticket_id, user_id));

sla_policies (
  id              uuid pk,
  org_id          uuid not null,
  name            text not null,
  matchers_json   jsonb not null,
  response_minutes integer not null,
  resolution_minutes integer not null,
  pause_on_status text[] default array['pending','on_hold'],
  business_hours_id uuid,
  active          boolean default true,
  created_at      timestamptz default now()
);

escalation_rules (
  id              uuid pk,
  org_id          uuid not null,
  sla_policy_id   uuid references sla_policies,
  trigger         text check (trigger in ('response_warn','response_breach','resolution_warn','resolution_breach','no_activity')),
  threshold_pct   smallint default 80,
  threshold_minutes integer,
  actions_json    jsonb not null,
  active          boolean default true
);
```

### 3.4 KB, assets, automations, audit, AI, files (highlights)

- **kb_articles** has `status (draft|in_review|published|archived)`, `visibility (public|authenticated|restricted)`, `restricted_team_ids uuid[]`, generated `tsvector` for FTS, plus `kb_chunks` with pgvector embeddings.
- **assets** has `parent_asset_id` for rack relationships, `monitoring_external_id` for Zabbix linkage, `custom_fields_json` for tenant flexibility.
- **automations**: trigger-condition-action JSON model; runs logged in `automation_runs` with status, duration, error.
- **audit_log**: append-only at the DB role level (revoke UPDATE/DELETE from app role); each row has `signature` (HMAC-SHA256 of canonical row form, key rotates monthly, key id stored).
- **ai_audit**: every AI call logged with `request_hash`, `response_hash`, `prompt_id` (sha256 of system prompt), redaction stats, injection score, tokens, latency. Body never stored, hashes only.
- **files**: every file has `sha256`, `scan_status (pending|clean|infected|error)`, `kind`, `attached_to_kind/id`. Direct blob URLs are never exposed; downloads go through `/api/files/{id}` which checks permissions and 302s to a short-lived signed URL.

### 3.5 Migration from current system

Current system has real production data. Migration is one-shot ETL per domain, idempotent, resumable.

Order:

1. `organizations` + `org_settings` (status mapped from `is_active` + `deleted_at`)
2. `platform_admins` (already separated, direct copy)
3. `users` (drop internal flag, add to memberships separately)
4. `memberships` (synthesize from existing internal users + customer memberships)
5. `tickets` + `ticket_messages` (rename: `comments` to `messages`)
6. `ticket_events` (synthesize from `auditLogs` where possible, otherwise empty)
7. `kb_articles` + `kb_categories` + revisions
8. `assets` + sites + areas
9. `audit_log` (rename, add HMAC signature on import)

Run on a Neon branch. Diff record counts. Smoke-test sample. Cutover during low-traffic window (Sunday 02:00 SGT). Keep legacy branch read-only for 30 days.

---

## 4. Workflows (every workflow, end to end)

Each workflow specified as: trigger, preconditions, steps, side effects, failure modes.

### 4.1 End-user creates a ticket via portal

**Trigger**: end-user clicks `New ticket` in `/{slug}/portal`.

**Steps**:

1. Form opens. Required: subject, description. Optional: type, related asset, attachments, custom fields.
2. Client validates with Zod schema. Same schema runs on server.
3. Submit posts to `POST /api/{slug}/tickets` with CSRF token. Server resolves org from path, requester from session.
4. Server applies rate limit (10 tickets per user per hour) and content heuristics.
5. Insert `tickets` row with org-scoped `number`. Insert initial `ticket_messages` (visibility=public). Insert `ticket_events` (created).
6. Run synchronous automations matching `ticket_created`. Heavy ones enqueue.
7. Resolve SLA policy via matchers, write `response_due_at`, `resolution_due_at`.
8. Enqueue notification jobs: assignee (if auto-assigned), team channel, requester confirmation email.
9. Broadcast `ticket.created` over Socket.io to org room.
10. Return `{ ticket: { number, key, status, ... } }`.

**Side effects**: audit log entry; AI categorization job enqueued if enabled; SLA timer running.

**Failures**:

- Rate limit hit: 429 with retry-after.
- Validation fails: 400 with field errors.
- DB write fails: 500, no partial state (transactional).
- Notification fails: ticket succeeds, notification retried (outbox).

### 4.2 Email-to-ticket

Two paths: Microsoft Graph webhook (preferred) or generic SMTP forward.

**Graph webhook flow**:

1. Microsoft sends notification to `POST /api/webhooks/graph`.
2. Verify validation token on first call.
3. Verify signature on subsequent calls.
4. For each notification, fetch the message via Graph API.
5. Hand off to inbound processor.

**Inbound processor**:

1. Resolve target org by recipient email (mailbox-to-org mapping in `org_settings.email_mappings`).
2. Parse `In-Reply-To` and `References` headers.
3. If matched to existing ticket message: append as reply (visibility=public, channel=email).
4. If no match: create new ticket. Requester = sender email. If sender unknown, create `users` row with `email_verified_at = null` (cannot login without verification but exists as requester).
5. Process attachments: stream to Vercel Blob, scan, attach.
6. Resolve sender risk: check SPF/DKIM/DMARC results from headers, drop or flag based on policy.
7. Run automations matching `ticket_created` or `comment_added`.
8. Broadcast.

**Failures**:

- Unknown recipient: bounce with friendly message.
- Spam: drop with audit entry, no bounce.
- Malformed: dead letter queue, alert on-call after 3 failures.

### 4.3 SLA + escalation

**SLA computation**:

- `response_due_at` = `created_at` + `policy.response_minutes` (adjusted for business hours if policy uses them).
- `resolution_due_at` = `created_at` + `policy.resolution_minutes`.
- When ticket enters a paused status (`pending`, `on_hold`), set `paused_at`. When it leaves, increment `paused_total_seconds`. Recompute `_due_at` by adding pause delta.
- First response: time of first `ticket_messages` with `author_kind='user'`, member is staff (agent or above), and `visibility='public'`.

**Warning**: cron every 5 minutes scans `tickets where status not in ('resolved','closed') and response_breached_at is null and now() > response_due_at - (response_due_at - created_at) * 0.2`. For each, insert `ticket_events.sla_warned`, run matching escalation rules.

**Breach**: same scan, condition `now() > response_due_at`. Set `response_breached_at`, run rules.

**Escalation actions**: `notify`, `reassign`, `raise_priority`, `add_tag`, `run_automation`, `webhook`. Each action is idempotent (deduped by ticket+rule+trigger).

### 4.4 Automations

Trigger types: `ticket_created`, `ticket_updated`, `comment_added`, `status_changed`, `priority_changed`, `assignee_changed`, `sla_warning`, `sla_breached`, `schedule (cron)`, `webhook_received`.

Conditions are an AND tree of typed predicates: `field_equals`, `field_contains`, `priority_is`, `status_is`, `tags_include`, `requester_is`, `subject_contains`, `description_contains`, `time_since_created_gt`, `time_since_updated_gt`, `business_hours_is`.

Actions: `set_status`, `set_priority`, `set_assignee`, `add_tags`, `remove_tags`, `add_message (internal|public)`, `send_email`, `trigger_webhook`, `add_watchers`, `run_ai (suggest_reply|categorize|summarize)`.

Execution: rules ordered by `priority` desc. Each matched rule evaluates all conditions; if all pass, all actions run. Actions are independent (one failing doesn't stop others). Each rule run logged in `automation_runs` with duration, status, error.

Editor UI: visual rule builder. Live preview against last 10 tickets. Test mode that doesn't apply actions.

### 4.5 AI workflows

Three surfaces, three audit profiles, one client.

**Surfaces**:

- Public KB chat (`/api/ai/kb-chat`): answers from public KB only. Cannot reference tickets, users, or internal data.
- Customer AI (`/api/{slug}/ai/chat`): scoped to authenticated org via session. Can reference tickets the user has permission to see, public KB, and assets if `ai_data_access.assets = true`. Internal notes excluded unless `ai_data_access.internal_notes = true` (admin opt-in only).
- Admin AI (`/api/{slug}/ai/admin`): full org access for agents/admins. Audit-logged with PII flags.

**Tenant isolation**: `orgId` always derived server-side from session and path slug. Never accepted from request body. This is the boundary; if it can be spoofed, multi-tenancy is broken.

**Defenses** (defense in depth, regex alone is insufficient):

1. Input length cap (4000 chars).
2. Heuristic injection score (regex + simple classifier): keywords like "ignore previous", "system prompt", base64-looking blocks, role-claiming phrases. Score 0-100. >70 blocks; 40-70 logs and tags response with caveat.
3. PII redaction on input (NRIC, credit cards, phone numbers, emails not in current org).
4. System prompt loaded from immutable code path, never templated from user input.
5. Output filter: if response contains org names, ticket numbers, or user emails not in the requesting user's permission scope, redact and log.
6. Rate limit per user (60 req/hour customer, 200 req/hour admin).
7. Token budget per org per day (default 100k tokens, configurable).

**AI-driven actions** (categorization, summary, suggested reply, smart assignment): these run as background jobs on the VPS, results written via signed callback to Vercel API. Suggestions are stored as drafts; agents must accept to apply.

### 4.6 KB lifecycle

`draft → in_review → published → archived`. Articles can also be `restricted` (visible only to specified teams).

**Author**: agent or admin creates draft. Markdown editor with image paste (uploads to Blob, inserts URL). Preview tab. Revisions auto-save every 30s; explicit save creates a `kb_revisions` row.

**Review**: admin or agent_lead approves. State moves to `published`. Search index updated. Embeddings recomputed (async job).

**Public articles**: extra step. `visibility=public` + admin opt-in per article. Published public articles appear at `/kb-public/{slug}/{article-slug}`. SEO meta synthesized; sitemap regenerated.

**Feedback**: each article has thumb up/down + optional comment. Thumb-down with comment can be one-click escalated to a ticket (creates ticket pre-filled with article ref + customer comment).

**AI generation**: from a resolved ticket, agent clicks "Generate KB draft". Worker calls AI with ticket thread, returns markdown draft, opens editor with content pre-filled. Author edits, saves as draft.

### 4.7 Asset management

**Manual create**: admin or agent clicks "New asset", fills form (type, vendor, model, serial, location), saves.

**Bulk import**: CSV upload with column mapping. Preview shows parsed rows with errors. Import as a job; progress bar via Socket.io. On finish, summary of created/updated/errored.

**Zabbix sync**: per-org config in `org_settings.integrations_json.zabbix`. Job runs every 15 minutes on VPS, calls Zabbix API, upserts assets matched by `monitoring_external_id`, updates `status`, `last_seen_at`. Triggers can auto-create tickets (rate limited 10/host/hour).

**Asset → ticket linkage**: when creating a ticket, asset picker shows assets matching the requester's org. Assets in tickets are tracked in `ticket_assets`. Asset detail page shows ticket history.

**Lifecycle states**: `active`, `in_repair`, `decommissioned`, `lost`. State changes logged in `asset_events`.

### 4.8 Notifications + real-time

**Channels**: in-app (DB + UI), email (Resend), web push (web-push library), webhook (per-tenant configured endpoints).

**Categories** (each toggleable per user per channel): `ticket_assigned`, `ticket_replied`, `ticket_status_changed`, `mention`, `sla_warn`, `sla_breach`, `kb_review_requested`, `digest_daily`, `digest_weekly`.

**Quiet hours**: per user, default 22:00-08:00 SGT for non-urgent (urgent: P1, SLA breach, mention).

**Real-time pipeline**:

1. Vercel server action makes a DB write.
2. After commit, Vercel calls `POST https://vps.atlas.../broadcast` with HMAC-signed payload `{ org_id, channel, event, data }`.
3. VPS Socket.io server validates HMAC, broadcasts to room `org:{org_id}:{channel}` (e.g., `org:abc:tickets`).
4. Connected clients receive event, update local state (TanStack Query invalidations).

**Presence**: Socket.io presence on ticket rooms. Shows "X is viewing", "X is typing" indicators. TTL 60s with 30s heartbeat.

**Optimistic updates**: critical paths (ticket reply, status change) apply optimistic state, broadcast confirms.

### 4.9 CSAT

When ticket transitions to `resolved`, enqueue CSAT job after configurable delay (default 1 hour, gives agent time to refine). Job sends email with rating link tokenized to the ticket. Customer rates 1-5, optional comment. Single submission allowed; second click shows "already submitted, edit?" with original rating.

Reminder: if not submitted in 3 days, send one reminder. After 7 days, mark expired.

CSAT analytics surface in `/{slug}/reports/csat`: average score, NPS-style breakdown, comments (with redaction), per-agent breakdown (with sufficient sample size guardrail).

### 4.10 Time tracking

Two modes: timer and manual entry. Timer is per agent per ticket. Only one timer can be active per agent at a time. On stop, write `time_entries` row.

Settings: per-org rate, billable default, requirement to enter notes.

Reporting: hours per agent per period, billable vs non-billable, per-customer rollup.

### 4.11 Bulk operations

Select up to 100 tickets in list view. Choose action: status, assignee, priority, tag add/remove, close, delete (admin only). Confirm dialog shows scope.

Execution: one job per bulk op record; processes in batches of 10, reports progress via Socket.io. Failures collected and shown in a summary dialog.

### 4.12 Customer team management (customer_admin)

End-user with `customer_admin` role can invite users to their org (creates magic-link invite), assign roles within their tenant, deactivate members, view activity log of their team's actions, request data exports.

Exports: GDPR/PDPA-compliant tenant data export. Job runs on VPS, writes ZIP to Blob, signed URL emailed. Includes tickets (with messages), KB feedback, assets, and a manifest with row counts.

### 4.13 Platform admin workflows

**Tenant lifecycle**: create, suspend, reactivate, schedule deletion, hard delete after 30-day grace.

**Impersonation**: super-admin clicks "Impersonate" on a tenant user. Modal requires reason (free text), duration (15/30/60 min). Creates a session with `kind='impersonation'`. UI shows persistent banner with countdown and exit button. Every action audit-logged with both actor and impersonated user.

**System health**: dashboard shows queue depth (BullMQ), failed jobs, recent error rates per route, DB pool stats, Redis health, Socket.io connection count, average request latency.

**Audit search**: cross-tenant audit log with filters (org, actor, action, resource, time range). Read-only. Export to CSV (paginated, signed URL).

**Failed jobs**: list, view payload, retry, discard. Discarded jobs retain in DB for 90 days.

---

## 5. UI Experience and Design System

### 5.1 Design system

**Tokens** (Tailwind config):

- Color: neutral scale (50-950), primary (per-tenant brand, defaulting to `#FF6600` for AGR), semantic (success, warning, danger, info).
- Spacing: 4px base scale.
- Radius: `sm 4`, `md 6`, `lg 8`, `xl 12`. Default `md`.
- Shadow: `sm`, `md`, `lg`. Use sparingly, prefer borders.
- Typography: Inter for UI, JetBrains Mono for code/keys/numbers.
- Motion: 150ms ease-out for most transitions; never animate layout-shifting properties.

**Density modes**: comfortable (default), compact (agents toggle for inbox). Compact reduces padding 25%, line-height 10%.

**Dark mode**: full parity, not an afterthought. Toggle in user settings, plus system-preference auto. Tested at every step.

**Color usage rules**:

- Status indicators use color + icon + text label (never color alone, accessibility rule).
- Priority shown as colored chip + label: P1 red, P2 orange, P3 blue, P4 gray.
- Status: new (gray), open (blue), pending (amber), on_hold (gray-amber), resolved (green), closed (neutral), merged (purple).

### 5.2 Component primitives (shadcn/ui based)

Single source per primitive in `src/components/ui/`. No duplicates.

Required primitives: Button, Input, Textarea, Select, Combobox, Checkbox, RadioGroup, Switch, Slider, DatePicker, DateRangePicker, Tabs, Dialog, Sheet, Popover, Tooltip, DropdownMenu, ContextMenu, Toast, Avatar, Badge, Card, Separator, ScrollArea, Skeleton, Spinner, Progress, Table (TanStack Table), Pagination, Breadcrumbs, CommandPalette (cmdk), EmptyState, ErrorState, LoadingState, ConfirmDialog, Banner.

Composite components: TicketRow, TicketDetail, MessageThread, MessageComposer (Markdown + slash commands), AssetCard, KbCard, FilterBar, BulkActionBar, AuditTrail, PresenceIndicator, NotificationBell.

Editor: Lexical or TipTap for rich text. Tenant-side message composer is markdown with live preview and slash commands (`/status resolved`, `/assign @user`, `/priority p1`, `/tag {tag}`, `/template {name}`).

### 5.3 Tenant-side UX (agent inbox)

The inbox is the workhorse. Must be fast and dense. Layout: three columns on >=1280px (filters, list, detail), two columns 768-1279, single 320-767.

**Filters** (left): saved views ("My open", "Unassigned", "Breached SLA today", "P1 last 24h"), plus ad-hoc filter builder. Filters persist in URL.

**List** (center): virtualized (react-virtuoso) for 10k+ tickets without lag. Each row shows number, subject, requester avatar, priority chip, status, assignee, age, SLA remaining (color-graded). Hover shows preview. Keyboard nav: `j/k` next/prev, `enter` open, `e` archive, `r` reply, `?` shortcut help.

**Detail** (right): tabs: Conversation, Activity (events timeline), Properties (status, priority, type, assignee, team, custom fields), Linked (assets, related tickets, products), Time (entries + active timer), Files. Reply composer pinned to bottom; toggle internal note vs public reply via button or `Cmd+/`.

**Speed-of-light targets**:

- Inbox initial load: <600ms TTI on a fast connection.
- Open ticket from list: <100ms perceived (optimistic, then real data).
- Send reply: <200ms perceived (optimistic).
- Status change: instant (optimistic) with server confirmation.

**Real-time**: list updates as new tickets arrive (toast "3 new tickets, click to refresh" rather than auto-shifting rows under the user's cursor). Ticket detail updates live (new messages appear, presence updates).

**Empty states**: every list has a designed empty state with clear CTA. No "No data" placeholders.

**Errors**: inline where possible; full-page error state for catastrophic failures with retry button and report-issue link.

### 5.4 End-user portal UX

Different shape, same primitives. Brand-forward, generous whitespace, minimal jargon.

**Home**: greeting, "Create new request" CTA, list of user's open tickets (max 5), recent KB articles, service status if enabled. Mobile: vertical stack.

**New ticket**: progressive disclosure. Subject and description on screen 1. Type, related asset, attachments on screen 2 (only if requested via "Add details"). Submit on screen 1 if user wants speed.

**Ticket detail**: thread view with their own messages right-aligned, agent left. Public messages only. Status badge prominent. Reply box at bottom.

**Service catalog (optional per tenant)**: card grid of request types ("Reset password", "Order new laptop", "Wifi issue"). Each opens a dynamic form per `request_types` schema.

**KB**: search-first homepage, category browse, article view. Up/down vote on each article. "Did this help? If not, create a ticket" with one-click escalation.

**My assets** (if enabled): list of assets assigned to the user. Click an asset to view details or open a ticket about it.

### 5.5 Platform admin UX

Different visual language to make impersonation/cross-tenant context unmissable. Black background, monospace numbers, dense tables, no marketing chrome.

Top bar shows: "PLATFORM ADMIN" badge, current admin email, environment indicator (PROD/STAGING). When impersonating, full-width amber banner: "Acting as {user.email} in {org.name}. Exits in 14:32 [Exit now]".

Pages:

- **Tenants**: table with slug, name, plan, status, users, tickets, last activity, created. Row actions: view, suspend, schedule delete, impersonate.
- **Tenant detail**: read-only metadata, members list, recent activity, billing info, feature flags. Action panel for suspend/delete/impersonate.
- **System**: real-time charts: queue depth, request latency p50/p95/p99, error rate per route, DB pool, Redis ops/sec, active Socket.io connections. Manual job runners for migrations, cleanup, recompute.
- **Audit**: cross-tenant filterable log. Result table; click row for detail dialog with before/after diff.
- **Failed jobs**: list with payload preview, error trace, last attempt time. Retry/discard buttons.
- **Feature flags**: per-flag table with default + per-org overrides. Edit overrides inline.

### 5.6 Information design

**Numbers**: tabular nums for all numeric columns. Right-align numbers, left-align text.

**Dates**: relative for recent ("3m ago", "yesterday"), absolute for older. Always provide title-attribute with full ISO timestamp in user's TZ.

**Times**: SGT default, user-configurable in profile. Always show TZ on hover.

**Long content**: truncate with `...` and tooltip showing full. Markdown renders with sanitized HTML; never `dangerouslySetInnerHTML` from user input directly.

### 5.7 Notification UX

Bell in top bar shows unread count (max "9+"). Click opens dropdown with last 10. Each item: avatar, sentence, timestamp, action ("View ticket"). "Mark all read", "View all" footer.

In-page toasts for own actions ("Ticket assigned to you"). Push notifications for urgent only (P1 assigned, mention, SLA breached on owned ticket). Email digests configurable.

---

## 6. Cybersecurity (defense in depth)

Eight layers. Each is necessary, none sufficient on its own.

### 6.1 Network

- Vercel handles DDoS at edge. Custom rate limits in middleware.
- VPS firewall (ufw): allow 22 (SSH, key-only), 443 (Caddy), nothing else. Redis bound to 127.0.0.1, never exposed.
- VPS sshd: PasswordAuthentication no, root login disabled, fail2ban watching auth.log.
- Caddy in front of Socket.io and worker API: TLS via Let's Encrypt, HSTS, modern cipher suite.
- Rate limit on Caddy: 100 req/min per IP for `/broadcast`, 1000 req/min for Socket.io upgrade.

### 6.2 Edge / middleware

- All responses get strict CSP: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' wss://vps.atlas.agrnetworks.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`.
- HSTS `max-age=31536000; includeSubDomains; preload`.
- X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy locking down camera/mic/geolocation.
- Cookie scope: `__Host-` prefix, no Domain, Path=/, Secure, HttpOnly, SameSite=Lax. Session cookies separate from CSRF cookies.
- CSRF: synchronizer token pattern. Token in cookie + form/header. Validated on all state-changing actions.

### 6.3 Auth

- Better Auth handles password hashing (argon2id), magic-link generation (cryptographically random, hashed at rest), passkey verification (WebAuthn via @simplewebauthn).
- 2FA TOTP with backup codes. Backup codes single-use, hashed at rest.
- Session revocation: every session in DB; revoking a session invalidates instantly. Revoke-all on password change or suspicious-login response.
- Account lockout: 5 fails / 15 min → lock 15 min. Bypass via passkey/magic-link.
- Passkey-only accounts allowed (no password).
- HIBP breach check on password set/change.
- New-device login alert email with revoke link.
- Org-scoped login: a user with memberships in multiple orgs picks one after auth; session is bound to that org until logout or org-switch.

### 6.4 Authorization

- Single `requirePermission(action, resource, ctx)` function. No ad-hoc role checks scattered across files.
- Org ID always derived from middleware-injected `x-org-id`, verified against the user's memberships in every request handler. Never accepted from request body.
- Resource-level checks: owner, watcher, team membership, visibility level.
- Read-after-write consistency: server actions return fresh data; clients don't read stale state from cache.
- Platform admins use a separate session kind (`platform`); their actions are blocked from tenant routes unless impersonating, in which case all actions are double-tagged (platform actor + impersonated user).

### 6.5 Data layer

- Postgres role for app: SELECT/INSERT on most tables; UPDATE only on tables that need it; DELETE only on a small whitelist (`sessions`, `magic_links`, `notifications`). `audit_log` has no UPDATE/DELETE for any role except a quarterly archival role.
- Row-level isolation enforced via `org_id` on every tenant-scoped query. A linter (ESLint custom rule) flags any query without an `org_id` filter.
- All AI/cron writes go through the same scoping; no escape hatches.
- Encryption at rest: Neon handles disk encryption. Sensitive columns (TOTP secrets, integration tokens) additionally encrypted at app layer with AES-256-GCM, key in env (`COLUMN_ENCRYPTION_KEY`), key rotation via re-encrypt-then-swap.
- Backups: Neon point-in-time recovery 7 days on free tier, 30 days on paid. Add a daily logical backup to a second region (cross-region S3 with object lock). Test restore monthly.

### 6.6 Application

- Input validation: Zod on every external boundary (form actions, API routes, webhooks).
- Output encoding: never raw user content into HTML; sanitize on store, sanitize again on render.
- File uploads: type whitelist (images, PDFs, common docs, logs), max 25MB, virus scan via ClamAV on VPS worker. Files unscanned are inaccessible until clean. Suspicious files quarantined.
- File downloads: never expose Blob URLs directly. Always `/api/files/{id}` → permission check → 302 to signed URL valid 5 min.
- Direct file URLs not enumerable: file IDs are UUIDv7, links signed.
- SSRF protection: all outbound HTTP from server (webhooks, AI, Zabbix) goes through a hardened fetch wrapper that blocks private IPs, link-local, metadata service.
- Secrets management: Vercel env for app, VPS env file with 600 permissions for workers. Never committed. Rotate quarterly.

### 6.7 AI safety

Already covered in 4.5; security highlights:

- System prompts loaded from immutable code, never templated.
- Org ID server-derived, never client-provided.
- Multi-layer injection detection.
- PII redaction on input and output.
- Strict per-surface data access matrix.
- Token budgets and rate limits.
- Full audit trail with hashes (not bodies).

### 6.8 Audit + monitoring

- Append-only audit log with HMAC signature per row, key rotates monthly. Audit query UI verifies signatures on read; tampered rows flagged.
- Login events: success, failure, MFA prompt, MFA success, password reset, passkey registration, suspicious-login alert.
- Admin actions logged: settings changes, user role changes, impersonation start/end, data exports, deletion requests.
- Real-time alerting: Sentry for errors, Better Stack for uptime + log aggregation. Alert on: error rate spike, queue depth >500, failed-job count >10, DB pool exhaustion, Redis disconnect.
- Quarterly access review: list of all admins, all integrations with active tokens, all webhooks. Owner reviews and confirms.

---

## 7. Accessibility (WCAG 2.2 AA)

Not a polish item. Built in from primitive level.

### 7.1 Foundation

- Use Radix primitives (correct ARIA, keyboard nav, focus management already implemented).
- Color contrast: minimum 4.5:1 for body text, 3:1 for large text and UI components. Verified with automated tools (axe) in CI.
- Never convey state by color alone. Always color + icon + text.
- Text resize: layout works at 200% zoom without horizontal scroll up to 320 CSS px viewport (1.4.10 Reflow).
- Min target size 24x24 px (2.5.8). Buttons in dense tables 28x28 minimum.

### 7.2 Keyboard

- Every interactive element is reachable and operable by keyboard.
- Visible focus ring (custom but always visible, 2px outline + offset).
- Logical tab order matching visual flow.
- Skip links: "Skip to main content" first focusable on every page.
- Modals: focus trapped inside, Esc closes, focus returns to trigger.
- Toasts: not interactive unless they need to be; if so, keyboard-reachable.

### 7.3 Screen readers

- Landmarks: `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>` on every layout.
- Headings: one h1 per page, no skipped levels.
- Form labels: explicit `<label for>` or `aria-labelledby`. Errors associated via `aria-describedby`. `aria-invalid` on invalid fields.
- Live regions for async updates: `aria-live="polite"` for status, `assertive` for errors.
- Buttons vs links: `<button>` for actions, `<a>` for navigation. Never both backwards.
- Icon-only buttons have `aria-label`.
- Tables: proper `<th scope>` and caption.

### 7.4 Patterns to get right

- Command palette: announces results, arrow-key nav, enter executes.
- Filter chips: button, removable with backspace + click + enter.
- Date pickers: keyboard nav (arrows, page up/down for months, home/end for week boundaries), input type="text" parser as fallback.
- Combobox: ARIA combobox pattern, listbox with `aria-activedescendant`, filterable, keyboard nav.
- Drag-and-drop (KB reorder, ticket assignment): always provide a non-DnD alternative (move-up/down buttons, dialog selector).
- Rich text editor: must support all keyboard formatting shortcuts; toolbar is keyboard-reachable.

### 7.5 Testing

- Automated: axe-core in CI on every page. Pa11y on staging nightly.
- Manual: NVDA + Chrome on Windows, VoiceOver + Safari on macOS, VoiceOver + Safari on iOS, TalkBack + Chrome on Android. Quarterly full audit.
- User testing: one screen-reader user pass per major release.

---

## 8. Feasibility, Performance, Cost

### 8.1 Cost (monthly, SGD)

| Line         | Service                                  | Cost         |
| ------------ | ---------------------------------------- | ------------ |
| Web hosting  | Vercel Pro (cron <1hr, more bandwidth)   | ~30          |
| DB           | Neon Launch                              | ~25          |
| VPS          | Hetzner CX21 (2 vCPU, 4GB RAM) Singapore | ~7           |
| Email        | Resend (50k emails)                      | ~25          |
| Files        | Vercel Blob (variable)                   | ~15          |
| AI           | Baseten / OpenAI (variable)              | 30-100       |
| Monitoring   | Sentry + Better Stack free tiers         | 0            |
| Domain + DNS | Cloudflare                               | 1            |
| Backups      | S3 (cross-region)                        | 5            |
| **Total**    |                                          | **~140-220** |

VPS could be even smaller (CX11, 2GB) at ~SGD 5 if BullMQ workload stays light. CX21 gives headroom.

### 8.2 Performance budgets

- TTI on inbox: <600ms on fast connection, <1.5s on Fast 3G.
- TTI on portal home: <800ms fast, <2s on Fast 3G.
- Cold-start API route: <300ms p95 on Vercel.
- Hot API route: <100ms p95.
- DB query budget: <50ms p95 for list queries with index, <200ms p95 for complex aggregates.
- Bundle: <200kb gzipped initial JS for tenant routes; lazy-load editor and chart libs.
- Largest Contentful Paint: <2.5s p75 on tenant routes.
- Cumulative Layout Shift: <0.1 always.

### 8.3 Capacity assumptions

- 50 tenants, average 5 staff and 200 end-users each.
- 500 tickets/day platform-wide at peak.
- 2,000 concurrent Socket.io connections at peak.
- 100 background jobs/min steady, bursting to 500/min.

A single CX21 VPS handles this comfortably with headroom. Real bottleneck before scale-out: BullMQ throughput on a single worker process. Solution at 5x: split queues across multiple worker processes on same VPS, then split across two VPS later.

Vercel Pro covers the web layer through ~5,000 tenants if average activity stays near these assumptions. DB is the next bottleneck; Neon Scale tier handles 100x.

### 8.4 Risks and mitigations

| Risk                             | Mitigation                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| VPS down → no real-time, no jobs | Health check from Vercel, fallback: clients poll every 30s when Socket disconnected; jobs queue in DB and replay when VPS returns. Status page banner. |
| Vercel down                      | Static `/disabled` page on subdomain via Cloudflare. Postmortem only; rare.                                                                            |
| Neon down                        | Read replica on Neon (paid). For writes, retry with backoff and surface error after 30s.                                                               |
| AI provider down                 | Per-feature graceful degradation: classification falls back to last known assignment, suggestion features simply unavailable. UI doesn't error.        |
| Email provider down              | Outbox holds; retry on backoff. Banner if backlog >500 messages.                                                                                       |
| Path slug collision              | Reserved-words list (`admin`, `api`, `login`, etc.) checked at signup. Case-folded uniqueness in DB.                                                   |
| Migration cutover failure        | Migrate to a Neon branch, test, swap connection. Keep old branch read-only 30 days. Rollback = swap connection back.                                   |

### 8.5 Build feasibility

Solo or small team. Greenfield rebuild reusing knowledge from current system. Cycle time benefits from:

- Drizzle codegen
- shadcn install commands
- Better Auth pre-built flows
- Resend's drop-in DX
- Vercel preview environments per PR

Realistic timeline (single full-time builder using Claude Code + Kimi):

| Phase                        | Duration     | Outputs                                                                                |
| ---------------------------- | ------------ | -------------------------------------------------------------------------------------- |
| 0. Setup + tooling           | 1 week       | Repo, CI, dev env, Vercel + VPS provisioned, Drizzle skeleton                          |
| 1. Auth + tenancy            | 1 week       | Better Auth, login/signup, path-based middleware, sessions, platform/tenant separation |
| 2. Core ticket model         | 2 weeks      | Schema, server actions, ticket CRUD, message thread, basic inbox UI                    |
| 3. SLA + escalation          | 1 week       | Policies, due-time computation, warn/breach jobs, escalation rules                     |
| 4. KB + assets               | 2 weeks      | Article CRUD, search, public pages, asset CRUD, Zabbix sync                            |
| 5. Customer portal           | 2 weeks      | Portal home, new ticket flow, ticket tracking, KB browse, team mgmt                    |
| 6. Real-time + notifications | 1 week       | Socket.io VPS app, broadcast bridge, in-app + email notifications                      |
| 7. Automations + AI          | 2 weeks      | Rule builder, automation runner, AI surfaces, PII guard                                |
| 8. Platform admin            | 1 week       | Tenants, audit, system, impersonation, failed jobs                                     |
| 9. Migration + cutover       | 1 week       | ETL scripts, dry runs, cutover                                                         |
| 10. Hardening                | 1 week       | Security audit, accessibility audit, performance budget, load test                     |
| **Total**                    | **15 weeks** |                                                                                        |

Compresses to ~10 weeks if Kimi handles testing/docs in parallel and Claude Code handles implementation. End of week 10 you have a production-ready system; weeks 11-15 are polish, edge cases, real-user feedback.

---

## 9. Build Sequence

Run phases sequentially. Each phase has a clear definition of done; never start the next until the current is met.

### Phase 0: Foundations (Week 1)

**Outputs**:

- Repo: `atlas-helpdesk`
- Next.js 15 app, TypeScript strict, ESLint with custom org-scope linter, Prettier, Husky pre-commit
- Drizzle skeleton with empty domain files
- Better Auth installed but not configured
- Vercel project linked, env vars set
- VPS provisioned (Hetzner SG), Caddy configured, Redis installed, BullMQ worker skeleton
- CI: lint, typecheck, test, build on every PR
- Sentry configured
- Single end-to-end smoke test: hit `/`, get 200

**DoD**: deploy to Vercel preview, hit `/`, get a working "Hello Atlas" page.

### Phase 1: Auth + tenancy (Week 2)

**Outputs**:

- All identity tables: `platform_admins`, `users`, `sessions`, `passkeys`, `magic_links`, `organizations`, `org_settings`, `memberships`, `teams`
- Better Auth configured with credentials, magic link, passkey, TOTP
- Path-based middleware resolving slug, injecting `x-org-id`
- `/login`, `/signup`, `/forgot-password` flows
- `requirePermission` function with the action/resource model
- One seed script: creates a platform super-admin and one demo org with one owner

**DoD**: can sign up an org, log in, log out, enable 2FA, register a passkey, log in with passkey, log in with magic link. Path-based tenancy resolves correctly. Suspended org shows disabled page.

### Phase 2: Core ticket model (Weeks 3-4)

**Outputs**:

- Tables: `tickets`, `ticket_messages`, `ticket_events`, `ticket_links`, `ticket_assets`, `ticket_watchers`
- Server actions for ticket CRUD, message create/edit, status changes
- Inbox list (virtualized), filters, saved views
- Ticket detail page with conversation, properties, activity tabs
- Reply composer with markdown + slash commands
- Optimistic UI for status/priority changes
- Audit log writes for all mutations

**DoD**: create ticket from agent UI, reply, change status, assign, view in inbox. Real production scenario walks through end-to-end without errors.

### Phase 3: SLA + escalation (Week 5)

**Outputs**:

- `sla_policies`, `escalation_rules` tables and admin UI
- Due-time computation respecting business hours and pause states
- Cron job (every 5 min) for warning + breach detection
- Escalation actions: notify, reassign, raise_priority, add_tag
- Inbox SLA chip with countdown coloring

**DoD**: create policy, create rule, create ticket, advance time (test helper), see warning fire, see breach fire, see escalation actions execute.

### Phase 4: KB + assets (Weeks 6-7)

**Outputs**:

- KB schema, editor, list, detail, public pages
- Embeddings job (placeholder until Phase 7's AI is wired)
- Asset schema, CRUD, bulk import, Zabbix sync (job on VPS)
- Asset → ticket linkage
- Search across KB and assets

**DoD**: write a KB article, publish public, view at `/kb-public/...`. Import 100 assets via CSV. Zabbix sync creates/updates assets. Asset detail shows ticket history.

### Phase 5: Customer portal (Weeks 8-9)

**Outputs**:

- `/{slug}/portal` layout (different from agent layout)
- Portal home, new ticket flow, my tickets, KB browse
- Team management for `customer_admin` role
- Service catalog from `request_types`
- Email-to-ticket pipeline (inbound processing)
- Outbound email via Resend with outbox pattern

**DoD**: end-user signs up, creates ticket from portal, agent replies, end-user receives email, replies via email, reply threads to ticket.

### Phase 6: Real-time + notifications (Week 10)

**Outputs**:

- Socket.io app on VPS with HMAC auth
- Vercel → VPS broadcast bridge (`/broadcast` endpoint)
- Client-side Socket.io connection, room subscription per page
- Live updates on inbox + ticket detail
- Presence + typing indicators
- In-app notification feed
- Email digest cron
- Web push setup (subscribe + VAPID keys)
- Notification preferences UI

**DoD**: two browsers open on same ticket, one types, the other sees typing indicator. Reply in one, instant update in the other. Notification bell shows new mention.

### Phase 7: Automations + AI (Weeks 11-12)

**Outputs**:

- `automations`, `automation_runs` tables + rule builder UI
- Trigger evaluators wired to all relevant events
- Action executors (status, priority, assignee, tags, message, email, webhook, run_ai)
- AI surfaces: public KB chat, customer chat, admin chat, ticket summary, categorize, suggest reply
- PII guard, injection detection, audit logging
- Per-org AI config UI

**DoD**: create rule "auto-assign P1 to on-call team", create P1 ticket, see auto-assignment. AI summarizes a 20-message thread into 3 sentences. PII redaction visibly applied. Injection attempt blocked and logged.

### Phase 8: Platform admin (Week 13)

**Outputs**:

- `/admin` layout (distinct visual style)
- Tenants list, detail, suspend, schedule-delete
- Cross-tenant audit log search
- System health dashboard
- Failed jobs UI with retry/discard
- Feature flag editor
- Impersonation flow with banner + audit

**DoD**: super-admin suspends a tenant, end-user from that tenant gets disabled page. Super-admin impersonates a tenant user, performs an action, exits, both actions show in audit with both actors.

### Phase 9: Data migration (Week 14)

**Outputs**:

- ETL scripts per domain (orgs → users → tickets → kb → assets → audit)
- Dry-run mode against Neon branch
- Diff and validation reports
- Cutover runbook

**DoD**: run dry-run end-to-end on Neon branch with real data copy. All record counts match (within tolerance for events synthesized from old audit). Sample ticket loads correctly in new UI. Cutover rehearsed.

### Phase 10: Hardening (Week 15)

**Outputs**:

- Penetration test (manual + automated: ZAP scan)
- Accessibility audit with NVDA + VoiceOver passes
- Performance audit: hit budgets across all routes
- Load test: simulate 200 concurrent users, 50 req/s, look for breakage
- Rollback runbook
- On-call runbook

**DoD**: all critical and high findings remediated. Performance budgets met. Cutover scheduled.

### Cutover

**Pre-cutover** (T-7 days):

- Announce maintenance window
- Migration runbook reviewed
- Rollback verified
- DNS TTL reduced to 60s

**Cutover** (Sunday 02:00 SGT):

1. Freeze writes on old system (banner + 503 on POST/PATCH/DELETE)
2. Run final ETL sync (incremental from last dry-run)
3. Validate counts and samples
4. Swap DATABASE_URL on Vercel
5. Smoke-test: login, create ticket, reply, view KB
6. Unfreeze (remove banner)
7. Monitor error rates for 4 hours

**Post-cutover** (T+30 days):

- Old system kept read-only for restore-if-needed
- Decommission old infra after grace period

---

## Appendices

### A. Naming and conventions

- Files: kebab-case for components and routes, snake_case for SQL.
- Tables: snake_case, plural. Columns: snake_case.
- API routes: kebab-case, RESTful.
- TypeScript types: PascalCase for types/interfaces, camelCase for variables.
- Imports: no barrel exports outside `db/schema/index.ts`.
- Server actions in `src/actions/{domain}/{action}.ts`. One action per file.
- DB query helpers in `src/db/queries/{domain}.ts`.

### B. Things explicitly not in v1

- Chat as a primary channel (Slack/Teams in v2).
- Mobile native app (PWA only in v1).
- True multi-region active-active (single SG region in v1).
- Voice channel.
- Custom domains for tenants (schema-ready, not built).
- Marketplace / app store for integrations.
- Customer-facing approval workflows for change management.
- Per-tenant LLM fine-tuning (org-specific system instructions only).

### C. Open decisions to make before Phase 1

1. **Slug ownership**: should slug be settable by tenant on signup, or assigned by platform admin? Recommendation: tenant-set with a reserved-words list and uniqueness check.
2. **Signup**: open self-serve or invite-only at launch? Recommendation: invite-only via platform admin until ~10 tenants are stable, then open with email verification gate.
3. **Custom domains v1 vs v2**: skip in v1.
4. **Mobile PWA push notifications**: needed at launch or post? Recommendation: at launch since infra is cheap; iOS Safari supports it now.
5. **Audit log retention**: 90 days hot, archive to S3 after? Recommendation: 90 days hot, 7 years cold.
6. **Tenant data export format**: ZIP of JSON + attachments folder? Recommendation: yes; manifest.json + tickets.jsonl + messages.jsonl + kb.jsonl + assets.jsonl + attachments/.

---

End of plan. Each section is self-contained. Paste the locked decisions table plus the relevant phase into Claude Code when you start that phase. Hand the AI surfaces section + 6.7 to Kimi for parallel implementation review. Hand sections 5 + 7 to design review when you have a UI prototype.
