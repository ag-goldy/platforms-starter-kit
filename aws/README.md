# AWS Real-Time Zabbix Integration

Achieve **sub-100ms sync latency** from Zabbix to your customer portal using AWS infrastructure.

## ⚡ Performance Targets

| Metric | Target | Reality |
|--------|--------|---------|
| Sync Interval | 1ms requested | **1 second minimum** (physical limit) |
| End-to-end Latency | < 10ms | **50-100ms achievable** |
| Zabbix Check Interval | - | 30-60 seconds (Zabbix limitation) |

**Why 1ms is impossible:**
- Speed of light: ~5ms per 1000km
- Network stack: 0.5-2ms per hop
- Database write: 2-10ms
- **Practical minimum: ~50ms total**

## 🏗️ Architecture

```
Zabbix Server
    │
    │ Detects status change
    ▼
AWS VPC (ap-southeast-1)
├─ EC2 (Poller) ──▶ Zabbix API ──▶ Updates DB
│     1-5s interval                    │
│                                      │
└─ ElastiCache ◀───────────────────────┘
      (Redis)
       │
       │ Pub/Sub
       ▼
   API Gateway WebSocket (optional)
       │
       ▼
   Customer Browser
```

## 📁 Files Structure

```
aws/
├── terraform/
│   ├── main.tf              # VPC, subnets, networking
│   ├── ec2.tf               # EC2 instance for poller
│   ├── elasticache.tf       # Redis cluster
│   ├── security.tf          # Security groups
│   ├── variables.tf         # Configuration variables
│   └── terraform.tfvars.example  # Example config
├── scripts/
│   ├── deploy-aws.sh        # One-click deployment
│   └── user-data.sh         # EC2 bootstrap script
├── poller/
│   └── aws-poller.js        # AWS-optimized poller
└── README.md                # This file

docs/
├── AWS_1MS_ARCHITECTURE.md      # Detailed architecture
├── AWS_COST_ESTIMATE.md         # Pricing breakdown
├── AWS_DEPLOYMENT_GUIDE.md      # Step-by-step guide
└── EXTERNAL_VPS_SYNC.md         # Generic VPS guide
```

## 🚀 Quick Deploy

```bash
# 1. Configure AWS
aws configure

# 2. Set variables
export VPS_HOST=your-ec2-ip  # Will be created
export APP_URL=https://atlas.agrnetworks.com
export CRON_SECRET_TOKEN=your-secret

# 3. Deploy
cd aws/scripts
./deploy-aws.sh

# 4. Done!
# Poller runs every 1 second by default
```

## 💰 Cost

| Setup | Instance | Monthly Cost | Latency |
|-------|----------|-------------|---------|
| Minimal | t3.micro | ~$10 | ~200ms |
| **Your Config** | **m7i-flex.large** | **~$79** (~$52 reserved) | **~50ms** |
| High Performance | m7i-flex.xlarge | ~$140 | ~30ms |

**Your m7i-flex.large includes:**
- 2 vCPU, 8GB RAM (8x more than t3.micro)
- 12.5 Gbps network (2.5x faster)
- Intel Xeon Scalable processors
- Sustained high performance (no burst limits)

## ⚙️ Configuration

Edit `aws/terraform/terraform.tfvars`:

```hcl
# Required
aws_region        = "ap-southeast-1"
app_url           = "https://atlas.agrnetworks.com"
cron_secret_token = "your-secret"
my_ip_cidr        = "YOUR_IP/32"
ssh_key_name      = "your-key-pair"

# Sync frequency (milliseconds)
sync_interval_ms  = "1000"   # 1 second
# sync_interval_ms  = "100"    # 100ms - NOT RECOMMENDED
# sync_interval_ms  = "1"      # 1ms - IMPOSSIBLE

# Features
use_elasticache   = true
use_webhook_relay = false
```

## 📊 Monitoring

```bash
# View real-time logs
ssh ec2-user@YOUR_EC2_IP 'sudo journalctl -u zabbix-poller -f'

# Check status
ssh ec2-user@YOUR_EC2_IP 'sudo systemctl status zabbix-poller'

# View CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace ZabbixPoller \
  --metric-name mem_used_percent \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average
```

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| High latency | Check region matches Neon DB |
| Connection refused | Verify security group rules |
| Redis errors | Check ElastiCache security group |
| High CPU | Increase instance size |
| Sync failures | Check Zabbix API credentials |

## 🆚 Comparison: AWS vs Vercel Cron

| Feature | Vercel Cron | AWS Setup (m7i-flex.large) |
|---------|-------------|---------------------------|
| Min Interval | 1 minute | 1 second |
| Latency | 60s | **~50ms** |
| Instance | N/A | 2 vCPU, 8GB RAM, 12.5Gbps |
| Cost (monthly) | $20 (Pro) | ~$79 (~$52 reserved) |
| Setup | Easy | Medium |
| Scalability | Limited | Unlimited |
| Real-time | No | **Yes** |
| Database | Neon (existing) | **Neon (existing)** |

## 🎯 Use Cases

### When to Use AWS Setup

✅ **Use this if:**
- You need updates faster than 1 minute
- Customers expect real-time status
- You have 50+ services to monitor
- You're already using AWS

❌ **Don't use if:**
- 1-minute updates are sufficient
- Budget is very tight (<$10/month)
- You don't want to manage infrastructure
- Zabbix checks are every 5 minutes anyway

## 📚 Documentation

- [Architecture Details](docs/AWS_1MS_ARCHITECTURE.md)
- [Cost Breakdown](docs/AWS_COST_ESTIMATE.md)
- [Deployment Guide](docs/AWS_DEPLOYMENT_GUIDE.md)
- [Generic VPS Guide](docs/EXTERNAL_VPS_SYNC.md)

## 🔐 Security

- EC2 in private subnet (with bastion for SSH)
- ElastiCache in private subnet
- Security groups restrict access
- Secrets in environment variables
- CloudTrail for audit logging

## 🎓 Learning Path

1. **Start Simple**: Deploy with `sync_interval_ms = "10000"` (10s)
2. **Test**: Verify everything works
3. **Optimize**: Lower to 5000ms, then 1000ms
4. **Monitor**: Watch CPU, memory, latency
5. **Scale**: Upgrade instance if needed

## 🛑 Stop / Cleanup

```bash
cd aws/terraform
terraform destroy  # Deletes everything!
```

---

**Ready to deploy?** Start with the [Deployment Guide](docs/AWS_DEPLOYMENT_GUIDE.md)!

**Questions?** Check the [Architecture doc](docs/AWS_1MS_ARCHITECTURE.md) for detailed explanations.
