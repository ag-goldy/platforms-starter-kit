# AWS Cost Estimate for Sub-100ms Zabbix Integration

## Overview

This document provides detailed cost estimates for running the high-frequency Zabbix sync infrastructure on AWS.

## Option 1: Minimal (t3.micro) - ~$10/month

For users who just need faster polling without Redis.

| Service | Specs | Monthly Cost |
|---------|-------|-------------|
| EC2 (t3.micro) | 2 vCPU, 1GB RAM | $8.50 |
| Data Transfer | 10GB outbound | $0.90 |
| CloudWatch Logs | 1GB ingestion | $0.50 |
| **Total** | | **~$10/month** |

**Latency**: ~100-200ms (HTTP calls to Vercel)

---

## Option 2: Recommended (m7i-flex.large) - ~$79/month

**Your configuration** - High-performance setup with m7i-flex.large for maximum throughput and lowest latency.

| Service | Specs | Monthly Cost |
|---------|-------|-------------|
| EC2 (m7i-flex.large) | 2 vCPU, 8GB RAM, 12.5Gbps network | $65.00 |
| ElastiCache (cache.t3.micro) | Redis, 1 node, 0.5GB | $12.50 |
| Data Transfer | 10GB outbound | $0.90 |
| CloudWatch Logs | 1GB ingestion | $0.50 |
| **Total** | | **~$79/month** |

**Latency**: ~30-80ms (with Redis pub/sub + high-performance instance)

**Benefits of m7i-flex.large:**
- **8GB RAM** vs 1GB on t3.micro - Can cache more data
- **12.5 Gbps network** vs 5 Gbps - Faster API calls to Zabbix/Vercel
- **Better CPU** - Intel Xeon Scalable processors
- **Sustained performance** - No burst credits to worry about

### With Reserved Instance (1-year) - RECOMMENDED

| Service | Specs | Monthly Cost |
|---------|-------|-------------|
| EC2 (m7i-flex.large) | 1-year reserved | $38.00 |
| ElastiCache (cache.t3.micro) | On-demand | $12.50 |
| Data Transfer | 10GB outbound | $0.90 |
| CloudWatch Logs | 1GB ingestion | $0.50 |
| **Total** | | **~$52/month** |

**Savings**: 40% with reserved instance!

---

## Option 3: High Performance - ~$50/month

For high-volume environments with many services.

| Service | Specs | Monthly Cost |
|---------|-------|-------------|
| EC2 (t3.small) | 2 vCPU, 2GB RAM | $17.00 |
| ElastiCache (cache.t3.small) | Redis, 1 node, 1.5GB | $24.50 |
| Data Transfer | 50GB outbound | $4.50 |
| CloudWatch Logs | 5GB ingestion | $2.50 |
| **Total** | | **~$48/month** |

**Latency**: ~30-80ms (optimized stack)

---

## Option 4: Enterprise (Multi-AZ) - ~$100/month

For production with high availability.

| Service | Specs | Monthly Cost |
|---------|-------|-------------|
| EC2 (2x t3.small) | 2 instances, ALB | $34.00 |
| ElastiCache (cache.t3.small) | Multi-AZ enabled | $49.00 |
| ALB | Load balancer | $16.00 |
| Data Transfer | 100GB outbound | $9.00 |
| CloudWatch | Detailed monitoring | $5.00 |
| **Total** | | **~$113/month** |

**Latency**: ~20-60ms (HA setup)

---

## Regional Pricing Comparison

Prices for Option 2 (Recommended) by region:

| Region | Location | Monthly Cost |
|--------|----------|-------------|
| ap-southeast-1 | Singapore | ~$22 |
| ap-southeast-2 | Sydney | ~$24 |
| ap-northeast-1 | Tokyo | ~$23 |
| us-east-1 | N. Virginia | ~$20 |
| us-west-2 | Oregon | ~$21 |
| eu-west-1 | Ireland | ~$22 |

