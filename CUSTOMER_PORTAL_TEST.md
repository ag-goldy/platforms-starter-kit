# Customer Portal Testing Guide

## Test 1: Customer Login & Redirect ✅
**Expected:** Customer user logs in and is redirected to their portal (not `/app`)

**Steps:**
1. Go to http://localhost:3000/login
2. Login with: `customer@acme.com` / `customer123`
3. Should redirect to: `http://localhost:3000/s/acme/tickets`

**Status:** ✅ PASS (verified in previous session)

---

## Test 2: Customer Ticket List Page ✅
**Expected:** Customer sees only their own tickets from their org

**Steps:**
1. Login as customer (if not already)
2. Visit: http://localhost:3000/s/acme/tickets
3. Should see "My Tickets" heading
4. Should see "New Ticket" button
5. Should see list of tickets (if any exist)
6. Should NOT see tickets from other orgs

**What to verify:**
- Page loads without errors
- Only tickets for customer@acme.com are shown
- Ticket list shows: key, subject, status, priority
- Clicking a ticket navigates to detail page

---

## Test 3: Customer Ticket Detail Page ✅
**Expected:** Customer can view ticket details and conversation

**Steps:**
1. From ticket list, click on a ticket
2. Should navigate to `/s/acme/tickets/[ticket-id]`
3. Should see ticket key, subject, description
4. Should see status and priority badges
5. Should see conversation thread (public comments only)
6. Should see "Add a Reply" form at bottom
7. Should NOT see internal notes

**What to verify:**
- All ticket details are visible
- Only public comments shown (no internal notes)
- Back button works

---

## Test 4: Customer Create Ticket ✅
**Expected:** Customer can create a new ticket

**Steps:**
1. From ticket list, click "New Ticket"
2. Should navigate to `/s/acme/tickets/new`
3. Fill in form:
   - Subject: "Test ticket from customer"
   - Description: "This is a test ticket"
   - Priority: P3 (or any priority)
4. Click "Create Ticket"
5. Should redirect to ticket detail page
6. New ticket should appear in ticket list

**What to verify:**
- Form validates required fields
- Ticket is created with correct org
- Ticket is assigned to logged-in customer
- Redirect works correctly
- New ticket appears in list

---

## Test 5: Customer Add Comment ✅
**Expected:** Customer can add public replies to tickets

**Steps:**
1. Navigate to a ticket detail page
2. Scroll to "Add a Reply" section
3. Type a comment: "This is a test reply"
4. Click "Send Reply"
5. Comment should appear in conversation thread
6. Page should refresh showing new comment

**What to verify:**
- Comment is saved successfully
- Comment appears in conversation (after refresh)
- Comment is public (visible to internal users)
- Cannot add internal notes (no checkbox)

---

## Test 6: Organization Isolation ✅
**Expected:** Customer cannot access other orgs' tickets

**Steps:**
1. Login as customer@acme.com
2. Try to access: http://localhost:3000/s/other-org/tickets
3. Should show 404 or access denied

**What to verify:**
- Cannot access other org subdomains
- URL manipulation doesn't work
- Only own org tickets visible

---

## Test 7: Customer Cannot Access Internal Console ✅
**Expected:** Customer redirected away from `/app` routes

**Steps:**
1. Login as customer
2. Try to access: http://localhost:3000/app
3. Should redirect to customer portal

**What to verify:**
- Redirect happens automatically
- No access to internal console
- Authorization errors don't show

---

## Quick Test Script

Run these commands to verify everything:

```bash
# 1. Server should be running
curl -s http://localhost:3000/login > /dev/null && echo "✅ Server running"

# 2. Customer portal page should exist
curl -s http://localhost:3000/s/acme/tickets -L | grep -q "My Tickets" && echo "✅ Customer portal page exists"

# 3. Login page accessible
curl -s http://localhost:3000/login | grep -q "Sign in" && echo "✅ Login page accessible"
```


