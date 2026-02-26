# Platforms Starter Kit - Feature Roadmap

## ✅ Recently Completed

### Email System
- [x] Microsoft Graph API integration (M365)
- [x] Email templates with AGR Networks branding
- [x] Invitation emails for organization access
- [x] Password reset flow
- [x] Email outbox queue with retry logic
- [x] `USE_EMAIL_JOBS` configuration for immediate delivery

### KB Articles
- [x] Delete KB article option (admin list + edit page)
- [x] Confirmation dialogs for destructive actions

### Assets
- [x] Basic asset inventory
- [x] Link assets to tickets
- [x] Asset status tracking

---

## 🔧 Immediate Fixes Needed

### Database Migration
- [x] Applied `023_add_zabbix_to_services.sql`
- [x] Added `zabbix_host_id`, `zabbix_host_name`, `zabbix_triggers` columns

---

## 📋 Planned Features (Priority Order)

### 1. Zabbix Integration Enhancement ⭐ HIGH PRIORITY

#### 1.1 Admin Zabbix Settings Page
**Purpose:** Configure Zabbix connection per organization

**Features:**
- Add/Edit Zabbix API configuration (URL, API Token)
- Test connection button
- Sync interval settings (5min, 15min, 30min, 1hr)
- Enable/disable monitoring per org
- View sync status and last sync time
- Manual sync trigger

**Page Location:** `/app/admin/zabbix` or `/app/settings/integrations/zabbix`

**Database:** Uses existing `zabbix_configs` table

#### 1.2 Service-Zabbix Host Linking
**Purpose:** Link services to Zabbix hosts for monitoring

**Features:**
- Search and select Zabbix host when creating/editing service
- Display Zabbix host status on service cards
- Show current monitoring status (UP/DOWN/UNKNOWN)
- Display uptime percentage and response time

#### 1.3 Customer Portal Service Status
**Purpose:** Show real-time service status to customers

**Features:**
- Public service status page per organization
- Status indicators (Green/Yellow/Red)
- Incident history from Zabbix triggers
- Uptime statistics (last 30 days)
- Subscribe to status updates

### 2. Asset Management Enhancement ⭐ HIGH PRIORITY

#### 2.1 Archive Assets
**Purpose:** Hide inactive assets without deleting them

**Features:**
- "Archive" button on asset detail page
- Archived assets hidden from default list view
- Filter toggle: "Show Archived"
- Archived assets shown with grayed-out styling
- Unarchive option

**Database Changes:**
```sql
ALTER TABLE assets ADD COLUMN archived BOOLEAN DEFAULT FALSE;
ALTER TABLE assets ADD COLUMN archived_at TIMESTAMP;
ALTER TABLE assets ADD COLUMN archived_by UUID REFERENCES users(id);
```

#### 2.2 Delete Assets
**Purpose:** Permanently remove assets

**Features:**
- Delete button with confirmation dialog
- Check for linked tickets before deletion
- Option to reassign linked tickets to another asset
- Soft delete vs Hard delete consideration
- Audit log entry

#### 2.3 Asset Bulk Operations
**Features:**
- Bulk archive/delete
- Bulk status updates
- Bulk site/area reassignment
- Export to CSV

#### 2.4 Asset Types & Custom Fields
**Features:**
- Define asset types (Server, Network, Workstation, etc.)
- Custom fields per asset type
- IP Address tracking
- Serial numbers
- Warranty expiration dates
- Associated vendor/support info

### 3. Customer Portal Modules Enhancement

#### 3.1 Service Catalog
**Purpose:** Self-service request forms

**Features:**
- Request type templates
- Dynamic forms with conditional fields
- Approval workflows
- Service level definitions per request type
- Automated ticket creation from requests

#### 3.2 Sites & Areas
**Purpose:** Location management

**Features:**
- Site creation (offices, data centers)
- Area/sub-area hierarchy
- Asset assignment to sites/areas
- Site-specific contacts
- Site operating hours
- Location-based ticket routing

#### 3.3 Notices/Banners
**Purpose:** Maintenance and announcement banners

**Features:**
- Create maintenance notices
- Scheduled banner display
- Different notice types: Info, Warning, Critical
- Target specific sites/services
- Acknowledgment tracking

#### 3.4 Exports
**Purpose:** Self-service data export

**Features:**
- Export my tickets (CSV, PDF, Excel)
- Export asset inventory
- Scheduled exports (email delivery)
- Data range selection
- Compliance reporting exports

### 4. Ticket System Enhancements

#### 4.1 Ticket Templates
**Features:**
- Pre-defined ticket templates
- Quick-create from template
- Template categories

#### 4.2 Ticket Scheduling
**Features:**
- Schedule ticket creation for future date
- Recurring tickets (weekly/monthly checks)
- Maintenance window scheduling

