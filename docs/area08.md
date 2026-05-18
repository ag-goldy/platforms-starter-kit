Area 8: Customer Portal Experience
Aligned with locked decisions from Areas 1-7. Light mode default, brand-light, role-aware (REQUESTER, VIEWER, ADMIN). Path-based: atlas.agrnetworks.com/{slug}/portal.

8.1 Layout and chrome
Top bar (fixed, 56px):
Org logo (left) + org name. Search field center (/ to focus, opens command palette ⌘K). Right: notification bell with unread count, user avatar dropdown (profile, switch theme, sign out).
Sidebar (collapsible, desktop only, 220px):

Home
My Tickets
New Request (button-style, white surface with orange-tint border, only primary-CTA on the page)
Knowledge
My Assets (only if org.features.assets)
Service Status (only if org.features.status_page)
Team (only if role = ADMIN)
Activity Log (only if role = ADMIN)
Data Exports (only if role = ADMIN)

Mobile: top bar collapses to logo + hamburger. Sidebar items become a bottom sheet. New Request as a bottom-right floating action button.
Modal slot: parallel route @modal for ticket detail, KB article preview, asset detail. Deep-linkable URLs render the same content full-page if loaded directly.

8.2 Home page (/{slug}/portal)
Single column, max-width 960px, generous whitespace.
Sections in order:

