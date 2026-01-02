# AGR Support - Implementation Plan

## Repository Analysis Summary

**Current Stack:**
- Next.js 15 (App Router)
- React 19
- TypeScript (strict mode)
- Redis (Upstash) - currently stores subdomain data only
- Tailwind CSS 4
- shadcn/ui components
- Server Actions pattern
- Subdomain-based routing (middleware.ts)

**Missing Components (to add):**
- SQL Database (PostgreSQL) + Drizzle ORM
- Authentication (NextAuth.js v5)
- Email service interface
- Data models for ticketing system

**Architecture Decisions:**
1. Add PostgreSQL + Drizzle ORM (lightweight, TypeScript-first, "boring but reliable")
2. Add NextAuth.js v5 (standard Next.js auth, supports email magic links)
3. Keep Redis for NextAuth sessions
4. Use existing subdomain routing for customer portals
5. Extend Server Actions pattern for all mutations

---

## File-Level Implementation Plan

### Phase 1: Project Setup & Rules

**Files to Create:**
- `.cursorrules` - Project guardrails and conventions
- `drizzle.config.ts` - Drizzle configuration
- `.env.example` - Environment variables template

**Files to Modify:**
- `package.json` - Add dependencies (drizzle, next-auth, postgres, zod, etc.)

---

### Phase 2: Database Schema & Migrations

**Files to Create:**
- `db/schema.ts` - Drizzle schema definitions:
  - `organizations` table
  - `users` table  
  - `memberships` table (user ↔ org with role)
  - `tickets` table
  - `ticketComments` table
  - `attachments` table
  - `auditLogs` table
- `db/index.ts` - Drizzle client export
- `drizzle/0000_initial.sql` - Initial migration
- `db/seed.ts` - Seed script (1 admin user, 1 org, 1 customer user)
- `scripts/seed.ts` - Seed runner script (if needed)

**Files to Modify:**
- `package.json` - Add seed script

---

### Phase 3: Authentication Setup

**Files to Create:**
- `auth.ts` - NextAuth configuration
- `app/api/auth/[...nextauth]/route.ts` - NextAuth API route
- `lib/auth/session.ts` - Session helpers
- `lib/auth/providers.ts` - Auth provider config (Email + Credentials for internal)

**Files to Modify:**
- `middleware.ts` - Add auth middleware
- `.env.example` - Add auth env vars (NEXTAUTH_SECRET, NEXTAUTH_URL)

---

### Phase 4: Authorization Utilities

**Files to Create:**
- `lib/auth/permissions.ts` - Permission checking utilities:
  - `requireInternalRole(role)`
  - `requireOrgMemberRole(orgId, role)`
  - `canViewTicket(ticketId)`
  - `canEditTicket(ticketId)`
  - `getUserOrgMemberships(userId)`
- `lib/auth/roles.ts` - Role type definitions and constants

**Files to Modify:**
- None (new utilities)

---

### Phase 5: Email Service

**Files to Create:**
- `lib/email/index.ts` - Email service interface
- `lib/email/console.ts` - Console logger fallback for local dev
- `lib/email/types.ts` - Email template types

**Files to Modify:**
- None (new service layer)

---

### Phase 6: Internal Console (Agent/Admin Interface)

**Files to Create:**
- `app/app/layout.tsx` - Internal console layout (sidebar + topbar)
- `app/app/page.tsx` - Ticket queue/list page
- `app/app/tickets/[id]/page.tsx` - Ticket detail page
- `app/app/organizations/page.tsx` - Org management page
- `app/app/organizations/[id]/page.tsx` - Org detail/invite page
- `components/tickets/ticket-list.tsx` - Ticket list component
- `components/tickets/ticket-card.tsx` - Ticket card component
- `components/tickets/ticket-detail.tsx` - Ticket detail view
- `components/tickets/ticket-timeline.tsx` - Timeline component
- `components/tickets/ticket-filters.tsx` - Filter component
- `components/organizations/org-list.tsx` - Org list component
- `components/layouts/internal-layout.tsx` - Shared internal layout
- `components/layouts/sidebar.tsx` - Sidebar navigation
- `app/app/actions/tickets.ts` - Ticket server actions (create, update, assign, status change, add comment)
- `app/app/actions/organizations.ts` - Org server actions (create, invite user, update role)
- `lib/tickets/queries.ts` - Ticket query functions (with org scoping)
- `lib/tickets/keys.ts` - Ticket key generation (AGR-2026-000001)

**Files to Modify:**
- `middleware.ts` - Protect `/app/*` routes for internal users only

---

### Phase 7: Customer Portal (Subdomain-based)

**Files to Create:**
- `app/s/[subdomain]/tickets/page.tsx` - Customer ticket list
- `app/s/[subdomain]/tickets/[id]/page.tsx` - Customer ticket detail
- `app/s/[subdomain]/tickets/new/page.tsx` - Create ticket form
- `components/customer/ticket-list.tsx` - Customer ticket list (simplified)
- `components/customer/ticket-detail.tsx` - Customer ticket view (simplified)
- `components/customer/ticket-form.tsx` - Create ticket form
- `components/layouts/customer-layout.tsx` - Customer portal layout
- `app/s/[subdomain]/actions/tickets.ts` - Customer ticket actions (create, reply)
- `lib/subdomains/org-lookup.ts` - Map subdomain to organization

**Files to Modify:**
- `middleware.ts` - Add auth checks for customer portal routes
- `app/s/[subdomain]/page.tsx` - Redirect to tickets or show portal home