**Recommendation**: Choose the region closest to your Neon database for lowest latency.

---

## Cost Optimization Tips

### 1. Use Spot Instances (EC2)
- **Savings**: Up to 90%
- **Trade-off**: Instance can be terminated with 2-minute warning
- **Best for**: Non-critical polling, dev/test environments

```
Spot Price: ~$2-3/month instead of $8.50
```

### 2. Reserved Instances
- **Savings**: 30-60% for 1-3 year commitment
- **Best for**: Production workloads

```
1-year reserved: ~$6/month instead of $8.50
3-year reserved: ~$4/month instead of $8.50
```

### 3. Savings Plans
- **Savings**: 20-50%
- **Best for**: Flexible commitment across services

### 4. Use Graviton2 (ARM) Instances
- **Savings**: 20% cheaper
- **Performance**: Better price/performance

```
t4g.micro: ~$6.50/month instead of $8.50
```

---

## Data Transfer Costs Breakdown

### Inbound (Free)
- Data into EC2 from internet: **Free**
- Data into ElastiCache: **Free**

### Outbound (Pay per GB)
| Volume | Cost per GB | Monthly (10GB) |
|--------|-------------|----------------|
| First 10TB | $0.09 | $0.90 |
| Next 40TB | $0.085 | - |
| Next 100TB | $0.07 | - |

**Typical usage**: 5-20GB/month for poller = **$0.45-1.80**

---

## API Gateway WebSocket (Optional)

If adding WebSocket API for browser push:

| Metric | Cost | Typical Usage | Monthly |
|--------|------|---------------|---------|
| Connection | $0.29/million | 100K connections | $29 |
| Message | $1.14/million | 10M messages | $11.40 |
| Data Transfer | $0.09/GB | 10GB | $0.90 |
| **Total** | | | **~$41/month** |

**Note**: Only needed for true real-time browser push. Standard HTTP polling is sufficient for most use cases.

---

## Free Tier Eligibility

If you're new to AWS (first 12 months):

| Service | Free Tier | Savings |
|---------|-----------|---------|
| EC2 (t2.micro) | 750 hours/month | $8.50 |
| ElastiCache | Not included | $0 |
| Data Transfer | 100GB outbound | $9 |

**First year cost**: ~$13/month (just ElastiCache)

---

## Cost Monitoring

### Set Up Billing Alerts

```bash
# AWS CLI command to set billing alert
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget.json
```

### CloudWatch Alarms

Create alarms for:
- EC2 CPU > 80%
- ElastiCache memory > 80%
- Data transfer > 100GB/month

### Cost Explorer

View costs by service:
```
AWS Console → Billing → Cost Explorer → Group by: Service
```

---

## Total Cost of Ownership Comparison

### vs Vercel Pro

| Feature | Vercel Pro | AWS Setup |
|---------|-----------|-----------|
| Cron Jobs | Unlimited | N/A (runs on EC2) |
| Function Duration | 5 min | Unlimited |
| Sync Frequency | Every 1 min | Every 1 second |
| Monthly Cost | $20 | $22 |

**Winner**: AWS for high-frequency polling

### vs External VPS (DigitalOcean, Linode)

| Provider | Cost | Performance |
|----------|------|-------------|
| AWS (Option 2) | $22/mo | Same region as DB |
| DigitalOcean | $12/mo | Network latency |
| Linode | $10/mo | Network latency |

**Winner**: AWS if using Neon (same infrastructure)

---

## Summary

| Budget | Setup | Latency | Monthly Cost |
|--------|-------|---------|-------------|
| Minimal | EC2 only | 100-200ms | ~$10 |
| **Recommended** | EC2 + ElastiCache | **50-100ms** | **~$22** |
| High Performance | Larger instances | 30-80ms | ~$48 |
| Enterprise | Multi-AZ HA | 20-60ms | ~$113 |

**Our recommendation**: Start with Option 2 ($22/month) for the best balance of cost and performance.
