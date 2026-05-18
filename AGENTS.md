# Atlas Helpdesk — Agent Guide

This file contains everything an AI coding agent needs to know to work effectively on the Atlas Helpdesk codebase. Atlas is a multi-tenant ITSM / support ticketing platform built on Next.js 15 with custom subdomain routing.

---

## 1. Project Overview

Atlas Helpdesk is a production-ready, multi-tenant helpdesk platform. Each tenant (organization) gets a custom subdomain. The app has three distinct UI zones:

- **Public marketing site** (`/`) — landing page, knowledge base, support ticket submission, status pages
- **Internal staff dashboard** (`/app/*`) — ticket queue, organization management, reporting, admin tools
- **Customer portals** (`/s/[subdomain]/*`) — organization-branded self-service portal for ticket tracking, KB, service catalog

Key features: ticketing with SLA tracking, asset management, knowledge base, email-to-ticket, AI-powered suggestions (Baseten/OpenAI), Zabbix monitoring integration, CSAT surveys, automation rules, audit logging, bulk operations, and real-time notifications.

---

## 2. Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS 4, shadcn/ui primitives, `lucide-react` icons |
| Database | PostgreSQL via Neon (`@neondatabase/serverless`); Drizzle ORM |
| Auth | Next-Auth v5 (Auth.js) with Credentials provider, JWT sessions, bcrypt hashing |
| Cache / Rate Limit | Upstash Redis (`@upstash/redis`) or self-hosted Redis; in-memory mock for tests |
| File Storage | Vercel Blob (`@vercel/blob`) for attachments |
| Email | Microsoft Graph API (priority) > SMTP (`nodemailer`) > console fallback |
| AI | Baseten (`deepseek-ai/DeepSeek-V3.1`) via OpenAI-compatible client |
| Jobs | Redis-backed BullMQ queues with typed handlers |
| Testing | Vitest (unit/integration), Playwright (E2E) |
| Package Manager | pnpm 10.12.4 |

---

## 3. Directory Structure

```
app/                 # Next.js App Router pages, layouts, API routes, Server Actions
  actions/           # Server Actions (tickets, orgs, users, automation, etc.)
  api/               # Route handlers (~126 endpoints: auth, tickets, AI, cron, webhooks)
  app/               # Internal staff dashboard pages (/app/*)
  s/[subdomain]/     # Customer portal pages + parallel @modal routes
  login/             # Auth flows including 2FA
components/          # React components organized by domain
  ui/                # shadcn/ui primitives (button, dialog, table, toast, etc.)
  tickets/           # Ticket list, detail, filters, bulk actions, SLA indicators
  admin/             # Ops dashboard, AI audit, failed jobs, internal groups
  customer/          # Portal shell, request catalog, team manager
  ai/                # Smart suggestions, consent banner
  editor/            # TipTap editor wrappers
  providers/         # AuthProvider, ToastProvider, CommandPalette provider
  layouts/           # OrganizedNav, mobile nav, responsive table
db/                  # Database schema, seed script, connection layer
  schema.ts          # ~60 Drizzle tables with relations
  schema-extensions.ts # Additional tables (agent metrics, workflow configs, etc.)
  index.ts           # Dual-driver DB client (Neon / postgres-js)
drizzle/             # Migration SQL files (~59 migrations)
docs/                # Architecture and setup docs
  superpowers/       # Active improvement plans (security, accessibility, integrations)
lib/                 # Server-side business logic, API clients, utilities
  auth/              # Permissions, roles, sessions, 2FA, password reset
  ai/                # OpenAI client, streaming helpers, domain AI wrappers
  tickets/           # Ticket queries, SLA, escalation, magic links
  email/             # Email service factory, Graph client, SMTP, templates
  jobs/              # Queue/worker setup + typed handlers
  redis/             # Client, cache, rate-limit, presence, drafts
  api/               # Cron/API secret verification, secureEndpoint wrapper
  db/                # Tenant scoping guards (withOrgScope)
  monitoring/        # Correlation IDs, structured logging, error tracking
  integrations/      # Registry for Slack, Teams, Jira, GitHub, Salesforce (stubs)
  zabbix/            # Zabbix API client and sync logic
hooks/               # Client-side hooks (realtime, AI streaming, keyboard shortcuts)
tests/               # Vitest unit/integration tests + Playwright E2E tests
scripts/             # One-off TSX utilities, diagnostics, migration runners
aws/                 # Terraform + scripts for optional AWS real-time polling
```

