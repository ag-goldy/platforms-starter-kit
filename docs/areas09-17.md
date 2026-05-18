Areas 9-17: Skeletons and Decision Points
Use these to push through the rest of the brainstorm in Claude Code quickly. Each skeleton lists the topic, the key decisions to lock, and the content blocks needed. Treat each like a checklist: when all decisions are answered, that area is done.

Area 9: Platform Admin Console
Visual language already locked: black surface, monospace, dense, distinct from tenant UI.
Decisions to lock:

Should /admin be on the same domain as tenants (atlas.agrnetworks.com/admin) or a separate subdomain (admin.atlas.agrnetworks.com)? Separate subdomain is safer (no slug collision risk, separate cookie scope). Recommendation: separate subdomain, separate Vercel project even, sharing only the DB.
IP allowlist for platform admins: optional or mandatory? Recommendation: optional v1, default off, encourage on for SUPER_ADMIN role.
Impersonation duration cap: 15/30/60 min options. Recommendation: 30 min default, 60 max.
Tenant deletion: soft-delete with 30-day grace, or immediate hard delete? Recommendation: 30-day grace; recoverable by SUPER_ADMIN.

Content blocks needed:

Login page (/admin/login): credentials + mandatory 2FA, no magic links, optional IP allowlist check.
Home dashboard: tenant count, active sessions, queue depth, error rate, top failing routes (last 24h).
Tenants list with create/suspend/delete row actions.
Tenant create form: slug validation live, owner email, plan, region, optional retention overrides.
Tenant detail: read-only metadata, members, recent activity, billing, feature flags.
Cross-tenant audit log search.
Failed jobs viewer with retry/discard.
System health: real-time charts.
Feature flag editor.
Impersonation: button + reason modal + persistent banner during session.


Area 10: Ticket Lifecycle and Status Workflows
Decisions to lock:

Status transitions: which transitions are agent-only, which are customer-allowed? Recommendation:

Customer can: open → reopen (by replying after resolved), close own ticket from resolved.
Agent can: any transition.
Automation can: any transition.


Should reopen create a new SLA cycle or resume the previous one? Recommendation: new SLA cycle for reopened tickets, with a "reopened from previous resolution" event in the activity log.
Auto-close after X days on resolved without customer reply: configurable per org? Recommendation: yes, default 7 days.
Merge mechanics: messages from both tickets interleaved in target, source ticket marked merged with link. Source becomes read-only.

Content blocks needed:

State machine diagram with allowed transitions per actor type (customer, agent, system).
Pause-resume mechanics for SLA on PENDING_CUSTOMER / PENDING_INTERNAL.
Reopen rules and event logging.
Auto-close cron: scans resolved tickets older than threshold, closes with system message.
Merge flow UI and audit trail.
Linked tickets (related, duplicate, blocks, blocked_by) and how they show in detail view.


Area 11: SLA and Escalation Engine
Decisions to lock:

Business hours: per-team or per-org-only in v1? Recommendation: per-org default with per-team override (covers most cases without complexity).
Holiday calendar: maintained by tenant admin? Recommendation: yes, simple list of dates with optional "skip" or "use weekend hours".
Pause statuses: only PENDING_CUSTOMER and PENDING_INTERNAL? Recommendation: yes, hardcoded.
Warning threshold: percentage of elapsed time? Recommendation: 80% of due window, configurable per policy.
Escalation actions allowed: notify, reassign, raise priority, add tag, post to webhook, run AI suggestion. Anything more?

Content blocks needed:

SLA computation algorithm (with business hours and pause adjustments).
Cron schedule (every 5 min, scans tickets, fires events idempotently).
Escalation rule builder UI.
Visual timeline showing applied policy, remaining time, breaches.
SLA report page: breach rate, average response time, average resolution time, by priority and team.


Area 12: Knowledge Base
Decisions to lock:

Article workflow: simple draft/published, or with in-review intermediate state? Recommendation: include in-review (matches the auditor + author pattern from current system).
Public KB: per-org subdomain /kb-public/{slug} or each org sees a custom KB site? Recommendation: shared path under main domain to keep cert and routing simple.
AI generation from tickets: opt-in per article or always available as a button? Recommendation: always available, never automatic.
Embeddings model: text-embedding-3-small or local? Recommendation: text-embedding-3-small for now, swap later if cost matters.
Versioning: keep all revisions or last N? Recommendation: keep all, archive after 1 year.

Content blocks needed:

Editor: Tiptap with image paste, code blocks, callouts.
Categories: tree structure, ordering, public/private.
Article states: draft → in_review → published → archived.
Public article SEO: meta tags, sitemap, robots, structured data (FAQ schema where appropriate).
Embedding pipeline (chunked, async).
Search: hybrid (FTS + vector cosine), reranking.
Feedback loop (thumbs + comment + escalate).
AI-draft from ticket button.


Area 13: Asset Management
Decisions to lock:

Asset categories: tenant-defined or platform-provided defaults? Recommendation: platform-provided defaults (server, switch, ap, camera, printer, laptop, etc.) plus tenant ability to add custom.
Asset hierarchy: support parent-child (rack contains servers)? Recommendation: yes, single-level parent in v1, full tree in v2.
Lifecycle states: ACTIVE, IN_REPAIR, DECOMMISSIONED, LOST, plus tenant-custom states? Recommendation: 4 base states locked; custom statuses tracked in org_asset_statuses for display only.
Zabbix as the only monitoring source in v1, or include PRTG, Datadog, etc.? Recommendation: Zabbix only in v1; integration framework supports others later.
CSV import: column mapping UI? Recommendation: yes, tenant maps their CSV columns to schema fields, save mapping for next import.

