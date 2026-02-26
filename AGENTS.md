# Atlas Helpdesk - AI Agent Guide

This document provides essential context for AI coding agents working on the Atlas Helpdesk project.

## Project Overview

Atlas Helpdesk is a **multi-tenant customer support platform** built for AGR Networks. It provides:

- **Internal Console** (`/app/*`) - For support agents and admins to manage tickets, users, and organizations
- **Customer Portal** (`/s/[subdomain]/*`) - Organization-branded support portals accessed via subdomains
- **Public Pages** (`/`, `/kb`, `/support`) - Landing page, public knowledge base, and ticket submission
- **Magic Link Access** (`/ticket/[token]`) - Secure token-based ticket access for external users

### Key Domains

- Production: `atlas.agrnetworks.com`
- Customer portals: `[org-slug].atlas.agrnetworks.com`
- Local dev: `localhost:3000` with subdomain support via `[subdomain].localhost:3000`

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5.8 |
| React | React 19 |
| Styling | Tailwind CSS 4 |
| UI Components | shadcn/ui + Radix UI primitives |
| Database | PostgreSQL (via Drizzle ORM) |
| Auth | NextAuth.js v5 (beta) |
| Email | Microsoft Graph API (primary), SMTP fallback, Console dev mode |
| File Storage | Vercel Blob |
| Cache/Queue | Upstash Redis (optional) |
| Testing | Vitest (unit), Playwright (e2e) |
| Package Manager | pnpm |

## Project Structure

```
/
├── app/                          # Next.js App Router
│   ├── app/                      # Internal console (agent/admin UI)
│   │   ├── actions/              # Server Actions for internal operations
│   │   ├── admin/                # Admin pages (health, audit, compliance, etc.)
│   │   ├── organizations/[id]/   # Org management pages
│   │   ├── tickets/              # Ticket management
│   │   ├── users/                # User management
│   │   ├── kb/                   # Knowledge base management
│   │   └── settings/             # User settings (security, sessions)
│   │   
│   ├── s/[subdomain]/            # Customer portal (subdomain-based)
│   │   ├── actions/              # Customer-facing server actions
│   │   ├── tickets/              # Customer ticket views
│   │   ├── kb/                   # Public/org KB articles
│   │   ├── services/             # Service status pages
│   │   └── team/                 # Team management for customers
│   │   
│   ├── api/                      # API routes
│   │   ├── auth/                 # NextAuth.js endpoints
│   │   ├── inbound-email/        # Webhook for email-to-ticket
│   │   ├── cron/                 # Cron job endpoints
│   │   └── [various]/            # Feature-specific APIs
│   │   
│   ├── ticket/[token]/           # Magic link ticket access
│   ├── kb/                       # Public knowledge base
│   ├── support/                  # Public ticket submission
│   └── login/                    # Authentication pages
│
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components (primitive)
│   ├── tickets/                  # Ticket-specific components
│   ├── organizations/            # Org management components
│   ├── customer/                 # Customer portal components
│   └── [various]/                # Feature-specific components
│
├── lib/                          # Server-side utilities
│   ├── auth/                     # Authentication utilities
│   ├── email/                    # Email service implementations
│   ├── tickets/                  # Ticket business logic
│   ├── automation/               # Automation rules engine
│   ├── jobs/                     # Background job queue
│   ├── sla/                      # SLA calculation logic
│   ├── db/                       # DB helpers (org scoping)
│   └── [various]/                # Feature utilities
│
├── db/                           # Database
│   ├── schema.ts                 # Drizzle schema definition
│   └── index.ts                  # DB client setup
│
├── drizzle/                      # Database migrations
│   └── [NNNN]_*.sql              # Migration files
│
├── hooks/                        # Custom React hooks
├── types/                        # TypeScript type declarations
├── tests/                        # Test files
│   ├── e2e/                      # Playwright e2e tests
│   └── *.test.ts                 # Vitest unit tests
│
└── scripts/                      # Utility scripts (migrations, testing)
```

## Build and Development Commands

```bash
# Development (with Turbopack)
pnpm dev

# Production build
pnpm build

# Linting
pnpm lint

# Testing
pnpm test                    # Run Vitest unit tests
pnpm test:e2e               # Run Playwright e2e tests
pnpm test:e2e:ui            # Run e2e tests with UI

# Database operations
pnpm db:generate            # Generate migration from schema
pnpm db:migrate             # Apply pending migrations
pnpm db:push                # Push schema changes (dev only)
pnpm db:studio              # Open Drizzle Studio

# Feature-specific migrations
pnpm db:apply-phase1
pnpm db:apply-sla
pnpm db:apply-all-phase3
# ... (many more specific migration scripts)
```

