# 3-Tier Storage Architecture Implementation

## Overview

This document describes the implementation of a 3-tier storage architecture for Atlas Helpdesk:

- **Tier 1 (Redis)**: Caching, rate limiting, real-time presence, drafts
- **Tier 2 (PostgreSQL/Neon)**: Primary data store with optimized indexes
- **Tier 3 (Vercel Blob)**: File storage with standardized paths

## Phase 1: Redis Caching Layer

### Files Created

| File | Purpose |
|------|---------|
| `lib/redis/client.ts` | Redis connection singleton supporting Upstash REST and standard Redis |
| `lib/redis/cache.ts` | Generic cache wrapper with TTL, invalidation helpers |
| `lib/redis/rate-limit.ts` | Rate limiting using Redis INCR + EXPIRE pattern |
| `lib/redis/presence.ts` | Real-time ticket presence tracking |
| `lib/redis/drafts.ts` | Comment draft autosave with 24h TTL |

### Cache Key Patterns

| Data Type | Cache Key | TTL |
|-----------|-----------|-----|
| Org Settings | `org:{orgId}:settings` | 1 hour |
| SLA Policies | `org:{orgId}:sla` | 1 hour |
| KB Articles | `kb:{orgId}:articles` | 30 min |
| KB Categories | `kb:{orgId}:categories` | 30 min |
| Status Summary | `status:{orgId}:summary` | 5 min |
| Zabbix Status | `zabbix:{hostId}:status` | 5 min |
| User Session | `session:{userId}:valid` | 15 min |

### Usage Examples

```typescript
// Cache a database query
import { cached, CACHE_TTL } from '@/lib/redis/cache';

const orgSettings = await cached(
  `org:${orgId}:settings`,
  CACHE_TTL.orgSettings,
  () => db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
);

// Rate limiting
import { RATE_LIMITS } from '@/lib/redis/rate-limit';

const limit = await RATE_LIMITS.inboundEmail(senderEmail);
if (!limit.success) {
  return { error: 'Rate limit exceeded' };
}

// Presence tracking
import { setPresence, getPresence } from '@/lib/redis/presence';

await setPresence(ticketId, userId, 'editing');
const viewers = await getPresence(ticketId);

// Draft autosave
import { saveDraft, getDraft } from '@/lib/redis/drafts';

await saveDraft(userId, ticketId, commentContent);
const draft = await getDraft(userId, ticketId);
```

## Phase 2: Job Queue Migration

### Files Created

| File | Purpose |
|------|---------|
| `lib/jobs/redis-queue.ts` | BullMQ queue definitions and enqueue helpers |
| `lib/jobs/redis-worker.ts` | BullMQ workers for processing jobs |
| `lib/jobs/index.ts` | Unified interface with backend toggle |

### Environment Variable

```bash
# Use BullMQ (default) or legacy queue
JOB_QUEUE_BACKEND=bullmq  # or 'legacy' for old implementation
```

### Queues

| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| `email` | Send emails via Microsoft Graph | 5 |
| `export` | Generate CSV/XLSX exports | 2 |
| `zabbix-sync` | Sync with Zabbix monitoring | 3 |
| `maintenance` | Audit compaction, SLA checks | 1 |

### Usage Examples

```typescript
import { enqueueEmail, enqueueExport, getQueueStats } from '@/lib/jobs';

// Enqueue email
await enqueueEmail({
  to: 'user@example.com',
  subject: 'Ticket Updated',
  html: '<p>Your ticket has been updated</p>',
});

// Enqueue export
await enqueueExport({
  orgId: 'org_123',
  exportType: 'tickets',
  format: 'csv',
  userId: 'user_456',
});

// Get queue stats
const stats = await getQueueStats();
console.log(stats.email.waiting); // Number of pending emails
```

## Phase 3: Vercel Blob Standardization

### Files Created

| File | Purpose |
|------|---------|
| `lib/storage/blob.ts` | Standardized upload helpers with path structure |
| `app/api/files/[fileId]/route.ts` | Secure file access API |

### Path Structure

| File Type | Path Pattern |
|-----------|--------------|
| Attachments | `attachments/{orgId}/{ticketId}/{timestamp}-{filename}` |
| KB Images | `kb/{orgId}/{articleId}/{filename}` |
| Branding | `branding/{orgId}/{logo\|favicon}` |
| Avatars | `avatars/{userId}/{timestamp}-{filename}` |
| Exports | `exports/{orgId}/{exportId}.{format}` |
| Reports | `reports/{orgId}/{reportId}.pdf` |

