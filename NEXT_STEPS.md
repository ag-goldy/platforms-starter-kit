# Next Steps - Priority Order

## ✅ Completed
- ✅ Authentication (admin & customer)
- ✅ Internal console (ticket list, detail, actions, creation)
- ✅ Organization management (create orgs, invite users, manage roles)
- ✅ Customer portal (list, detail, create, reply)
- ✅ Public ticket intake + magic link access
- ✅ Rate limiting on public intake
- ✅ Ticket filters (status, priority, org, assignee, search)
- ✅ Audit log view on ticket detail
- ✅ Assignee picker for internal users

---

## 🔨 High Priority - Production Readiness

### 1. Attachments
**Status:** Not implemented

**What's needed:**
- [ ] File upload interface
- [ ] Storage integration (S3, Vercel Blob, etc.)
- [ ] Attachment display on ticket detail

---

### 2. Email Provider Integration
**Status:** Console fallback only

**What's needed:**
- [ ] Configure SMTP or email provider (Resend/SendGrid)
- [ ] Ensure deliverability and templates in production

---

### 3. Automated Tests
**Status:** Not implemented

**What's needed:**
- [ ] Unit tests for permissions and ticket key generation
- [ ] Org isolation tests
- [ ] Basic integration tests for ticket flows

---

## 🎯 Medium Priority - Enhancements

### 4. Improved Error Handling
- [ ] Friendly UI errors and inline validation
- [ ] Error boundaries for internal console and customer portal

### 5. Keyboard Shortcuts
- [ ] Quick actions for internal agents
- [ ] Shortcuts for status/priority updates

---

## 🚀 Recommended Next Steps

**Option 1: Attachments (Best for customer value)**
1. File upload UX
2. Storage integration
3. Display attachments in ticket timeline

**Option 2: Email Provider (Best for production readiness)**
1. SMTP/provider integration
2. Template tuning
3. Delivery monitoring

**Option 3: Testing (Best for long-term stability)**
1. Permissions + ticket key unit tests
2. Org isolation tests
3. Basic integration suite
