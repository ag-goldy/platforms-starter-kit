# Atlas Helpdesk — Rollback Runbook

## Scope

This runbook covers application-level rollback for the Atlas Helpdesk platform. It does NOT cover infrastructure-level rollback (Vercel, Neon, VPS) — those are handled by the respective providers.

## Triggers

Roll back immediately if ANY of the following occur within 30 minutes of a deployment:

- Error rate > 5% for 5 consecutive minutes
- p95 latency > 3 seconds for 5 consecutive minutes
- Any critical user journey fails (login, ticket create, ticket reply, KB view)
- Database connection pool exhaustion
- Redis unreachable and cache fallback not working
- More than 10 failed jobs in a row

## Rollback Steps

### 1. Freeze writes (1 minute)

In Vercel dashboard or via CLI:

```bash
vercel --version  # confirm you are targeting production
```

If the deployment is broken, proceed to step 2. If the database is the issue, freeze writes first:

```bash
# Set an env var to enable maintenance mode
vercel env add NEXT_PUBLIC_MAINTENANCE_MODE production
# Value: true
vercel --prod
```

### 2. Roll back Vercel deployment (2 minutes)

**Option A — Dashboard:**
1. Go to Vercel dashboard → Project → Deployments
2. Find the last known-good deployment
3. Click "Promote to Production"

**Option B — CLI:**

```bash
# List recent deployments
vercel ls --meta version

# Roll back to the previous deployment
vercel rollback
```

### 3. Roll back database (if schema migration was applied) (5–15 minutes)

**Only if a bad migration was applied.**

If the new deployment applied a Drizzle migration that broke things:

```bash
# Check which migrations are applied
pnpm db:migrate:status

# If on a Neon branch, swap the DATABASE_URL back to the pre-migration branch
# If on the same database, create a rollback migration manually
```

**Neon branch rollback (preferred):**
1. In Neon console, find the pre-deployment branch
2. Copy its connection string
3. Update `DATABASE_URL` in Vercel to point to the old branch
4. Redeploy with `vercel --prod`

### 4. Verify rollback (3 minutes)

Run smoke tests:

```bash
# Public endpoints
curl -s -o /dev/null -w "%{http_code}" https://atlas.agrnetworks.com/
curl -s -o /dev/null -w "%{http_code}" https://atlas.agrnetworks.com/api/public/status

# Login page
curl -s -o /dev/null -w "%{http_code}" https://atlas.agrnetworks.com/login

# Create a test ticket via public API
curl -X POST https://atlas.agrnetworks.com/api/support/tickets \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","subject":"Rollback smoke test","description":"Testing after rollback"}'
```

### 5. Unfreeze writes (1 minute)

If maintenance mode was enabled:

```bash
vercel env rm NEXT_PUBLIC_MAINTENANCE_MODE production
vercel --prod
```

### 6. Post-rollback actions

1. **Document the failure** in the incident log:
   - Deployment ID that was rolled back
   - Error messages or symptoms
   - Time to detect and time to recover
   - Root cause hypothesis

2. **Pin the bad deployment** so it cannot be accidentally promoted again.

3. **Notify the team** in the #alerts Slack channel (or equivalent).

4. **Schedule a post-mortem** within 48 hours.

## Emergency Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| Primary on-call | See PagerDuty rotation | +65 xxxx xxxx |
| Platform admin | admin@agrnetworks.com | +65 xxxx xxxx |
| Neon support | console.neon.tech | — |
| Vercel support | vercel.com/help | — |

## Automation

The `vercel rollback` command is the fastest path. Consider automating rollback via:

- Vercel deploy hooks with health checks
- Better Stack uptime monitors that trigger rollback webhooks
- Sentry alert rules that page on-call after error thresholds