### Usage Examples

```typescript
import { uploadAttachment, uploadBranding, deleteFile } from '@/lib/storage/blob';

// Upload attachment
const result = await uploadAttachment(orgId, ticketId, file);
if (result.success) {
  console.log('Uploaded to:', result.url);
}

// Upload branding
await uploadBranding(orgId, 'logo', logoFile);

// Delete file
await deleteFile(pathname);
```

## Phase 4: Database Optimization

### Files Modified

| File | Changes |
|------|---------|
| `db/index.ts` | Added Neon serverless driver support with fallback |
| `drizzle/028_performance_indexes.sql` | Added 25+ performance indexes |
| `app/api/status/[orgId]/route.ts` | Replaced Math.random() with real data |

### Environment Variable

```bash
# Database driver selection
DB_DRIVER=neon  # or 'postgres' for postgres-js
```

### Key Indexes Added

- `idx_tickets_org_status_created` - Ticket list filtering
- `idx_tickets_org_assignee` - Assignee dashboard
- `idx_comments_ticket_created` - Comment queries
- `idx_memberships_user_org` - Permission checks
- `idx_audit_org_created` - Audit log queries
- `idx_monitoring_history_service` - Service uptime calculations

## Phase 5: Cache Invalidation

### Files Created

| File | Purpose |
|------|---------|
| `lib/cache-invalidation.ts` | Centralized cache invalidation helpers |

### Invalidation Helpers

```typescript
import { 
  invalidateOrgSettings,
  invalidateSLAPolicies,
  invalidateKBArticles,
  invalidateKBCategories,
  invalidateStatusSummary,
  invalidateZabbixStatus,
  invalidateUserSession,
} from '@/lib/cache-invalidation';

// After updating org settings
await invalidateOrgSettings(orgId);

// After ticket status change
await invalidateStatusSummary(orgId);
```

## Deployment Checklist

### Environment Variables

Ensure these are set in your Vercel project:

```bash
# Redis (Required)
REDIS_URL=redis://...
# Or for Upstash REST API:
# KV_REST_API_URL=https://...
# KV_REST_API_TOKEN=...

# Database (Required)
DATABASE_URL=postgresql://...
DB_DRIVER=neon  # or 'postgres'

# Blob Storage (Required)
BLOB_READ_WRITE_TOKEN=...

# Job Queue (Optional, defaults to 'bullmq')
JOB_QUEUE_BACKEND=bullmq
```

### Database Migration

Apply the performance indexes:

```bash
pnpm db:migrate
# Or apply specific migration:
psql $DATABASE_URL -f drizzle/028_performance_indexes.sql
```

### Verification

1. **Build succeeds**: `pnpm build`
2. **Cache working**: Check Upstash Redis console for key patterns
3. **Jobs processing**: Check Vercel logs for worker activity
4. **File uploads**: Test attachment upload in ticket
5. **Status API**: Verify `/api/status/{orgId}` returns real data

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Application                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Cache     │  │  Rate Limit  │  │  Presence    │      │
│  │   (Redis)    │  │   (Redis)    │  │   (Redis)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Job Queue   │  │   Drafts     │  │    Files     │      │
│  │   (BullMQ)   │  │   (Redis)    │  │  (Vercel)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
│    Redis     │    │  PostgreSQL/Neon │    │ Vercel Blob  │
│   (Cache)    │    │   (Primary DB)   │    │  (Files)     │
│  - Sessions  │    │  - Tickets       │    │  - Attach    │
│  - Presence  │    │  - Users         │    │  - Exports   │
│  - Drafts    │    │  - Orgs          │    │  - Images    │
└──────────────┘    └──────────────────┘    └──────────────┘
```

## Troubleshooting

### Redis Connection Issues

If you see "Using mock client" in logs:
- Check `REDIS_URL` or `KV_REST_API_URL`/`KV_REST_API_TOKEN` are set
- Verify Redis is accessible from Vercel

### Job Queue Not Processing

- Check `JOB_QUEUE_BACKEND=bullmq` is set
- Verify workers are started in your app entry point
- Check Redis connection for BullMQ

### Database Connection Issues

- Try switching driver: `DB_DRIVER=postgres`
- Check `DATABASE_URL` format
- Verify Neon/Vercel IP allowlists

## Future Improvements

1. **Redis Clustering**: For higher availability
2. **Job Queue Monitoring**: Add BullMQ dashboard
3. **CDN Integration**: For static file delivery
4. **Multi-region**: Read replicas for global performance
