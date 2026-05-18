# Enterprise Panel Rebuild

## Goal

Rebuild Atlas into a quiet, dense, enterprise-grade operations product across two primary surfaces:

- Internal operations: `/app/*` and `/app/admin/*`
- Customer portal: canonicalize on `/s/[subdomain]/*`

The legacy `/[slug]/portal/*` surface should be migrated or redirected after parity checks so customers do not see two different portal products.

## Information Architecture

### Internal Operations

Primary sections:

- Command Center: global dashboard, alerts, recent activity, service health
- Service Desk: queues, public intake, ticket detail, merges, tags, templates
- Customers: organizations, users, teams, customer IDs, assets
- Knowledge: articles, categories, review queue, public/customer visibility
- Operations: reports, SLA, automation, integrations, Zabbix, jobs
- Governance: audit, compliance, retention, security, sessions, AI audit

### Customer Portal

Primary sections:

- Home: open requests, service health, notices, quick actions
- Requests: create request, my tickets, team tickets for customer admins
- Knowledge: searchable KB, suggested articles, submit article
- Assets: assigned assets, sites/areas when enabled
- Services: status and service catalog
- Team: members, invites, roles for customer admins
- Data: exports and privacy/compliance requests for customer admins

## UI Standard

- Full-height app shell with persistent left navigation on desktop and compact bottom/top navigation on mobile.
- Dense table/list surfaces for operational pages; avoid oversized marketing-style cards.
- One content header pattern: title, short supporting metadata, primary action, secondary actions.
- One filter/search pattern across tickets, KB, organizations, assets, audit, and jobs.
- Clear status taxonomy: operational states, SLA states, ticket states, compliance states.
- No nested cards. Use panels, tables, toolbars, and section bands.
- Avoid one-color themes. Use neutral base with restrained status colors.

## Implementation Phases

1. Shells and Navigation
   - Replace `/app` top-nav with a left rail plus compact top command bar.
   - Replace `/app/admin/layout.tsx` with admin breadcrumbs/section context, not a duplicate menu.
   - Replace `/s/[subdomain]/layout.tsx` with a server-first shell where possible.
   - Route `/[slug]/portal/*` to `/s/[subdomain]/*` or keep read-only compatibility until parity is complete.

2. Core Dashboards
   - Rebuild internal command center around queues, SLA risk, public intake, Zabbix health, jobs, and audit.
   - Rebuild customer home around requests, service status, notices, KB suggestions, and quick request creation.

3. Ticket Workflows
   - Rebuild staff ticket queue and detail with enterprise list density, bulk actions, SLA, lifecycle, related tickets, assets, and audit.
   - Rebuild customer request list/detail with plain status language and magic-link/customer-auth support.

4. Customer Directory and Admin
   - Rebuild organization settings around customer ID, domains, intake, features, SLA, users, assets, and integrations.
   - Rebuild platform governance pages for audit, health, jobs, retention, compliance, AI audit.

5. Knowledge and Assets
   - Rebuild KB admin, category/article flows, customer KB browse/search, and review workflow.
   - Rebuild asset list/detail and customer asset views.

6. Verification
   - Compile/lint focused routes.
   - Browser-check desktop and mobile for `/app`, `/app/tickets`, `/app/admin/integrations`, `/s/[subdomain]`, `/s/[subdomain]/tickets`, `/s/[subdomain]/kb`.
   - Confirm auth redirects, tenant scoping, customer role gates, and public intake visibility.

## First Cut

Start with Phase 1. Shell changes have the highest leverage and should land before page rewrites so every subsequent screen uses the same navigation, spacing, and action patterns.