---

## 4. Build and Development Commands

```bash
# Install dependencies
pnpm install

# Dev server (Turbopack)
pnpm dev

# Production build
pnpm build

# Lint
pnpm lint

# Database
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema changes (dev)
pnpm db:studio        # Drizzle Studio GUI
pnpm db:seed          # Seed initial data (2 internal users, sample orgs)

# Tests
pnpm test             # Vitest unit/integration tests
pnpm test:e2e         # Playwright E2E tests
pnpm test:e2e:ui      # Playwright with UI
pnpm test:services    # Smoke test (DB, email, env vars)

# Diagnostics
pnpm check:emails     # Check failed email diagnostics
```

---

## 5. Code Style Guidelines

- **TypeScript**: Strict mode enabled. `no-explicit-any` is a **warn**, not an error. Underscore-prefixed unused vars are allowed.
- **ESLint**: Extends `next/core-web-vitals` and `next/typescript`.
- **Formatting**: Follow existing file conventions. Use single quotes in TS/TSX unless the file already uses double quotes.
- **Imports**: Prefer `@/` path aliases (e.g., `@/db`, `@/lib/auth/permissions`).
- **Server vs Client**: Default to Server Components. Use `'use client'` only when interactivity (state, effects, browser APIs) is required.
- **Async params**: Next.js 15 makes `params` and `searchParams` async. Always await them: `const { id } = await params;`.
- **Error handling**: Never log raw tokens, passwords, or full emails. Use `maskEmail()` for auth logging.

---

## 6. Testing Strategy

### Vitest (Unit / Integration)
- Config: `vitest.config.ts`
- Environment: `node`, globals enabled, single-threaded to avoid DB contention
- Setup file: `tests/setup.ts` truncates `organizations` and `users` before each test
- Tests skip gracefully when `DATABASE_URL` is missing:
  ```ts
  const run = process.env.DATABASE_URL ? describe : describe.skip;
  run('suite', () => { ... });
  ```
- Heavy mocking of `@/lib/auth/context` for permission tests; Redis is mocked in-memory for rate-limit tests.

### Playwright (E2E)
- Located in `tests/e2e/`
- Not in `package.json` devDependencies by default; tests degrade gracefully if not installed.

### Key Test Files
- `permissions.test.ts` — role enforcement boundaries
- `security.test.ts` — org isolation, magic-link expiry, attachment gating
- `org-isolation.test.ts` — query-layer tenant scoping
- `rate-limiting.test.ts` — mocked Redis counter logic
- `cron-auth.test.ts` — fail-closed cron verification
- `webhook-auth.test.ts` — HMAC-SHA256 payload validation
- `email/threading.test.ts` — Message-ID / In-Reply-To parsing

---

## 7. Database and Migrations

### Schema
- Primary schema: `db/schema.ts`
- Extensions: `db/schema-extensions.ts`
- ~60 tables covering: organizations, users, platform admins, memberships, tickets, comments, attachments, services, assets, KB, automation rules, audit logs, notifications, AI usage, Zabbix configs, etc.

### Connection
- `db/index.ts` exports a Proxy-based singleton `db` client.
- Supports two drivers via `DB_DRIVER` env var:
  - `neon` (default): `@neondatabase/serverless` for serverless/edge
  - `postgres`: `postgres-js` with connection pooling (max 10)