#### 4.3 Ticket Dependencies
**Features:**
- Link related tickets
- Block/depends-on relationships
- Parent/child ticket hierarchies
- Bulk status updates for related tickets

#### 4.4 Time Tracking Improvements
**Features:**
- Timer auto-start on ticket open
- Billable vs non-billable time
- Time entry notes
- Time approval workflow
- Invoice generation from time entries

### 5. Automation & Workflows

#### 5.1 Automation Rules Engine
**Purpose:** If-This-Then-That for tickets

**Triggers:**
- Ticket created
- Status changed
- Priority changed
- Assigned to user
- Time-based (SLA approaching)

**Actions:**
- Send email notification
- Assign to user/group
- Change priority/status
- Add tag
- Create related ticket
- Webhook call

#### 5.2 SLA Management
**Features:**
- Define SLA policies per service/request type
- Business hours configuration
- SLA breach alerts
- Escalation rules
- SLA reporting

#### 5.3 Auto-Assignment
**Features:**
- Round-robin assignment
- Load-based assignment
- Skill-based routing
- Territory-based assignment

### 6. Reporting & Analytics

#### 6.1 Dashboard Widgets
**Features:**
- Ticket volume trends
- Average resolution time
- Agent performance metrics
- Customer satisfaction scores
- SLA compliance rates

#### 6.2 Custom Reports
**Features:**
- Report builder UI
- Scheduled report delivery
- Export formats (PDF, CSV, Excel)
- Saved report templates

#### 6.3 Customer Satisfaction (CSAT)
**Features:**
- Post-resolution surveys
- Star ratings
- Comment collection
- CSAT analytics dashboard
- Agent performance based on ratings

### 7. Communication Features

#### 7.1 Real-time Chat
**Features:**
- Embedded chat widget
- Agent chat interface
- Chat-to-ticket conversion
- File sharing in chat
- Chat history

#### 7.2 SMS Notifications
**Features:**
- SMS for urgent tickets
- Two-way SMS replies
- SMS-based ticket updates
- Twilio integration

#### 7.3 Video Calls
**Features:**
- One-click video call from ticket
- Screen sharing
- Call recording
- Jitsi/Zoom integration

### 8. Mobile Experience

#### 8.1 Mobile App (PWA or Native)
**Features:**
- Ticket management on mobile
- Push notifications
- Photo attachment from camera
- Offline mode
- Quick replies

#### 8.2 Responsive Improvements
**Features:**
- Touch-optimized interfaces
- Mobile dashboard
- Swipe gestures for ticket actions

### 9. Advanced Integrations

#### 9.1 Single Sign-On (SSO)
**Providers:**
- SAML 2.0
- OIDC (Google Workspace, Azure AD, Okta)
- SCIM provisioning

#### 9.2 API & Webhooks
**Features:**
- Public API with API keys
- Enhanced webhook events
- Zapier/Make.com integration
- Custom integration marketplace

#### 9.3 Backup & Sync Integrations
**Features:**
- IT Glue integration
- Hudu integration
- ConnectWise Manage sync
- AutoTask sync

### 10. Security & Compliance

#### 10.1 Advanced Security
**Features:**
- IP allowlisting
- Session management (kill sessions)
- Login audit logs
- Suspicious activity detection

#### 10.2 Compliance Features
**Features:**
- Data retention policies
- Automatic data purging
- GDPR data export
- HIPAA compliance mode
- SOC 2 audit trails

---

## 🎯 Implementation Priority Matrix

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P0 | Zabbix Admin Settings | Medium | High |
| P0 | Asset Archive/Delete | Low | High |
| P1 | Service Status Page | Medium | High |
| P1 | SLA Management | High | High |
| P2 | Automation Rules | High | High |
| P2 | CSAT Surveys | Medium | Medium |
| P2 | Notices/Banners | Low | Medium |
| P3 | Real-time Chat | High | Medium |
| P3 | Mobile PWA | High | Medium |
| P4 | SSO/SAML | High | Medium |

---

## 📝 Notes for Implementation

### Asset Management
- Consider soft delete vs hard delete for audit purposes
- Archived assets should still be viewable in ticket history
- Bulk operations need progress indicators for large datasets

### Zabbix Integration
- Store Zabbix API tokens encrypted
- Implement rate limiting for Zabbix API calls
- Cache Zabbix data to reduce API load
- Handle Zabbix connection failures gracefully

### Service Catalog
- Start with 3-5 common request types
- Forms should be configurable without code changes
- Approval workflows need notification system

### Performance Considerations
- Add database indexes for new queries
- Implement pagination for large lists
- Use React Server Components where possible
- Cache frequently accessed data in Redis
