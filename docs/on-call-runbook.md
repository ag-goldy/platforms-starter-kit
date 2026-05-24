# Atlas Helpdesk — On-Call Runbook

## On-Call Expectations

- **Response time**: 15 minutes for P1, 1 hour for P2, 4 hours for P3
- **Rotation**: Weekly, handoff every Monday 09:00 SGT
- **Shift overlap**: 30-minute handoff meeting to review active incidents

## Severity Definitions

| Severity | Impact | Examples | Response |
|----------|--------|----------|----------|
| **P1 — Critical** | Platform unusable or data loss | All logins fail, DB down, ticket data not saving | Page immediately, assemble war room |
| **P2 — High** | Major feature degraded | Email-to-ticket broken, real-time down, SLA breaches not firing | Acknowledge within 1hr, fix within 4hr |
| **P3 — Medium** | Minor feature broken or slow | KB search slow, asset sync delayed, non-critical UI bug | Triage within 4hr, fix within 24hr |
| **P4 — Low** | Cosmetic or edge case | Typos, dark mode glitch, analytics gap | Track in backlog, fix next sprint |

## Alert Sources

1. **Sentry** — error spikes, unhandled exceptions
2. **Better Stack** — uptime checks (landing, login, API health)
3. **Vercel** — build failures, function errors
4. **Neon** — DB connection limits, slow queries
5. **Custom health endpoint** — `GET /api/jobs/health` (queue depth, worker status)
6. **BullMQ** — failed jobs count via `/api/jobs/health`

## Quick Diagnostics

### Is the site up?

```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" \
  https://atlas.agrnetworks.com/
```

Expected: `200 0.xxxs`

### Is the database healthy?

```bash
# Via Drizzle Studio (local)
pnpm db:studio

# Or via direct query
psql $DATABASE_URL -c "SELECT count(*) FROM organizations;"
```

### Are queues healthy?

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://atlas.agrnetworks.com/api/jobs/health | jq .
```

Expected: `healthy: true`, `totalFailed: 0`, all workers `running`

### Are there failed jobs?

```bash
# In Drizzle Studio or psql
SELECT type, error, failed_at FROM failed_jobs ORDER BY failed_at DESC LIMIT 10;
```

### Are we being rate-limited or attacked?

```bash
# Check Redis rate-limit counters
redis-cli KEYS 'rate_limit:*' | head -20
```

## Common Issues & Fixes

### 1. Login failures (P1)

**Symptoms**: Users cannot log in, auth callbacks return 500  
**Check**:
```bash
curl -s https://atlas.agrnetworks.com/api/auth/session
```
**Fix**:
- Check `NEXTAUTH_SECRET` and `NEXTAUTH_URL` env vars
- Verify `users` and `platform_admins` tables are reachable
- If JWT secret rotated, users must re-login (expected)

### 2. Ticket creation failures (P1/P2)

**Symptoms**: "Failed to create ticket" errors  
**Check**:
```bash
# Look at recent failed jobs
SELECT * FROM failed_jobs WHERE type = 'SEND_EMAIL' ORDER BY failed_at DESC LIMIT 5;
```
**Fix**:
- Check `tickets` table for lock/contention
- Verify `generateTicketKey` is not hitting a collision loop
- Check email queue health

### 3. Email not sending (P2)

**Symptoms**: Tickets created but no email notifications  
**Check**:
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://atlas.agrnetworks.com/api/jobs/health | jq '.queues.email'
```
**Fix**:
- Check `email_outbox` table for stuck messages
- Verify `RESEND_API_KEY` or Microsoft Graph credentials
- Restart workers if stalled: `pnpm workers:restart` on VPS

### 4. Real-time not working (P2)

**Symptoms**: No live ticket updates, no typing indicators  
**Check**:
```bash
# Test Socket.io on VPS
curl -s https://vps.atlas.agrnetworks.com/health
```
**Fix**:
- Check VPS status in Hetzner console
- Verify Redis on VPS is running: `redis-cli ping`
- Restart Socket.io server: `pm2 restart realtime-server`

### 5. Zabbix sync failures (P3)

**Symptoms**: Asset status not updating, monitoring alerts stale  
**Check**:
```bash
# Look at recent automation runs
SELECT * FROM automation_runs WHERE trigger = 'ZABBIX_SYNC' ORDER BY created_at DESC LIMIT 5;
```
**Fix**:
- Verify Zabbix API credentials in `zabbix_configs`
- Manually trigger sync: `curl -H "Authorization: Bearer $CRON_SECRET" https://atlas.agrnetworks.com/api/cron/zabbix-sync`

### 6. High error rate after deploy (P1)

**Symptoms**: Sentry alerts firing, users reporting issues  
**Action**:
1. Check Vercel deployment logs
2. If correlated with a deploy → **execute rollback** (`docs/rollback-runbook.md`)
3. If not deploy-related → check external dependencies (Neon, Redis, Resend)

## Incident Response Checklist

- [ ] Acknowledge the page in PagerDuty/Slack
- [ ] Classify severity (P1–P4)
- [ ] Assess user impact (how many tenants? which features?)
- [ ] Attempt quick fix if obvious (< 15 minutes)
- [ ] If not obvious, **roll back** to last known good state
- [ ] Verify fix/rollback resolved the issue
- [ ] Update status page if applicable
- [ ] Document timeline and root-cause hypothesis
- [ ] Schedule post-mortem for P1/P2 within 48 hours

## Useful Commands

```bash
# Tail Vercel logs
vercel logs --production

# Check recent deployments
vercel ls

# Roll back immediately
vercel rollback

# Drizzle Studio
pnpm db:studio

# Run diagnostics
pnpm check:emails
pnpm test:services

# SSH to VPS (for BullMQ/Redis/Socket.io)
ssh ops@vps.atlas.agrnetworks.com
pm2 status
pm2 logs
```

## Communication Templates

**P1 in progress**:
> 🚨 Atlas is experiencing a critical outage. We are investigating and will update every 15 minutes. ETA for resolution: investigating.

**Rollback complete**:
> ✅ We have rolled back to a stable version. All services are recovering. We are monitoring closely and will share a post-mortem within 48 hours.

**P2 degraded**:
> ⚠️ We are seeing elevated errors in [feature]. No data loss expected. Fix in progress. ETA: 2 hours.
