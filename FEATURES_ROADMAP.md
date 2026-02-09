# AGR Support Platform - Feature Roadmap

## Phase 1: Core Experience (Immediate Value) ✅

### 1. Real-time Notifications System ✅
- WebSocket connections for live updates
- Browser push notifications
- In-app notification center
- Email digests for offline users
- Notification preferences per user

### 2. Knowledge Base System ✅
- Rich text article editor (Markdown & HTML)
- Categories and tags
- Public/private article visibility
- Article analytics (views, helpful/not helpful)
- Related articles suggestions

### 3. Enhanced Ticket Features ✅
- @mentions in comments
- Ticket watch/follow functionality
- Draft tickets (save without submitting)
- Ticket templates for common issues
- Custom fields per organization
- Ticket linking (related, duplicate, blocks, blocked_by)
- Ticket merging

### 4. Advanced Analytics Dashboard ✅
- Real-time metrics widget
- Ticket volume trends
- Agent performance metrics
- SLA compliance charts
- Customer satisfaction tracking

---

## Phase 2: AI & Automation ✅

### 5. AI-Powered Assistance ✅
- Auto-categorization using ML
- Sentiment analysis on tickets
- Smart response suggestions
- Duplicate ticket detection
- Auto-prioritization
- Smart agent assignment

### 6. Visual Workflow Builder ✅
- Drag-and-drop automation rules
- Time-based triggers
- Conditional logic
- Escalation policies
- SLA warnings and breach handling

---

## Phase 3: Extensibility ✅

### 7. Webhook System ✅
- Event-driven webhooks (ticket.created, ticket.updated, etc.)
- Custom payload templates
- HMAC signature verification
- Retry with exponential backoff
- Delivery status tracking
- Webhook testing and debugging

### 8. Internal Groups & RBAC ✅
- Platform-level admin groups
- Organization-level admin groups
- Granular role-based access control
- Internal group memberships
- Role types: SUPER_ADMIN, ADMIN, SECURITY_ADMIN, etc.

---

## Phase 4: Enterprise Features ✅

### 9. Security & Compliance ✅
- Two-factor authentication (2FA) with TOTP
- Session tracking and management
- Audit logging (immutable)
- Data retention policies
- GDPR compliance (anonymization)
- Password reset functionality

### 10. Asset Management ✅
- Asset inventory (AP, Switch, Firewall, Camera, etc.)
- Site and area management
- Asset-ticket linking
- Asset status tracking

### 11. Services & Request Types ✅
- Service catalog with status pages
- Custom request types
- Dynamic form schemas
- Service-level SLA policies

### 12. Data Management ✅
- Data exports (CSV/JSON)
- Storage quotas
- Virus scanning for attachments
- Bulk operations on tickets

---

## Phase 5: Advanced Features 🆕

### 13. Customer Satisfaction (CSAT) System ✅
- Automated post-resolution surveys
- 1-5 star rating system
- Optional comment feedback
- Response rate analytics
- Reminder emails for non-responders
- CSAT dashboard with trends

### 14. Time Tracking ✅
- Start/stop timer on tickets
- Manual time entry
- Billable vs non-billable hours
- Hourly rate configuration
- Time rounding options
- Auto-pause on ticket resolution
- Uninvoiced time reports

### 15. Scheduled Tickets ✅
- Schedule tickets for future creation
- Recurring ticket patterns (daily, weekly, monthly)
- Timezone support
- Bulk schedule management
- Integration with automation rules

### 16. Customizable Dashboard Widgets ✅
- Drag-and-drop dashboard layout
- Widget types:
  - Ticket count overview
  - SLA compliance gauge
  - Assigned to me
  - Unassigned tickets
  - CSAT score
  - Time tracked
  - Activity feed
  - Priority/Status breakdown
- Refresh intervals
- Personal and organization-wide dashboards

### 17. Bulk Operations ✅
- Bulk assign tickets
- Bulk status changes
- Bulk priority updates
- Bulk tag add/remove
- Bulk close tickets
- Operation status tracking
- Partial success handling

---

## Phase 6: Future Enhancements (Planned)

### 18. Live Chat Widget
- Real-time chat support
- Chat-to-ticket conversion
- Typing indicators
- File sharing in chat

