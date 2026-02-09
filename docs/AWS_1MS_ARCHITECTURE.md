# AWS 1-Millisecond Real-Time Architecture

## Reality Check

**True 1ms end-to-end is physically impossible** because:
- Light takes ~5ms to travel 1000km (fiber optic)
- Zabbix checks are typically 30-60 seconds apart
- Database writes take 2-10ms
- Network stack overhead is 0.1-1ms

**BUT** - we can achieve **sub-100ms** which appears instant to users.

## Target Architecture: <100ms Total Latency

```
Zabbix (30s check interval)
    │
    │ Detects change (t=0ms)
    ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS REGION                            │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────┐  │
│  │   EC2        │    │ EventBridge  │    │   ElastiCache│  │
│  │  (Poller)    │───▶│   (Router)   │───▶│   (Redis)   │  │
│  │  Same AZ     │    │   <1ms       │    │   Pub/Sub   │  │
│  └──────────────┘    └──────────────┘    └──────┬──────┘  │
│        │                                         │         │
│        │ Direct DB Write                         │         │
│        ▼                                         ▼         │
│  ┌──────────────┐                         ┌─────────────┐  │
│  │  RDS Proxy   │                         │ API Gateway │  │
│  │  (Postgres)  │                         │  WebSocket  │  │
│  └──────────────┘                         └──────┬──────┘  │
│        │                                         │         │
│        │ Read                                    │ Push    │
│        ▼                                         ▼         │
│  ┌──────────────┐                         ┌─────────────┐  │
│  │   Vercel     │◀────────────────────────│   Client    │  │
│  │   (Edge)     │      <50ms via WebSocket│   Browser   │  │
│  └──────────────┘                         └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Latency Budget

| Step | Component | Latency |
|------|-----------|---------|
| 1 | Zabbix → EC2 Poller | 5-20ms (same VPC) |
| 2 | EC2 → EventBridge | <1ms (internal) |
| 3 | EventBridge → ElastiCache | <1ms (same AZ) |
| 4 | ElastiCache → API Gateway | 5-10ms |
| 5 | API Gateway → Client | 20-50ms (WebSocket) |
| **Total** | | **~35-80ms** |

## Components

### 1. EC2 Poller (Zabbix Consumer)
- **Instance**: t3.micro (sufficient for polling)
- **Placement**: Same AZ as RDS & ElastiCache
- **Network**: VPC with Zabbix (via VPN/Direct Connect) or public endpoint
- **Function**: Polls Zabbix, writes to DB, publishes events

### 2. Amazon EventBridge (Event Bus)
- **Purpose**: Route status change events
- **Latency**: Sub-millisecond internal routing
- **Scaling**: 500,000 events/second default

### 3. Amazon ElastiCache (Redis)
- **Purpose**: Pub/sub for real-time updates
- **Cluster Mode**: Disabled (simpler pub/sub)
- **Node Type**: cache.t3.micro
- **Latency**: Microseconds for in-memory ops

### 4. API Gateway WebSocket API
- **Purpose**: Push updates to browsers
- **Protocol**: WebSocket (persistent connection)
- **Latency**: 20-50ms to clients
- **Scaling**: 10,000 concurrent connections per second

### 5. RDS Proxy + PostgreSQL
- **Purpose**: Database with connection pooling
- **Instance**: db.t3.micro (can scale up)
- **Proxy**: Reduces connection overhead
- **Latency**: 2-5ms for writes

## Deployment Options

### Option A: AWS with Existing Neon DB (Your Setup)
Use AWS for compute/cache, keep your existing Neon database:
- **EC2 m7i-flex.large** (2 vCPU, 8GB RAM, 12.5Gbps)
- ElastiCache Redis
- **Existing Neon PostgreSQL** (no migration needed!)
- API Gateway WebSocket (optional)

**Cost**: ~$79/month (~$52 with reserved instance)
**Latency**: 30-80ms
**Benefits**:
- No database migration
- High-performance instance for concurrent API calls
- 8GB RAM for caching
- 12.5 Gbps network for low latency

### Option B: Hybrid (Keep Vercel, Add AWS Real-Time)
- Keep Vercel for web app
- Add AWS for real-time layer only
- ElastiCache + API Gateway WebSocket
- EC2 poller writes to Neon DB AND Redis

**Cost**: ~$30-50/month
**Latency**: 50-100ms

### Option C: Minimal (ElastiCache Only)
- Keep existing Neon DB + Vercel
- Add ElastiCache for pub/sub only
- EC2 poller in same region as Neon

**Cost**: ~$15-25/month
**Latency**: 80-150ms

## Why 1ms Is Impossible (But Sub-100ms Works)

```
User perception:
├─ < 16ms  : Impossible (1 frame at 60fps)
├─ < 100ms : Feels instant ✓ (our target)
├─ < 1s    : Fast enough for most use cases
└─ > 1s    : Noticeable delay

Physical limits:
├─ Speed of light: ~5ms per 1000km
├─ Network hops: 0.5-2ms each
├─ DB write: 2-10ms
├─ Redis write: 0.1-0.5ms
└─ Browser render: 16ms (60fps)
```

## Implementation Plan

### Phase 1: EC2 Poller + Direct DB (1-2 days)
- Deploy EC2 in same AWS region as Neon DB
- Run poller with 1-second intervals
- Write directly to database

### Phase 2: Add ElastiCache (1 day)
- Deploy Redis cluster
- Poller writes to DB + publishes to Redis
- Vercel app subscribes to Redis

### Phase 3: WebSocket API Gateway (2-3 days)
- Deploy WebSocket API
- Lambda function handles connections
- Push updates to browsers

### Phase 4: EventBridge (Optional)
- Add event routing for complex workflows
- Fan-out to multiple services

## File Structure

```
docs/
├── AWS_1MS_ARCHITECTURE.md      # This file
├── AWS_TERRAFORM.md             # Infrastructure as code
└── AWS_COST_ESTIMATE.md         # Detailed pricing

aws/
├── terraform/
│   ├── main.tf                  # VPC, subnets, security groups
│   ├── ec2.tf                   # Poller instance
│   ├── elasticache.tf           # Redis cluster
│   ├── apigateway.tf            # WebSocket API
│   └── variables.tf             # Configuration
├── scripts/
│   ├── user-data.sh             # EC2 bootstrap
│   └── deploy.sh                # Deployment script
└── poller/
    └── aws-poller.js            # AWS-optimized poller
```

## Next Steps

1. **Choose Region**: Pick AWS region closest to your users
2. **Choose Option**: A (Full AWS), B (Hybrid), or C (Minimal)
3. **Deploy Infrastructure**: Use Terraform or AWS Console
4. **Test Latency**: Measure actual end-to-end times
5. **Optimize**: Tune based on real-world performance

## Cost Estimate (Option B - Hybrid)

| Service | Specs | Monthly Cost |
|---------|-------|-------------|
| EC2 (t3.micro) | 1 vCPU, 1GB RAM | $8.50 |
| ElastiCache (cache.t3.micro) | Redis, 1 node | $12.50 |
| API Gateway WebSocket | 1M messages/day | $1.00 |
| Data Transfer | 10GB/month | $0.90 |
| **Total** | | **~$23/month** |

For **sub-100ms real-time updates** across all your services.

---

**Want me to create the Terraform files and deployment scripts?**
