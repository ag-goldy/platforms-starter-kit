# AWS EC2 Cron Job Setup

Setup cron jobs on your AWS EC2 instance to run escalation checks.

## Change Schedule to Every 1 Minute

If you already have the cron set up and want to change from 5 minutes to 1 minute:

```bash
# SSH into your EC2
ssh -i your-key.pem ec2-user@ec2-3-1-202-172.ap-southeast-1.compute.amazonaws.com

# Edit crontab
crontab -e

# Change this line:
# */5 * * * * /home/ec2-user/atlas-cron/escalation.sh >/dev/null 2>&1
# To this:
* * * * * /home/ec2-user/atlas-cron/escalation.sh >/dev/null 2>&1

# Save and exit (Ctrl+X, Y, Enter for nano)
```

**Verify:**
```bash
crontab -l
# Should show: * * * * * /home/ec2-user/atlas-cron/escalation.sh >/dev/null 2>&1
```

---

## Quick Setup (Automated) - First Time

1. **SSH into your EC2 instance:**
```bash
ssh -i your-key.pem ec2-user@ec2-3-1-202-172.ap-southeast-1.compute.amazonaws.com
```

2. **Copy the setup script to your EC2:**
```bash
# From your local machine
scp -i your-key.pem scripts/setup-aws-cron.sh ec2-user@ec2-3-1-202-172.ap-southeast-1.compute.amazonaws.com:~/
```

3. **Run the setup script:**
```bash
ssh -i your-key.pem ec2-user@ec2-3-1-202-172.ap-southeast-1.compute.amazonaws.com
chmod +x ~/setup-aws-cron.sh
~/setup-aws-cron.sh
```

4. **Change to every 1 minute:**
```bash
crontab -e
# Replace: */5 * * * * 
# With:    * * * * *
```

5. **Edit the script with your actual values:**
```bash
nano ~/atlas-cron/escalation.sh
```

Update these lines:
```bash
VERCEL_URL="https://your-atlas-app.vercel.app"  # Your actual Vercel URL
CRON_SECRET="0ec58609a33d7106e7cc46bb6aacc5df43c761f31cb1a509107b5acdbfe6a89a"  # From .env.local
```

6. **Test the script:**
```bash
~/atlas-cron/escalation.sh
cat ~/atlas-cron/escalation.log
```

## Manual Setup

If you prefer to set up manually:

1. **Create cron directory:**
```bash
mkdir -p ~/atlas-cron
```

2. **Create the script:**
```bash
cat > ~/atlas-cron/escalation.sh << 'EOF'
#!/bin/bash
LOG_FILE="$HOME/atlas-cron/escalation.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
VERCEL_URL="https://your-atlas-app.vercel.app"
CRON_SECRET="your-cron-secret"

curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "$VERCEL_URL/api/cron/escalations" >> "$LOG_FILE" 2>&1

echo "[$TIMESTAMP] Escalation check completed" >> "$LOG_FILE"
EOF
chmod +x ~/atlas-cron/escalation.sh
```

3. **Add to crontab (EVERY 1 MINUTE):**
```bash
crontab -e
```

Add this line:
```
* * * * * /home/ec2-user/atlas-cron/escalation.sh >/dev/null 2>&1
```

## Common Cron Schedules

| Schedule | Cron Expression | Description |
|----------|-----------------|-------------|
| Every 1 minute | `* * * * *` | Runs every minute |
| Every 5 minutes | `*/5 * * * *` | Runs every 5 minutes |
| Every 15 minutes | `*/15 * * * *` | Runs every 15 minutes |
| Every hour | `0 * * * *` | Runs at the start of each hour |
| Daily at 1 AM | `0 1 * * *` | Runs once per day at 1:00 AM |

## Verification

**Check crontab:**
```bash
crontab -l
```

**View logs:**
```bash
tail -f ~/atlas-cron/escalation.log
```

**Test manually:**
```bash
~/atlas-cron/escalation.sh
```

**Monitor cron execution:**
```bash
# Check if cron service is running
sudo systemctl status crond

# Restart cron service if needed
sudo systemctl restart crond
```

## Remove from Vercel

Since you're using AWS for cron, remove from `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/jobs/process",
      "schedule": "0 0 * * *"
    }
  ]
}
```

(Remove the escalations cron - keep only the daily jobs/process if needed)

## Troubleshooting

**Cron not running?**
- Check cron service: `sudo systemctl status crond`
- Check crontab: `crontab -l`
- Check logs: `cat ~/atlas-cron/escalation.log`

**Permission denied?**
```bash
chmod +x ~/atlas-cron/escalation.sh
```

**Curl not found?**
```bash
sudo yum install curl  # Amazon Linux 2
# or
sudo apt-get install curl  # Ubuntu/Debian
```

**Test the endpoint manually:**
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/escalations
```