## Code Style Guidelines

### TypeScript Conventions

- **Strict mode enabled** - Avoid `any` when possible (currently warns)
- **Prefer explicit types** for function parameters and returns
- Use path alias `@/` for imports (e.g., `@/lib/utils`, `@/db/schema`)
- Components use `.tsx`, utilities use `.ts`

### Naming Conventions

- **Components**: PascalCase (`TicketDetail.tsx`)
- **Files**: kebab-case for pages, camelCase for utilities
- **Database tables**: snake_case (`ticket_comments`)
- **TypeScript types**: PascalCase with descriptive names
- **Server Actions**: camelCase in `actions.ts` files
- **API Routes**: Route segment convention (`route.ts`)

### Database Schema Patterns

- Primary keys: `uuid('id').defaultRandom().primaryKey()`
- Timestamps: `createdAt`, `updatedAt` with `.defaultNow()`
- Soft deletes: `deletedAt` timestamp (not boolean)
- Foreign keys: `{table}Id` format with `{ onDelete: 'cascade' | 'set null' }`
- Enums: Use `pgEnum()` for fixed value sets
- JSON fields: Use `jsonb()` with `$type<T>()` for type safety

### Component Patterns

```typescript
// Server Component (default)
export default async function Page() {
  const data = await fetchData();
  return <Component data={data} />;
}

// Client Component (when needed)
'use client';
export default function ClientComponent() {
  const [state, setState] = useState();
  // ...
}

// Server Action
'use server';
export async function actionName(formData: FormData) {
  // Validate input
  // Check permissions via auth()
  // Perform operation
  // Revalidate cache if needed
}
```

## Testing Instructions

### Unit Tests (Vitest)

- Located in `tests/*.test.ts`
- Run with `pnpm test`
- Uses in-memory database transactions (truncates tables before each test)
- Tests exclude `tests/e2e/` directory

### E2E Tests (Playwright)

- Located in `tests/e2e/*.test.ts`
- Run with `pnpm test:e2e`
- Tests full user flows across internal console and customer portal

### Test Setup

Tests automatically:
1. Load `.env.local` for environment variables
2. Truncate `organizations` and `users` tables before each test
3. Use single-threaded execution to avoid DB conflicts

## Authentication & Authorization

### Auth Flow

1. **Login**: Credentials provider with optional 2FA
2. **Session**: JWT-based via NextAuth.js v5
3. **Middleware** (`middleware.ts`): Protects routes based on session cookie
4. **Role Checks**: Server-side validation via `auth()` + database lookups

### User Types

| Type | Flag | Access |
|------|------|--------|
| Internal | `isInternal: true` | `/app/*` console access |
| Customer | `isInternal: false` | `/s/[subdomain]/*` portal only |

### Role Hierarchy (Organizations)

- `ADMIN` - Full org access
- `AGENT` - Can manage tickets
- `READONLY` - View-only access
- `CUSTOMER_ADMIN` - Customer portal admin
- `REQUESTER` - Can create/view own tickets
- `VIEWER` - Read-only customer access

### Security Patterns

- Always verify `orgId` matches user's membership
- Use `withOrgScope()` helper for DB queries
- Magic links: single-use, purpose-bound (`VIEW` or `REPLY`)
- Token hashing: Store SHA-256 hash, compare with HMAC

## Multi-Tenant Architecture

### Subdomain Resolution

The middleware handles subdomain detection:

1. **Production**: `[subdomain].atlas.agrnetworks.com`
2. **Local dev**: `[subdomain].localhost:3000` OR `/s/[subdomain]/` path
3. **Vercel preview**: `[subdomain]---[deployment].vercel.app`

### Organization Isolation

All data is scoped by `orgId`:

```typescript
// Always filter by org
const tickets = await db.query.tickets.findMany({
  where: eq(tickets.orgId, orgId),
});
```

### Customer Portal Features

Each organization can enable/disable features via `features` JSON:

```typescript
features: {
  assets?: boolean;      // Asset inventory
  exports?: boolean;     // Data export
  team?: boolean;        // Team management
  services?: boolean;    // Service catalog
  knowledge?: boolean;   // Knowledge base
}
```

## Background Jobs

Job queue implemented in PostgreSQL:

- **Queue**: `lib/jobs/queue.ts`
- **Worker**: `lib/jobs/worker.ts`
- **Handlers**: `lib/jobs/handlers/`
- **Failed Jobs**: Stored in `failed_jobs` table with retry logic

