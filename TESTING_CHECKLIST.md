# Atlas Support - Testing Checklist

Use this checklist to verify all services are working correctly.

## 1. Environment & Configuration

- [ ] All required env vars set in `.env.local`
- [ ] Database connection string is valid
- [ ] Auth secret is configured (32+ characters)
- [ ] Email service configured (Graph API or SMTP)

## 2. Database Tests

Run: `npm run test:services`

- [ ] Database connection successful
- [ ] Users exist in database
- [ ] Organizations exist
- [ ] KB articles and categories load
- [ ] Tickets table accessible

## 3. Authentication Tests

### Login Flow
- [ ] Navigate to `/login`
- [ ] Login with `ag@agrnetworks.com` / `Admin@AGR2025!`
- [ ] Redirected to `/app` dashboard
- [ ] Session persists across page refreshes
- [ ] Logout works and clears session

### CSRF Protection
- [ ] No "MissingCSRF" errors in logs
- [ ] Can perform POST actions (create ticket, etc.)

## 4. Email Tests

### Configuration
- [ ] Microsoft Graph API configured OR
- [ ] SMTP configured

### Test Email Send
Run the test script with your email:
```bash
TEST_EMAIL=your-email@example.com npm run test:services
```

- [ ] Test email received in inbox
- [ ] No errors in console logs
- [ ] Email content renders correctly

### Ticket Notifications
- [ ] Create ticket → Email sent to requester
- [ ] Add comment → Email sent to watchers
- [ ] Status change → Email notification sent

## 5. Knowledge Base Tests

### Public KB (`/kb`)
- [ ] Page loads without errors
- [ ] Categories display correctly
- [ ] Articles list shows published articles
- [ ] Article detail page loads
- [ ] Search functionality works

### Admin KB (`/app/kb`)
- [ ] Create new article
- [ ] Edit existing article
- [ ] Create category
- [ ] Global articles visible (null orgId)
- [ ] Org-specific articles visible

## 6. Ticket System Tests

### Create Ticket
- [ ] Navigate to `/app/tickets/new`
- [ ] Fill form and submit
- [ ] Ticket appears in list
- [ ] Ticket key is generated (e.g., `AGR-1234`)
- [ ] Creation date comment added automatically

### Ticket Actions
- [ ] Add public comment
- [ ] Add internal note
- [ ] Change status
- [ ] Assign to user
- [ ] Change priority
- [ ] Upload attachment

### Notifications
- [ ] Comment triggers email notification
- [ ] Status change triggers email
- [ ] Assignment triggers notification

## 7. Admin Pages

- [ ] `/app/admin/health` - Accessible
- [ ] `/app/admin/audit` - Audit logs visible
- [ ] `/app/admin/compliance` - Data retention settings
- [ ] `/app/admin/jobs` - Failed jobs visible (if any)
- [ ] `/app/admin/ops` - Ops dashboard loads
- [ ] `/app/admin/internal-groups` - Groups management

## 8. Customer Portal

- [ ] Navigate to `/s/acme` (or your org subdomain)
- [ ] Create ticket as customer
- [ ] View ticket status
- [ ] Add comment to ticket
- [ ] View KB articles

## 9. Performance Tests

- [ ] Page load time < 2 seconds
- [ ] No loading spinners stuck on navigation
- [ ] Navigation loader appears briefly on page change
- [ ] API responses < 500ms

## 10. Error Handling

- [ ] 404 page shows correctly
- [ ] 500 errors show friendly message
- [ ] Form validation errors display correctly
- [ ] Unauthorized access redirects to login

## Running Automated Tests

```bash
# Test all services
npm run test:services

# Test with specific email
TEST_EMAIL=your-email@example.com npm run test:services

# Build and check for errors
npm run build

# Check TypeScript
npm run type-check
```

## Troubleshooting

### MissingCSRF Error
- Check `AUTH_TRUST_HOST=true` is set
- Verify `trustHost: true` in auth config

### Email Not Sending
- Check Graph/SMTP credentials
- Verify admin consent in Azure AD (for Graph)
- Check Vercel logs for detailed error

### Database Connection Failed
- Verify `DATABASE_URL` format
- Check IP allowlist in database provider
- Ensure SSL mode is correct

### KB Articles Not Showing
- Check articles have `status = 'published'`
- Verify `orgId` is null for global articles
- Check browser console for API errors

## Sign-Off

- [ ] All critical tests passed
- [ ] No console errors
- [ ] No build errors
- [ ] Ready for production

**Tester:** _________________ **Date:** _________________