### 19. Advanced Reporting
- Custom report builder
- Scheduled reports
- Export to PDF/Excel
- Trend analysis

### 20. Mobile Experience
- PWA support
- Mobile-optimized UI
- Push notifications
- Offline mode

### 21. API & Integrations
- REST API with full CRUD
- GraphQL endpoint
- API key management
- Zapier/Make.com integrations
- Slack/Teams notifications

### 22. AI Enhancements
- Auto-translation
- Smart ticket summarization
- Knowledge base article suggestions
- Voice-to-text for comments

### 23. Advanced SLA
- Calendar-based SLA (business hours)
- Multiple SLA policies per org
- SLA pause during wait times
- Breach prediction

---

## Technical Improvements

### Performance ✅
- Redis caching layer
- Database query optimization
- Image optimization
- CDN integration
- Connection pooling

### Security ✅
- Audit logging
- Data encryption at rest
- Advanced RBAC
- Session management improvements
- 2FA support

### UX/UI ✅
- Dark mode (partial)
- Keyboard shortcuts
- Bulk operations
- Advanced search with filters
- Customizable dashboards

---

## Implementation Status Summary

| Phase | Status | Features |
|-------|--------|----------|
| Phase 1 | ✅ Complete | Notifications, KB, Enhanced Tickets, Analytics |
| Phase 2 | ✅ Complete | AI Features, Workflow Automation |
| Phase 3 | ✅ Complete | Webhooks, Internal Groups |
| Phase 4 | ✅ Complete | Security, Assets, Services, Data Management |
| Phase 5 | ✅ Complete | CSAT, Time Tracking, Scheduled Tickets, Dashboards, Bulk Ops |
| Phase 6 | 🔄 Planned | Live Chat, Advanced Reporting, Mobile, API, AI Enhancements |

---

## Database Migrations

To apply the new Phase 5 features, run:

```bash
# Apply the Phase 5 migration
psql $DATABASE_URL -f drizzle/0026_new_features_phase5.sql

# Or using drizzle-kit (if configured)
pnpm db:migrate
```

## API Endpoints

### CSAT
- `GET /api/csat?orgId={id}` - List CSAT surveys
- `GET /api/csat/[token]` - Get survey by token
- `POST /api/csat/[token]` - Submit CSAT response

### Time Tracking
- `GET /api/time-tracking?view=active` - Get active timer
- `GET /api/time-tracking?ticketId={id}` - Get ticket time entries
- `POST /api/time-tracking` - Start/stop/pause timer or add manual entry

### Webhooks
- `GET /api/webhooks?orgId={id}` - List webhooks
- `POST /api/webhooks` - Create webhook
- `GET /api/webhooks/[id]` - Get webhook details
- `PATCH /api/webhooks/[id]` - Update webhook
- `DELETE /api/webhooks/[id]` - Delete webhook
- `GET /api/webhooks/[id]/deliveries` - Get delivery history

### Scheduled Tickets
- `GET /api/scheduled-tickets?orgId={id}` - List scheduled tickets
- `POST /api/scheduled-tickets` - Create scheduled ticket
- `GET /api/scheduled-tickets/[id]` - Get scheduled ticket
- `PATCH /api/scheduled-tickets/[id]` - Update scheduled ticket
- `DELETE /api/scheduled-tickets/[id]` - Cancel/delete scheduled ticket

### Dashboard
- `GET /api/dashboard` - Get user widgets
- `GET /api/dashboard?view=widget_data&type={type}` - Get widget data
- `POST /api/dashboard/widgets` - Create widget or reorder
- `PATCH /api/dashboard/widgets` - Update widget
- `DELETE /api/dashboard/widgets?id={id}` - Delete widget

### Bulk Operations
- `GET /api/bulk-operations?orgId={id}` - List operations
- `POST /api/bulk-operations` - Create bulk operation
- `GET /api/bulk-operations/[id]` - Get operation status
- `POST /api/bulk-operations/[id]` - Execute pending operation

### Cron Jobs
- `GET /api/cron/scheduled-tickets` - Process due scheduled tickets
- `GET /api/cron/csat-reminders` - Send CSAT reminders