Greeting: "Good morning, James. Anything we can help with today?" Time-of-day aware.
New Request CTA: large card with two columns. Left: "Open a new request" with subtitle and primary button. Right: "Browse knowledge base" with subtitle and secondary link.
My open requests (max 5, "View all" link if more): card stack with ticket number (Geist Mono), subject, status pill, age, last update preview. Click opens modal.
Recent updates (live): "James M. replied to TKT-0421 · 5 minutes ago". Real-time via Socket.io.
Helpful articles (4 max, AI-suggested based on user's recent tickets if ai_data_access.kb enabled, else most-popular):
Service Status (only if enabled): inline strip showing operational/degraded/down indicators per service, links to full status page.

Empty states:

No tickets ever: "Welcome to support at {org.name}. Need something? Open your first request."
No tickets currently: "All caught up. We'll be here if you need anything."

8.3 New Request flow
Two-step but pre-loaded so customer can submit on step 1 if they want speed.
Step 1 (always visible):

Subject (autofocus, 200 char limit, char counter shows after 150).
Description (rich text via Tiptap, paste images uploads to Blob with progress indicator).
"Submit" (primary) and "Add details" (secondary, expands step 2).

Step 2 (optional):

Type (dropdown: Incident, Request, Problem, Change). Hidden if org has only one configured type.
Related asset (combobox, autocomplete, scoped to assets the requester is associated with).
Priority hint ("Most requests are Medium. Mark as High only if business is impacted.") with optional Low/Medium/High selector. Critical reserved for agents.
Attachments (drag-drop area, max 10 files, max 25MB each, type whitelist). Pre-upload to Blob with optimistic preview.
Custom fields (rendered from requestType.schema if a request type was selected). Validation per field type.

On submit:

Optimistic state: ticket appears in "My open requests" with pending indicator.
Server action returns { ticket: { number, key } }.
Toast: "Request TKT-0421 received. We'll be in touch shortly."
Confirmation email enqueued.
If form invalid: inline errors per field, focus moves to first error, screen-reader announces error count.

Service catalog mode (if org.features.service_catalog):

New Request opens a category grid first (Reset password, Order new laptop, Wifi issue, etc.) with icons and descriptions.
Selecting a category loads the matching request_type schema and goes directly to a tailored form.
"Other" tile always present, falls through to the generic free-form flow above.

8.4 My Tickets list
Two tabs: Open (default), Closed. URL state persists tab and filters.
List item:

Ticket number (Geist Mono, 12px, muted)
Subject (16px, primary text, single line truncate)
Status pill + priority chip
Last update (relative: "Sarah replied 2h ago")
Unread indicator (bold subject + small orange dot if unread reply since last view)

Filters (dropdown):

Status (multi-select)
Priority (multi-select)
Asset (combobox, only assets you're tied to)
Date range
Search (subject + body, debounced 300ms)

Empty state:

"No open requests" with link to New Request.

Real-time:

New ticket appears with slide-in if user creates one in another tab.
Status change updates pill in-place with brief flash animation.
New reply marks ticket as unread (orange dot) and bumps to top.

8.5 Ticket detail (modal or full-page)
Header:

Back arrow / close button.
Ticket number + subject.
Status pill + priority chip.
Created date (relative + tooltip absolute).
Action buttons: Reply (primary), Close (secondary, only if status not already closed/resolved), Subscribe/Unsubscribe (icon).

Conversation thread:

Customer messages: right-aligned, light orange-tint background, name and time below.
Agent messages: left-aligned, neutral surface, name + role badge ("Agent · Sarah K.") and time below.
System messages (status changes, assignments): full-width, italic, small, muted with icon.
Internal notes: NEVER shown.
Attachments: thumbnails with filename + size, click to open in new tab via signed URL.
Each message has a permalink anchor.

Reply composer (sticky bottom):

Tiptap editor: bold, italic, list, link, attach.
Submit on ⌘↵. Shift+Enter for newline.
Optimistic: reply appears immediately with "Sending..." state, replaced when server confirms.
Failed: error pill with retry button.
"Mark as resolved on send" checkbox if customer thinks issue is fixed.

Sidebar (right, desktop only) or expandable section (mobile):

Status: pill + agent's typing indicator if active.
Assignee: avatar + name (read-only).
Asset: linked asset card if present, click to view asset detail.
Created / Last updated.
CSAT prompt (if status=resolved and not yet rated): inline 1-5 rating.

When closing your own ticket:

Confirm dialog: "Mark this request as resolved? You can reopen it by replying."
Posts a system message: "James M. marked this resolved."
CSAT prompt appears.

When status becomes resolved by agent:

Banner appears at top of thread: "Sarah marked this resolved. Was this helpful?" with inline 1-5 rating.
If not rated within 1 hour, email CSAT survey enqueued (per Area 4.9 in master plan).

8.6 Knowledge Base browse (/{slug}/portal/kb)
Search-first homepage:

Large search bar at top (autofocus on page load), placeholder "How can we help?".
Results appear inline as user types (300ms debounce). Each result card: title (highlighted match), category breadcrumb, snippet with match highlights, helpful-vote count.
Below search: category tiles (icon + name + article count).
"Popular this week" carousel of 5-8 articles.
"Recently updated" section.

Article view (/{slug}/portal/kb/{slug}/{article}):

Breadcrumb: KB > Category > Article.
Title (h1).
Meta strip: last updated, author name (if org.kb.show_author), reading time estimate.
Body: prose, max-width 720px, code blocks with copy button, images with lightbox.
Sticky table of contents on right (desktop only) generated from h2/h3.
Bottom: "Was this helpful?" thumbs up/down.
If thumbs down: textarea "What was missing?" + "Open a request about this" button (pre-fills new ticket form with article reference + their comment).
"Related articles" section.

Restricted articles:

Hidden from search and category lists if user not in allowed teams.
Direct link returns 404 (do not reveal existence).

8.7 My Assets (if enabled)
Only assets where the requester is assigned_to_user_id or where their org has elected to show all org assets to all members.
Grid view by default, list view toggle. Each card:

Asset name + tag (Geist Mono).
Type icon.
Status pill.
Location.
"Report issue" button (one-click, opens new ticket form pre-filled with asset).
Click opens asset detail modal: full specs, lifecycle events visible to customer (assigned, repaired, returned), related tickets the requester has visibility on.

8.8 Team management (ADMIN only) /{slug}/portal/team
Two tabs: Members, Invites.
Members tab:

Table: avatar, name, email, role, status (active, deactivated), last seen.
Search by name/email.
Filter by role.
Row actions: change role (dropdown, role-bounded), deactivate, view activity.
Bulk select for deactivate.

Invites tab:

Table: email, role, sent at, expires at, status (pending, accepted, revoked).
Row actions: resend, revoke.
"Invite member" button opens dialog: email, role (constrained: a CUSTOMER_ADMIN can only invite REQUESTER or VIEWER), team (optional), submit.
On submit: magic-link invite created and sent. Toast: "Invitation sent to email@example.com."

Activity log (/{slug}/portal/activity):

Read-only audit log of tenant actions (no platform-level entries).
Columns: actor, action, resource, timestamp, IP if org.settings.show_ip_in_activity.
Filters: actor, action type, date range.
Export CSV (signed URL, async job, emailed when ready).

8.9 Data and exports (ADMIN only) /{slug}/portal/data
Three sections:
Export tenant data (GDPR/PDPA):

"Request export" button. Confirmation dialog explaining what's included.
Job runs on VPS, ZIP delivered via signed URL (7-day validity, single-use).
Rate limited 1 per 24h per org.
Past exports listed with timestamp, status, expiry.

Right to erasure (per-user, owner only):

Email field + reason textarea.
Type the user's email to confirm.
Warning: "This anonymizes the user's PII across your tenant within 72 hours. The user record remains for audit integrity. Tickets and KB feedback they created will be retained but stripped of personal data. This cannot be undone."
On submit: enqueue erasure job, audit log entry, confirmation email to org owner.

Tenant-level deletion (owner only):

Greyed unless owner.
"Schedule tenant deletion" button.
Confirmation requires re-auth (password + 2FA).
30-day grace period; tenant marked status=deleted but recoverable. Banner appears on all tenant pages with countdown.
Recoverable from /admin panel by platform admin during grace.

8.10 Profile and security (/{slug}/portal/me)
Tabs: Profile, Notifications, Security, Sessions.
Profile: name, avatar (upload, crop), display preferences (theme: light/dark/system, density), language, timezone.
Notifications: matrix of categories x channels (email, in-app, push). Quiet hours (start/end time + days). Mute org tickets entirely toggle. Test notification button.
Security:

Password (change requires current).
2FA: enable/disable with TOTP setup flow (per Area 6 spec, password re-confirm required).
Backup codes: regenerate (invalidates old).
Passkeys: list with name, registered date, last used. Add new (WebAuthn flow), rename, revoke.

Sessions:

List of active sessions: device summary, location (IP geolocation), last active, current.
"Revoke" per session.
"Sign out all other devices" button.

8.11 Customer onboarding (first invite acceptance)
Flow when an end-user accepts their first magic-link invite:

Land on /invite?token=. Token validated.
If new user: collect name, set password OR register passkey (one required), optional 2FA setup.
Accept terms checkbox + privacy policy link.
Land on /{slug}/portal with welcome banner: "Welcome to support at {org.name}. Here are some things you can do."
Inline 4-card tour: New Request, My Tickets, Knowledge, Profile. Dismissible.

For existing users (already have account, accepting invite to a new org): skip account setup, just confirm and add membership.

8.12 Real-time touchpoints in the portal
Less aggressive than agent UI; respect that customers are casual users.

New replies on a ticket they have open: subtle dot in the bell + toast if the ticket detail is open.
Ticket status change: status pill animates the change.
Service status updates (if status page enabled): inline banner if any service degrades while user has the portal open.
No presence indicators (customer doesn't need to know who's viewing).
No typing indicators in the customer-facing thread (would create awkward dynamics with agent drafting time).

8.13 Light mode design notes (carries forward Area 4 locked decisions)
Surfaces (light mode default for portal):

Page background: #FAFAFA.
Card surface: #FFFFFF with 1px solid #E5E5E5.
Primary text: #0A0A0A.
Secondary text: #525252.
Brand accent (#FF6600): used only for the New Request CTA, the focus ring, the active nav stripe, and the SLA progress fill if visible.
Dark mode toggle in user settings switches to the agent dark palette (#0D0D0D base) for users who prefer it.

Typography stays Inter UI + Geist Mono for ticket numbers and asset tags. Same scale as Area 4.
Status pills (light mode adjusted):

OPEN: blue background #EFF6FF, text #1E40AF.
IN_PROGRESS: amber #FEF3C7 / #92400E.
PENDING_CUSTOMER: orange #FFEDD5 / #9A3412.
PENDING_INTERNAL: purple #F3E8FF / #6B21A8.
RESOLVED: green #DCFCE7 / #166534.
CLOSED: neutral #F5F5F5 / #525252.
BREACHED_SLA: red #FEE2E2 / #991B1B.

8.14 Accessibility specifics for the portal
In addition to the WCAG 2.2 AA requirements from Area 6 of the master plan:

Skip link "Skip to main content" first focusable on every page.
Form labels always visible (placeholder is not a label).
Errors announced via aria-live=assertive and associated to the field via aria-describedby.
The rich text editor exposes a plain-text fallback toggle (Use plain text) for users on assistive tech that struggles with contenteditable.
All ticket pills include both color + icon + text.
Ticket list rows are real <button> elements (not div-with-click) so screen readers announce them properly.
Modal open: focus moves to the modal's title, return-to-trigger on close.
Drag-drop attachment area has a "Choose files" button as the primary path; drop is enhancement.

8.15 Acceptance criteria for Area 8

A new end-user can be invited, accept, set up account, and submit a ticket in under 90 seconds on a fast connection.
A customer admin can invite a teammate and see them appear as Pending in the Invites tab immediately.
A customer can find an answer in KB and either resolve their question or escalate to a ticket without leaving the portal.
The portal at 320px viewport width is fully functional (no horizontal scroll, all actions reachable).
Light mode passes WCAG AA contrast on every interactive element.
Real-time reply appears within 500ms of agent send (p95).
New Request submission, when network is slow (3G simulation), still feels responsive thanks to optimistic UI.
All copy uses no em dashes.

End of Area 8. Next: Area 9 (Platform Admin Console).