Content blocks needed:

Asset list with filters (type, status, location, assignee).
Detail page: specs, lifecycle events, related tickets, attachments.
Bulk import flow.
Zabbix sync job (15-min interval, idempotent upsert).
Auto-ticket from Zabbix trigger (rate-limited 10/host/hour).
Asset → ticket linking from both directions.


Area 14: AI Integration (Zeus)
Decisions to lock:

AI provider: Baseten (current) or switch to Anthropic Claude API direct or OpenAI? Recommendation: keep Baseten gateway abstraction so provider can be swapped per-feature.
Model strategy:

Tier 1 (cheap, fast): classification, sentiment, simple suggestions.
Tier 2 (balanced): drafting, summarization.
Tier 3 (premium): admin AI chat with full context, complex reasoning.
Recommend Claude Haiku 4.5 for Tier 1, Sonnet 4.6 for Tier 2, Opus 4.7 for Tier 3 if cost permits.


Token budget per org: hard cap or soft warning? Recommendation: hard cap with admin alert at 80%.
Internal notes in AI context: never (default), or admin opt-in per org? Recommendation: admin opt-in per org, off by default. Even when on, redact PII.

Content blocks needed:

AI client architecture: single entry point in src/infrastructure/ai/, model dispatch by tier.
Three surfaces (public KB chat, customer chat, admin chat) with strict data access matrix.
Defenses: input validation, injection scoring, PII redaction, output filtering, rate limits, token budget.
AI features: ticket summary, categorize, suggest reply, smart assignment, KB draft from ticket.
Audit logging (hashes only, never bodies).
Per-org AI config UI: enable/disable, data access toggles, system instructions, model selection per feature.


Area 15: Email-to-Ticket and Outbound Email
Decisions to lock:

Inbound provider: Microsoft Graph (current) only, or add SMTP IMAP polling fallback? Recommendation: Graph as primary, IMAP fallback in v1 for orgs without M365.
Outbound: Resend as primary, Microsoft Graph for tenants who want messages from their own domain? Recommendation: yes, Graph optional per tenant.
Sender verification: require domain verification (SPF/DKIM/DMARC) before allowing custom-domain outbound? Recommendation: yes, mandatory.
Bounce handling: hard bounce after 3 attempts marks user email as email_invalid? Recommendation: yes, prevents repeated send failures.

Content blocks needed:

Inbound architecture: Graph webhook → /api/webhooks/graph → process → ticket create or comment append.
Threading: parse Message-ID, In-Reply-To, References. Match by Message-ID first, fall back to subject heuristic.
Stub user creation for unknown senders.
Spam handling: SPF/DKIM/DMARC check, drop suspicious without bounce.
Outbound outbox pattern (already in master plan).
Per-tenant from-address configuration.
Bounce processing.


Area 16: Notifications and Real-time
Decisions to lock:

In-app notifications: stored in DB and surfaced in bell, or ephemeral? Recommendation: DB-stored, with read/unread state.
Push: VAPID self-host or use Pusher Beams? Recommendation: self-host (web-push library), one less dependency.
Notification digest: daily, weekly, both? Recommendation: both, configurable, default off.
Mention notifications: trigger on @username in agent comment regardless of role? Recommendation: yes; the user must have visibility on the ticket.

Content blocks needed:

Notification categories matrix (per user x channel x category).
Real-time pipeline (Vercel write → HMAC POST to VPS → Socket.io broadcast → client update).
Presence on ticket rooms: 60s TTL, 30s heartbeat.
Quiet hours logic (timezone-aware).
Web push subscription flow (user opts in, VAPID key exchange, subscription stored).
Email digest cron with templated rollups.
Notification preferences UI.


Area 17: Reporting and Analytics
Decisions to lock:

Reports v1 scope:

SLA compliance (per priority, per team, per agent).
Volume (tickets created/resolved by day/week/month).
CSAT (per agent, per category, with comments).
Agent performance (handle time, FCR, response time).
KB analytics (article views, helpful votes, search misses).


Custom reports: builder UI in v1, or hardcoded reports? Recommendation: hardcoded core 5 in v1; builder in v2.
Export: CSV always; PDF? Recommendation: never (rule already locked: no PDF anywhere).
Real-time vs cached: most reports cached with 5-min stale-while-revalidate. CSAT real-time. Recommendation: this split.

Content blocks needed:

Five report pages with filters (date range, team, agent, priority, category).
Charts using Recharts; consistent visual style with design system.
CSV export per report (signed URL, async if dataset > 10k rows).
Scheduled email reports (weekly summary to admins, configurable).
Drill-down from chart to ticket list filtered by clicked dimension.


Closing area: Implementation Roadmap
After Areas 1-17 are all locked, the master plan's Section 9 (Build Sequence) becomes the runbook. Update it once with any deltas from the deep dives.
Tracking artifact: a single ATLAS_REBUILD_SPEC.md in the repo root that lives as the source of truth, with one section per area. Each merged PR references the area number it implements.

How to use this with Claude Code when rate limit clears
For each remaining area, paste this into Claude Code:

We're at Area X of 17 in the Atlas brainstorm. Here is the locked context from earlier areas: [paste the lock summary]. Here are the decisions and content blocks for Area X: [paste the relevant skeleton above]. Confirm or adjust each decision, then produce the deep-dive HTML for the visual companion.

That keeps each area focused, prevents the brainstorm from drifting, and lets Claude Code build on what's already locked rather than re-deriving it.