### Job Types

- `send-email` - Email delivery
- `generate-export` - Data export generation
- `process-attachment` - File scanning/processing
- `audit-compaction` - Audit log maintenance
- `sla-warning-check` - SLA monitoring

## Email System

Priority order:
1. **Microsoft Graph API** (M365/Azure AD) - Production
2. **SMTP** - Fallback option
3. **Console** - Development (logs to stdout)

Key files:
- `lib/email/index.ts` - Service factory
- `lib/email/graph-client.ts` - M365 integration
- `lib/email/templates/*.ts` - Email templates

## Cron Jobs

Vercel Cron endpoints in `app/api/cron/`:

- `csat-reminders` - Customer satisfaction surveys
- `escalations` - SLA breach escalation
- `retention` - Data retention policy enforcement
- `scheduled-tickets` - Future ticket creation
- `zabbix-sync` - Monitoring sync

## Environment Variables

Required for development:

```bash
# Database (REQUIRED)
DATABASE_URL=postgresql://...

# Auth (REQUIRED)
NEXTAUTH_SECRET=...        # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# Domains
NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000
APP_BASE_URL=http://localhost:3000

# Security (REQUIRED for magic links)
TOKEN_PEPPER=...           # openssl rand -base64 32

# Blob Storage (REQUIRED for attachments)
BLOB_READ_WRITE_TOKEN=...

# Email (pick one)
# Option 1: Microsoft Graph
MICROSOFT_GRAPH_TENANT_ID=...
MICROSOFT_GRAPH_CLIENT_ID=...
MICROSOFT_GRAPH_CLIENT_SECRET=...
EMAIL_FROM_ADDRESS=...

# Option 2: SMTP
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASSWORD=...
EMAIL_FROM=...
```

See `.env.local.template` for full list.

## Common Development Tasks

### Adding a New Database Table

1. Add table definition to `db/schema.ts`
2. Add relations if needed
3. Run `pnpm db:generate` to create migration
4. Run `pnpm db:migrate` to apply
5. Add queries in `lib/[feature]/queries.ts`

### Adding a Server Action

1. Create or edit `app/[area]/actions/[feature].ts`
2. Add `'use server'` at top
3. Validate input with Zod
4. Check permissions via `auth()` and membership lookup
5. Perform DB operation
6. Use `revalidatePath()` to clear caches

### Adding an API Route

1. Create `app/api/[path]/route.ts`
2. Export HTTP method handlers (`GET`, `POST`, etc.)
3. Validate session for protected routes
4. Return `NextResponse.json()` responses

### Adding a Component

1. Create in `components/[category]/ComponentName.tsx`
2. Use `'use client'` only if interactivity needed
3. Import from `@/components/ui/*` for primitives
4. Follow existing patterns for loading/error states

## Key Files Reference

| File | Purpose |
|------|---------|
| `middleware.ts` | Route protection, subdomain extraction |
| `auth.ts` | NextAuth.js configuration |
| `db/schema.ts` | Database schema (single source of truth) |
| `lib/utils.ts` | Common utilities, domain constants |
| `lib/auth/permissions.ts` | Permission checking helpers |
| `lib/db/with-org-scope.ts` | Org isolation helper |
| `drizzle.config.ts` | Migration tool config |
| `next.config.ts` | Next.js configuration |
| `vitest.config.ts` | Test configuration |

## Troubleshooting

### Common Issues

**Auth session not persisting**: Check `NEXTAUTH_SECRET` is set and consistent

**Subdomain not resolving**: Verify `NEXT_PUBLIC_ROOT_DOMAIN` format matches actual domain

**Database connection fails**: Ensure `DATABASE_URL` uses correct format for postgres-js

**Email not sending**: Check Graph API credentials or fallback to SMTP/console

**Migration errors**: Review `drizzle/*.sql` files for conflicts, run `pnpm db:push` for dev

## Security Considerations

- **Never** expose `NEXTAUTH_SECRET` or `TOKEN_PEPPER` to client
- **Always** validate `orgId` matches user's organization
- **Always** check file upload types and sizes
- **Use** `revalidatePath()` after mutations to prevent stale data
- **Hash** sensitive tokens (magic links, passwords) with bcrypt/SHA-256
- **Validate** file uploads with mime-type and extension checks
- **Scan** attachments for viruses (implemented in `lib/attachments/scanning.ts`)

## Deployment

Primary target: **Vercel**

Required Vercel settings:
- Build command: `pnpm build`
- Install command: `pnpm install`
- Environment variables: All from `.env.local`
- Cron jobs: Configured in `vercel.json`