---

### Phase 8: Public Ticket Intake

**Files to Create:**
- `app/support/page.tsx` - Public ticket submission form
- `app/support/success/page.tsx` - "Check your email" confirmation
- `app/ticket/[token]/page.tsx` - Magic link ticket access page
- `app/ticket/[token]/verify/page.tsx` - Token verification handler
- `components/public/ticket-form.tsx` - Public ticket form
- `components/public/ticket-view.tsx` - Public ticket view (via token)
- `lib/tickets/magic-links.ts` - Magic link generation and validation
- `lib/tickets/rate-limit.ts` - Rate limiting for public forms (Redis-based)
- `app/support/actions.ts` - Public ticket creation action

**Files to Modify:**
- `app/page.tsx` - Add link to `/support` or update landing page

---

### Phase 9: Audit Logging

**Files to Create:**
- `lib/audit/log.ts` - Audit log creation utility
- `lib/audit/queries.ts` - Audit log queries

**Files to Modify:**
- `app/app/actions/tickets.ts` - Add audit logs for status changes, assignments
- `app/app/actions/organizations.ts` - Add audit logs for role changes

---

### Phase 10: Email Notifications

**Files to Create:**
- `lib/email/templates/ticket-created.tsx` - Ticket created email
- `lib/email/templates/ticket-replied.tsx` - Ticket reply email
- `lib/email/templates/magic-link.tsx` - Magic link email

**Files to Modify:**
- `app/support/actions.ts` - Send magic link email on public ticket creation
- `app/app/actions/tickets.ts` - Send emails on agent reply
- `app/s/[subdomain]/actions/tickets.ts` - Send emails on customer reply

---

### Phase 11: Testing & Quality

**Files to Create:**
- `lib/auth/__tests__/permissions.test.ts` - Permission tests
- `lib/tickets/__tests__/keys.test.ts` - Ticket key generation tests
- `jest.config.js` or `vitest.config.ts` - Test config (if needed)

**Files to Modify:**
- `package.json` - Add test script

---

### Phase 12: Additional UI Components (as needed)

**Files to Create:**
- `components/ui/select.tsx` - Select component (for filters)
- `components/ui/textarea.tsx` - Textarea component
- `components/ui/badge.tsx` - Badge component (for status/priority)
- `components/ui/table.tsx` - Table component (for ticket lists)
- `components/ui/dropdown-menu.tsx` - Dropdown menu (for actions)
- `components/ui/separator.tsx` - Separator component

**Files to Modify:**
- None (new components)

---

## Implementation Order (Execution Plan)

1. **Setup** (Phase 1)
2. **Database** (Phase 2) - Schema, migrations, seed
3. **Auth** (Phase 3) - NextAuth setup
4. **Permissions** (Phase 4) - Authorization utilities
5. **Email Interface** (Phase 5) - Basic email service
6. **Internal Console Core** (Phase 6) - Queue, list, detail pages
7. **Customer Portal** (Phase 7) - Subdomain-based portal
8. **Public Intake** (Phase 8) - Public form + magic links
9. **Audit Logging** (Phase 9) - Add audit trail
10. **Email Notifications** (Phase 10) - Wire up emails
11. **Testing** (Phase 11) - Basic tests
12. **Polish** (Phase 12) - Missing UI components

---

## Environment Variables Needed

```
# Existing
KV_REST_API_URL=
KV_REST_API_TOKEN=
NEXT_PUBLIC_ROOT_DOMAIN=

# New - Database
DATABASE_URL=

# New - Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# New - Email (optional for MVP, console fallback available)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=
```

---

## Database Schema Summary

```typescript
// Core entities
- organizations (id, name, slug, subdomain, createdAt, updatedAt)
- users (id, email, name, passwordHash, isInternal, createdAt, updatedAt)
- memberships (id, userId, orgId, role, createdAt, updatedAt)

// Tickets
- tickets (id, key, orgId, subject, description, status, priority, category, requesterId, requesterEmail, assigneeId, createdAt, updatedAt)
- ticketComments (id, ticketId, userId, authorEmail, content, isInternal, createdAt)
- attachments (id, ticketId, commentId, filename, contentType, size, storageKey, uploadedBy, createdAt)

// Audit
- auditLogs (id, userId, orgId, ticketId, action, details, ipAddress, userAgent, createdAt)
```

---

## Key Design Decisions

1. **Database**: PostgreSQL + Drizzle (no existing SQL DB, Drizzle is lightweight and TypeScript-first)
2. **Auth**: NextAuth.js v5 (standard for Next.js, supports email magic links)
3. **Session Storage**: Redis (already in use, NextAuth supports it)
4. **Ticket Keys**: Format `AGR-{YEAR}-{SEQ}` (e.g., AGR-2026-000001)
5. **Org Isolation**: Enforced at query level (all queries include orgId filter)
6. **Magic Links**: JWT tokens stored in DB with expiration (secure, stateless verification)
7. **Rate Limiting**: Redis-based (simple counter per IP/email)
8. **Email**: Interface with console fallback (can swap implementations later)

---

## Notes

- Keep existing subdomain routing mechanism
- Preserve existing UI components and extend with needed ones
- All Server Actions must include authorization checks
- TypeScript strict mode - no `any` types
- Follow existing code style and patterns
- Use shadcn/ui components consistently
- Design: clean, functional, not "SaaS template" or "AI app" aesthetic

