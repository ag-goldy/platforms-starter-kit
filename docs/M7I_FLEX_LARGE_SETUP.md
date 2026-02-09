# m7i-flex.large High-Performance Setup

## Your Configuration

```yaml
Instance: m7i-flex.large
  - 2 vCPU (Intel Xeon Scalable)
  - 8GB RAM
  - 12.5 Gbps network
  - EBS optimized
  
Database: Existing Neon PostgreSQL
  - No migration needed
  - Connected via Vercel API
  
Cache: ElastiCache Redis
  - cache.t3.micro
  - Pub/sub for real-time updates
  
Sync Interval: 1 second (configurable)
Expected Latency: 30-80ms
Monthly Cost: ~$79 (~$52 with reserved instance)
```

## Why m7i-flex.large?

### vs t3.micro (Standard)

| Spec | t3.micro | m7i-flex.large | Improvement |
|------|----------|----------------|-------------|
| RAM | 1GB | 8GB | **8x more** |
| Network | 5 Gbps | 12.5 Gbps | **2.5x faster** |
| CPU | Burstable | Sustained | **Consistent** |
| vCPU | 2 | 2 | Same |
| Cost | $8.50/mo | $65/mo | Higher perf |

### Benefits for Zabbix Sync

1. **More Concurrent Connections**
   - t3.micro: Limited by 1GB RAM
   - m7i-flex.large: Can handle 100+ concurrent API calls

2. **Faster Network**
   - 12.5 Gbps = faster API calls to Zabbix and Vercel
   - Lower latency on each request

3. **No Burst Limits**
   - t3.micro uses burst credits (runs out under load)
   - m7i-flex.large provides sustained performance

4. **Caching**
   - 8GB RAM allows caching Zabbix host lists
   - Reduces API calls to Zabbix

## Using Existing Neon Database

### Architecture

```
m7i-flex.large (AWS)
    │
    │ 1. Poll Zabbix
    ▼
Zabbix Server
    │
    │ 2. Detect changes
    ▼
m7i-flex.large
    │
    │ 3. HTTP POST to Vercel API
    ▼
Vercel (Next.js)
    │
    │ 4. Write to existing Neon DB
    ▼
Neon PostgreSQL (EXISTING)
    │
    │ 5. Read via API
    ▼
Customer Portal
```

### No Changes Needed To:

- ✅ Neon database connection string
- ✅ Database schema
- ✅ Vercel environment variables
- ✅ Application code

### What Changes:

- 🆕 EC2 instance running poller
- 🆕 ElastiCache Redis for pub/sub
- 🆕 API endpoints for sync

## Performance Expectations

### With t3.micro
- Sync interval: 10-30 seconds (to avoid burst limit)
- Latency: 100-200ms per sync
- Concurrent services: ~50

### With m7i-flex.large
- Sync interval: 1-5 seconds
- Latency: 30-80ms per sync
- Concurrent services: 500+

## Cost Breakdown

### On-Demand (Pay as you go)
| Service | Cost |
|---------|------|
| m7i-flex.large | $65.00/mo |
| ElastiCache | $12.50/mo |
| Data Transfer | $0.90/mo |
| CloudWatch | $0.50/mo |
| **Total** | **~$79/mo** |

### Reserved Instance (1-year commitment)
| Service | Cost |
|---------|------|
| m7i-flex.large (reserved) | $38.00/mo |
| ElastiCache | $12.50/mo |
| Data Transfer | $0.90/mo |
| CloudWatch | $0.50/mo |
| **Total** | **~$52/mo** |

**Save $27/month (40%) with reserved instance!**

## Deployment Steps

```bash
# 1. Configure
cd aws/terraform
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars:
# - ec2_instance_type = "m7i-flex.large"
# - app_url = "https://yourdomain.com"
# - cron_secret_token = "your-secret"
# - my_ip_cidr = "YOUR_IP/32"
# - ssh_key_name = "your-key"

# 2. Deploy
cd ../scripts
./deploy-aws.sh

# 3. Verify
ssh ec2-user@YOUR_EC2_IP
sudo journalctl -u zabbix-poller -f
```

## Monitoring

### Key Metrics to Watch

```bash
# CPU Usage (should be < 50%)
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=$INSTANCE_ID \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average

# Memory Usage (should be < 70%)
# Network In/Out
# Sync latency (custom metric)
```

### Alerts

Set CloudWatch alarms for:
- CPU > 60% for 5 minutes
- Memory > 80% for 5 minutes
- Sync failures > 10 in 1 hour

## Optimization Tips

### 1. Tune Sync Interval

Start conservative, then optimize:

```bash
# Week 1: 10 seconds
sync_interval_ms = "10000"

# Week 2: 5 seconds (if CPU < 30%)
sync_interval_ms = "5000"

# Week 3: 1 second (if stable)
sync_interval_ms = "1000"
```

### 2. Use Redis Caching

Already enabled with ElastiCache. Benefits:
- Cache Zabbix host list (reduces API calls)
- Pub/sub for instant updates
- Session storage

### 3. Connection Pooling

The poller uses HTTP keep-alive for Vercel API calls, reusing connections.

## Troubleshooting

### High CPU Usage

If CPU > 80%:
1. Increase sync interval
2. Check Zabbix API response times
3. Consider m7i-flex.xlarge (4 vCPU, 16GB)

### High Memory Usage

If memory > 80%:
1. Check for memory leaks in poller
2. Reduce cache size
3. Restart: `sudo systemctl restart zabbix-poller`

### Network Timeouts

If API calls timeout:
1. Check Zabbix server availability
2. Verify security group outbound rules
3. Check Vercel function timeout (max 5 min)

## Scaling Path

If you need more performance:

| Current | Next Step | Cost |
|---------|-----------|------|
| m7i-flex.large | m7i-flex.xlarge | ~$130/mo |
| 1 second sync | 500ms sync | Same cost |
| Single instance | Auto Scaling Group | ~$150/mo |

## Summary

Your **m7i-flex.large** setup provides:

✅ **High Performance**: 8GB RAM, 12.5 Gbps network  
✅ **Low Latency**: 30-80ms sync time  
✅ **No DB Migration**: Uses existing Neon  
✅ **Scalable**: Handle 500+ services  
✅ **Cost Effective**: $52/mo with reserved instance  

Ready to deploy? Run `./deploy-aws.sh`! 🚀
