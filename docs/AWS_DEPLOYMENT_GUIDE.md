# AWS Deployment Guide - Sub-100ms Zabbix Integration

This guide walks you through deploying the high-frequency Zabbix sync infrastructure on AWS.

## Prerequisites

1. **AWS Account** with billing enabled
2. **AWS CLI** installed and configured
3. **Terraform** >= 1.0 installed
4. **SSH Key Pair** created in AWS EC2
5. **Your IP address** (for SSH access)

## Quick Start (5 minutes)

### Step 1: Configure AWS CLI

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: ap-southeast-1 (or your preferred region)
# Default output: json
```

### Step 2: Get Your Configuration Values

```bash
# Get your IP address
curl https://ipinfo.io/ip

# SSH Key Pair
# Go to AWS Console → EC2 → Key Pairs → Create Key Pair
# Download the .pem file and save to ~/.ssh/

# Vercel Token
# Copy CRON_SECRET_TOKEN from your Vercel environment variables
```

### Step 3: Deploy

```bash
cd aws/scripts

# Set environment variables
export AWS_REGION=ap-southeast-1
export TF_VAR_app_url="https://atlas.agrnetworks.com"
export TF_VAR_cron_secret_token="your-secret-token"
export TF_VAR_my_ip_cidr="YOUR_IP/32"
export TF_VAR_ssh_key_name="your-key-pair"

# Run deploy script
./deploy-aws.sh
```

That's it! The script will:
1. Validate your configuration
2. Create VPC, subnets, security groups
3. Deploy **m7i-flex.large** EC2 instance with poller
4. Deploy ElastiCache Redis
5. Start the sync service
6. Connect to your **existing Neon database** via API

### Database Note

✅ **No database changes needed!** 

The poller connects to your **existing Neon PostgreSQL database** through your Vercel app's API endpoints:
- Reads services list via `GET /api/services`
- Updates status via `POST /api/zabbix/sync`
- Uses your existing Neon connection string (no changes)

The m7i-flex.large instance provides:
- **8GB RAM** for caching and concurrent operations
- **12.5 Gbps network** for fast API calls
- **Intel Xeon** processors for consistent performance

### Step 4: Verify

```bash
# Get EC2 IP from terraform output
cd ../terraform
EC2_IP=$(terraform output -raw ec2_public_ip)

# SSH into instance
ssh ec2-user@$EC2_IP

# Check poller status
sudo systemctl status zabbix-poller

# View logs
sudo journalctl -u zabbix-poller -f
```

## Manual Deployment (Without Script)

If you prefer manual control:

```bash
cd aws/terraform

# Copy and edit variables
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars

# Initialize Terraform
terraform init

# Plan
terraform plan

# Apply
terraform apply

# Get outputs
terraform output
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      AWS ap-southeast-1                     │
│                                                             │
│  ┌─────────────────────────┐    ┌──────────────────────┐   │
│  │   EC2 (Poller)          │───▶│  ElastiCache (Redis)│   │
│  │   m7i-flex.large        │VPC │   Pub/Sub           │   │
│  │   2 vCPU, 8GB RAM       │    │   $12.50/mo         │   │
│  │   12.5 Gbps network     │    └──────────────────────┘   │
│  │   ~$65/mo               │                               │
│  └───────────┬─────────────┘                               │
│              │                                              │
│              │ HTTPS (existing connection)                  │
│              ▼                                              │
│  ┌──────────────────────────────────────────────────┐      │
│  │         Vercel + Neon DB (EXISTING)              │      │
│  │         atlas.agrnetworks.com                    │      │
│  │         No changes needed!                       │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

**Key Point**: This setup uses your **EXISTING Neon PostgreSQL database** through your Vercel app's API. No database migration needed!

## Sync Intervals

Edit `terraform.tfvars` to change sync frequency:

