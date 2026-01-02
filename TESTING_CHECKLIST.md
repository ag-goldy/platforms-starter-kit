# AGR Support - Testing Checklist

## ✅ Authentication & Access

### Login
- [ ] Login with `admin@agr.com` / `admin123` - should work
- [ ] Login with `customer@acme.com` / `customer123` - should work
- [ ] Try wrong password - should show error
- [ ] Try non-existent email - should show error
- [ ] Logout button works
- [ ] Session persists on page refresh

### Authorization
- [ ] `/app/*` routes require login (redirect to `/login`)
- [ ] Internal users can access `/app`
- [ ] Non-authenticated users cannot access `/app`

---

## 🎫 Internal Console (`/app`)

### Ticket Queue/List (`/app`)
- [ ] Page loads without errors
- [ ] Shows list of tickets (if any exist)
- [ ] Empty state shows when no tickets
- [ ] Ticket cards display: key, subject, status, priority, org, assignee
- [ ] Click ticket card navigates to detail page
- [ ] "New Ticket" button opens the create ticket form
- [ ] Filters and search update the list and URL query params

### Ticket Detail (`/app/tickets/[id]`)
- [ ] Page loads for a ticket
- [ ] Shows ticket key, subject, description
- [ ] Shows status badge (can change status via dropdown)
- [ ] Shows priority badge (can change priority via dropdown)
- [ ] Shows requester and assignee info
- [ ] Timeline shows comments (public)
- [ ] Can add new comment
- [ ] Can mark comment as internal (checkbox)
- [ ] Internal notes section shows (if internal comments exist)
- [ ] Status change persists
- [ ] Priority change persists
- [ ] Comments save successfully

### Organizations (`/app/organizations`)
- [ ] Page loads
- [ ] Shows list of organizations
- [ ] Can click org to view details (if implemented)
- [ ] "New Organization" button opens create form
- [ ] Can invite user and change role on org detail page

---

## 🌐 Customer Portal (`acme.localhost:3000` or subdomain)

### Customer Tickets (`/s/[subdomain]/tickets`)
- [ ] Access customer portal via subdomain
- [ ] Requires login
- [ ] Shows tickets for logged-in customer's org only
- [ ] Cannot see other orgs' tickets
- [ ] "New Ticket" button visible

---

## 📝 Public Ticket Intake (`/support`)

### Submit Ticket
- [ ] `/support` page loads (no login required)
- [ ] Form fields: email, subject, description
- [ ] Can submit ticket
- [ ] Redirects to success page
- [ ] Success page shows ticket number
- [ ] Email sent (check console logs for email output)

### Magic Links
- [ ] Email contains magic link
- [ ] Magic link works to view ticket
- [ ] Magic link is secure (can't access other tickets)

---

## 🔒 Security & Data Isolation

### Organization Isolation
- [ ] Internal users can see all tickets
- [ ] Customer users only see their org's tickets
- [ ] Customer users cannot access other orgs' tickets via URL manipulation
- [ ] Customer users cannot access `/app` (internal console)

### Authorization Checks
- [ ] Status changes require internal role
- [ ] Priority changes require internal role
- [ ] Assignment requires internal role
- [ ] Adding comments works for authorized users
- [ ] Unauthorized actions show appropriate errors

---

## 💾 Database & Data

### Seed Data Verification
- [ ] Admin user exists: `admin@agr.com`
- [ ] Customer user exists: `customer@acme.com`
- [ ] Organization "Acme Corporation" exists
- [ ] Organization "Unassigned Intake" exists
- [ ] Customer user has membership in Acme org

### Data Persistence
- [ ] Created tickets persist in database
- [ ] Status changes persist
- [ ] Comments persist
- [ ] Data loads correctly on page refresh

---

## 🐛 Error Handling

### Graceful Failures
- [ ] Invalid ticket ID shows 404
- [ ] Unauthorized access shows error (not crash)
- [ ] Network errors handled gracefully
- [ ] Form validation shows errors
- [ ] Server errors don't expose sensitive info

---

## 📧 Email (Console Fallback)

### Email Notifications
- [ ] Public ticket creation sends email (check console)
- [ ] Email format is readable in console
- [ ] Email includes relevant ticket info

---

## 🎨 UI/UX

### Design
- [ ] Pages load without layout shift
- [ ] Colors/contrast are readable
- [ ] Buttons are clearly clickable
- [ ] Forms are usable
- [ ] Error messages are visible
- [ ] Success feedback is clear

### Navigation
- [ ] Internal console navigation works
- [ ] Back button works
- [ ] Links navigate correctly
- [ ] No broken links

---

## 🚀 Quick Test Flow

### Happy Path Test
1. ✅ Login as admin: `admin@agr.com` / `admin123`
2. ✅ View ticket queue at `/app`
3. ✅ Create a test ticket (via public form or manually if needed)
4. ✅ View ticket detail
5. ✅ Change ticket status
6. ✅ Change ticket priority
7. ✅ Add a comment (public)
8. ✅ Add an internal note
9. ✅ Logout
10. ✅ Login as customer: `customer@acme.com` / `customer123`
11. ✅ Access customer portal (subdomain)
12. ✅ View customer tickets
13. ✅ Submit public ticket at `/support`
14. ✅ Verify email sent (console)

---

## 📝 Known Limitations (Not Bugs)

These are features not yet implemented (per IMPLEMENTATION_STATUS.md):

- ❌ File attachments (schema exists, no UI)
- ❌ Email provider integration (console fallback only)
- ❌ Automated test suite

---

## 🔧 Troubleshooting

### If login doesn't work:
1. Check server logs for `[Auth]` messages
2. Verify user exists in database: run seed script again
3. Check NEXTAUTH_SECRET is set
4. Clear browser cookies/session

### If tickets don't show:
1. Check database connection
2. Verify seed script ran successfully
3. Check browser console for errors
4. Verify user has correct permissions

### If pages don't load:
1. Check server is running: `pnpm dev`
2. Check for TypeScript errors: `pnpm exec tsc --noEmit`
3. Check browser console for errors
4. Check server logs for errors

---

## 🎯 Priority Tests for MVP

**Must Work:**
1. ✅ Admin login
2. ✅ View ticket list
3. ✅ View ticket detail
4. ✅ Change ticket status
5. ✅ Add comments
6. ✅ Customer login
7. ✅ Public ticket submission

**Nice to Have:**
- Customer portal access
- Organization management
- Email notifications