### Migrations
- Managed with Drizzle Kit (`drizzle.config.ts`).
- Migration files live in `drizzle/`.
- Feature migrations were applied in phases (Phase 3, Phase 4, etc.). Historical one-off scripts are in `scripts/archive/`.

### Seeding
- `db/seed.ts` creates two hardcoded internal users (`ag@agrnetworks.com` admin, `help@agrnetworks.com` agent) with bcrypt-hashed passwords.

---

## 8. Authentication and Authorization

### Auth Flow
- Next-Auth v5 with Credentials provider only.
- Config split: `auth.config.ts` (cookies, JWT callbacks, session) + `auth.ts` (authorize logic, DB queries).
- JWT strategy, 30-day max age.
- Cookie names prefixed with `__Secure-` in production.
- Two separate identity tables checked in order:
  1. `platformAdmins` — global platform admins (`SUPER_ADMIN`, `ADMIN`, `SUPPORT`)
  2. `users` — tenant users, with `isInternal` flag distinguishing agents from customers

### 2FA / TOTP
- If `twoFactorEnabled` is true, password login returns `null` and issues a `loginToken`.
- User completes 2FA on `/login/verify-2fa`.
- Implemented in `lib/auth/two-factor-login.ts` using `otplib`.

### Permission Guards (use these — do not reinvent)
- `requireAuth()` — any authenticated user
- `requireInternalRole()` — staff dashboard access (`ADMIN`, `AGENT`, `READONLY`)
- `requireInternalAdmin()` — platform admin panel access
- `requireOrgMemberRole()` — customer portal access
- `canViewTicket(ticketId)` / `canReplyTicket(ticketId)` — ticket-level access
- `withOrgScope()` / `withValidatedOrgScope()` — mandatory tenant scoping wrapper for DB queries

### Middleware (`middleware.ts`)
- Extracts subdomain from host (local: `*.localhost`, prod: `*.rootdomain`, Vercel preview: `*---*.vercel.app`; also falls back to `/s/[subdomain]` path on localhost).
- Protects `/app/*` and `/admin/*` — redirects to `/login` if no session cookie.
- Blocks `/app` and `/admin` access from subdomains.
- Checks `organizations.is_active` / `deleted_at` at the edge; redirects disabled orgs to `/disabled`.
- Adds security headers (CSP, HSTS, X-Frame-Options, etc.).
- Clears all auth cookie variants on `?error=SessionExpired` or `?error=SessionInvalid`.

---

## 9. Environment Variables