```hcl
# Ultra real-time (use with caution)
sync_interval_ms = "1000"  # 1 second

# Fast
sync_interval_ms = "5000"  # 5 seconds

# Recommended
sync_interval_ms = "10000"  # 10 seconds
```

**Note**: 1ms is not achievable due to network physics. 1 second is the practical minimum.

## Monitoring

### CloudWatch Dashboard

```bash
# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name ZabbixPoller \
  --dashboard-body file://dashboard.json
```

### Key Metrics

| Metric | Target | Alarm Threshold |
|--------|--------|-----------------|
| CPU Usage | < 50% | > 80% |
| Memory | < 70% | > 85% |
| Sync Latency | < 100ms | > 500ms |
| Failed Syncs | 0 | > 5% |

### Logs

```bash
# Real-time logs
ssh ec2-user@$EC2_IP 'sudo journalctl -u zabbix-poller -f'

# Last 100 lines
ssh ec2-user@$EC2_IP 'sudo journalctl -u zabbix-poller -n 100'

# CloudWatch Logs
aws logs tail /aws/ec2/zabbix-poller --follow
```

## Troubleshooting

### "Connection refused" to Vercel

1. Check security group outbound rules
2. Verify app_url includes https://
3. Test from EC2: `curl -I https://yourdomain.com`

### High latency (>200ms)

1. Check region - should match Neon DB region
2. Increase EC2 instance size
3. Check Zabbix server response time

### Redis connection errors

```bash
# Test Redis connection from EC2
redis-cli -h $(terraform output -raw redis_endpoint) ping

# Should return: PONG
```

### Poller not starting

```bash
# Check systemd logs
sudo journalctl -u zabbix-poller --no-pager

# Check for Node.js errors
sudo cat /var/log/cloud-init-output.log
```

## Updating

### Update Poller Code

```bash
# SSH to EC2
ssh ec2-user@$EC2_IP

# Edit poller
cd /opt/zabbix-sync
sudo nano poller.js

# Restart
sudo systemctl restart zabbix-poller
```

### Update Infrastructure

```bash
cd aws/terraform
terraform apply
```

### Redeploy from Scratch

```bash
cd aws/terraform
terraform destroy  # WARNING: Deletes everything
terraform apply
```

## Security Best Practices

1. **Restrict SSH Access**
   - Only allow your IP in security group
   - Use key-based auth only
   - Consider AWS Systems Manager Session Manager instead of SSH

2. **Secure Secrets**
   - Use AWS Secrets Manager for tokens
   - Never commit terraform.tfvars
   - Rotate tokens regularly

3. **Network Security**
   - Keep ElastiCache in private subnet
   - Use VPC endpoints where possible
   - Enable CloudTrail for audit logging

## Cost Optimization

### Use Spot Instances (70% savings)

```hcl
# In terraform.tfvars
ec2_instance_type = "t3.micro"
# Then modify ec2.tf to use spot
```

### Reserved Instances (40% savings)

Purchase 1-year reserved capacity for production.

### Auto-Shutdown (Dev/Test)

```bash
# Stop EC2 when not needed
aws ec2 stop-instances --instance-ids $INSTANCE_ID

# Start when needed
aws ec2 start-instances --instance-ids $INSTANCE_ID
```

## Scaling

### Vertical Scaling (Bigger Instance)

```hcl
ec2_instance_type = "t3.small"  # 2GB RAM
# or
cache.t3.small     # 1.5GB Redis
```

### Horizontal Scaling (Multiple Pollers)

For very high frequency or many organizations:

1. Deploy multiple EC2 instances
2. Use SQS for work distribution
3. Each poller handles subset of services

## Cleanup

To delete all AWS resources:

```bash
cd aws/terraform
terraform destroy
```

**Warning**: This deletes everything including data!

## Support

For issues:
1. Check logs: `journalctl -u zabbix-poller`
2. Verify terraform outputs
3. Check AWS Console for service health
4. Review CloudWatch metrics

---

**Expected Result**: Sub-100ms sync latency from Zabbix to customer portal.