Required for local development:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | JWT signing secret (generate with `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Base URL for auth callbacks (`http://localhost:3000`) |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Root domain for subdomain routing (`localhost:3000`) |
| `APP_BASE_URL` | Internal app base URL |
| `SUPPORT_BASE_URL` | Public support base URL |
| `TOKEN_PEPPER` | HMAC pepper for magic links (`openssl rand -base64 32`) |
| `EXPORT_SIGNED_URL_SECRET` | HMAC secret for customer export signed URLs |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for attachment uploads |

Optional but recommended:

| Variable | Purpose |
|----------|---------|
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash Redis for rate limiting and caching |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_SECURE` | SMTP fallback email |
| `EMAIL_FROM` | Default sender address |
| `MICROSOFT_GRAPH_TENANT_ID` / `CLIENT_ID` / `CLIENT_SECRET` | Microsoft Graph email (priority over SMTP) |
| `GRAPH_WEBHOOK_SECRET` | Graph inbound webhook validation |
| `INBOUND_EMAIL_SECRET` | Generic inbound email webhook auth |
| `CRON_SECRET_TOKEN` | External cron / VPS auth |
| `BASETEN_API_KEY` | AI inference API |
| `INTERNAL_ADMIN_EMAILS` | Comma-separated emails with `/app/admin/health` access |
| `HEALTHCHECK_EMAIL_TO` / `SUPPORT_INBOX_EMAIL` | Diagnostics and intake addresses |

---

## 10. Deployment

### Primary: Vercel
- Designed for Vercel with wildcard DNS (`*.yourdomain.com`).
- `vercel.json` defines two daily cron jobs: `/api/jobs/process` and `/api/cron/graph-subscription`.
- `next.config.ts` has `ignoreDuringBuilds: true` for ESLint and `ignoreBuildErrors: true` for TypeScript — noted as temporary.

### Optional AWS Real-Time Polling
- Terraform configs in `aws/terraform/` for sub-100ms Zabbix polling.
- Uses EC2 (`m7i-flex.large`) + ElastiCache Redis.
- Docs: `docs/AWS_DEPLOYMENT_GUIDE.md`, `docs/AWS_1MS_ARCHITECTURE.md`.

### Optional External VPS Sync
- Lightweight Node.js poller in `scripts/vps-sync/`.
- Calls Vercel API endpoints on configurable intervals.

---

## 11. Security Considerations

- **Tenant isolation** is enforced server-side via `withOrgScope()` in `lib/db/with-org-scope.ts`. Never run tenant-scoped queries without it.
- **Fail-open rate limiting**: if Redis is unavailable, requests are allowed (logged).
- **Fail-closed cron/API endpoints**: if secrets are missing, return 503.
- **Magic links**: single-use, purpose-bound tokens hashed at rest (`ticketTokens` table).
- **Attachment downloads**: auth-gated; proxy through app, never direct Blob URLs.
- **Email logging**: auth logs mask emails and never log passwords or tokens.
- **Security headers**: CSP, HSTS, X-Frame-Options, etc. applied in middleware.
- **PII / Compliance**: audit logs are immutable; retention policies and anonymization utilities exist in `lib/compliance/`.

---

## 12. Key Conventions for Agents

1. **Always use `withOrgScope()`** for any query that touches tenant data (tickets, users, orgs, assets, etc.).
2. **Prefer Server Actions** for mutations in the staff dashboard (`/app/*`). Use API routes for file uploads, SSE streams, cron jobs, webhooks, and public endpoints.
3. **Revalidate after mutations**: call `revalidatePath()` after Server Actions that change displayed data.
4. **Mock auth context in tests**: `vi.mock('@/lib/auth/context')` is the standard pattern.
5. **Use the existing AI client**: all AI calls go through `lib/ai/client.ts` (`getAIResponse`, `getEmbedding`). Do not create new OpenAI clients.
6. **Email goes through the factory**: use `lib/email/index.ts` (`sendEmail`, `createEmailService`) so Graph > SMTP > console priority is respected.
7. **Cache invalidation**: use helpers in `lib/cache-invalidation.ts` after creating/updating/deleting major entities.
8. **Background jobs**: enqueue via `lib/jobs/` instead of running long tasks in request handlers.
9. **Do not commit `.env.local`** or any secrets.
10. **Do not run `git commit`, `git push`, `git rebase`, etc.** unless explicitly asked.

---

## 13. Active Improvement Plans

The `docs/superpowers/` directory contains detailed execution plans for ongoing remediation work:

- **Area 1 — TypeScript & Schema**: Eliminate `tsc --noEmit` errors, merge schema extensions, fix async params.
- **Area 2 — Security**: Replace hardcoded 2FA encryption with `ENCRYPTION_KEY` (AES-256-GCM); fix webhook route consistency.
- **Area 3 — Accessibility**: WCAG 2.1 AA baseline (skip links, `aria-label`, toast live regions, focus rings).
- **Area 4 — Feature Completions**: Wire email queue triggers, CSAT dispatch, `sharp` thumbnails, fix hardcoded user IDs.
- **Area 5 — Integrations**: Fill Slack, Teams, GitHub, Jira stubs; add `external_refs` JSONB column; wire `triggerIntegrations()`.

If your task touches any of these areas, read the relevant plan in `docs/superpowers/` before making changes.
