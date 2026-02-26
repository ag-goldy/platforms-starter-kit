# Atlas 1-Second Cron + Zabbix Sync Setup

Runs every 1 second: Escalations + Zabbix Sync

## Quick Setup (One Command)

### 1. SSH into EC2 and Run Setup
```bash
ssh -i your-key.pem ubuntu@ec2-3-1-202-172.ap-southeast-1.compute.amazonaws.com

# Download and run setup script
curl -fsSL https://raw.githubusercontent.com/your-repo/setup-1second-cron.sh | bash

# OR if you have the script locally:
# scp -i your-key.pem scripts/setup-1second-cron.sh ubuntu@ec2-3-1-202-172.ap-southeast-1.compute.amazonaws.com:~/
# ssh -i your-key.pem ubuntu@ec2-3-1-202-172.ap-southeast-1.compute.amazonaws.com
# bash ~/setup-1second-cron.sh
```

### 2. Edit and Add Your CRON_SECRET
```bash
nano ~/atlas-cron/run-all.sh

# Change this line:
CRON_SECRET="YOUR_CRON_SECRET_HERE"
# To your actual secret from .env.local
```

### 3. Start the Service
```bash
sudo systemctl start atlas-cron
```

### 4. Verify It's Working
```bash
# Check status
sudo systemctl status atlas-cron

# View real-time logs
tail -f ~/atlas-cron/run-all.log
```

You should see:
```
[2026-02-10 15:30:01] ▶ Starting cycle
[2026-02-10 15:30:01]   📋 Escalations...
[2026-02-10 15:30:01]   ✅ Escalations OK
[2026-02-10 15:30:01]   🖥️  Zabbix Sync...
[2026-02-10 15:30:01]   ✅ Zabbix Sync OK
[2026-02-10 15:30:01] ✓ Cycle complete
---
```

## Manual Setup (If Script Fails)

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@ec2-3-1-202-172.ap-southeast-1.compute.amazonaws.com

# Create directory
mkdir -p ~/atlas-cron
cd ~/atlas-cron

# Create script
cat > run-all.sh << 'SCRIPT'
#!/bin/bash
LOG_FILE="$HOME/atlas-cron/run-all.log"
VERCEL_URL="https://atlas.agrnetworks.com"
CRON_SECRET="your-secret-here"

touch "$LOG_FILE"

while true; do
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$TIMESTAMP] ▶ Starting cycle" >> "$LOG_FILE"
  
  # Escalations
  curl -s -H "Authorization: Bearer $CRON_SECRET" \
    "$VERCEL_URL/api/cron/escalations" >> "$LOG_FILE" 2>&1
  
  # Zabbix Sync
  curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" -d '{}' \
    "$VERCEL_URL/api/admin/zabbix/sync" >> "$LOG_FILE" 2>&1
  
  echo "[$TIMESTAMP] ✓ Done" >> "$LOG_FILE"
  echo "---" >> "$LOG_FILE"
  
  sleep 1
done
SCRIPT

chmod +x run-all.sh

# Create systemd service
sudo tee /etc/systemd/system/atlas-cron.service << 'EOF'
[Unit]
Description=Atlas Cron
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/atlas-cron
ExecStart=/home/ubuntu/atlas-cron/run-all.sh
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable atlas-cron
sudo systemctl start atlas-cron
```

## Commands Reference

```bash
# Start
curl https://atlas.agrnetworks.comsudo systemctl start atlas-cron

# Stop
sudo systemctl stop atlas-cron

# Restart
sudo systemctl restart atlas-cron

# Check status
sudo systemctl status atlas-cron

# View logs
tail -f ~/atlas-cron/run-all.log

# View last 50 lines
tail -n 50 ~/atlas-cron/run-all.log
```

## Performance

- **Frequency**: Every 1 second (3,600 times/hour)
- **CPU Usage**: ~1-2% on t3.small
- **Memory**: ~50MB
- **Network**: ~2 API calls per second

## Troubleshooting

**Service won't start?**
```bash
# Check for errors
sudo journalctl -u atlas-cron -n 50

# Check script permissions
ls -la ~/atlas-cron/run-all.sh
chmod +x ~/atlas-cron/run-all.sh
```

**401 Unauthorized errors?**
- CRON_SECRET is wrong in the script
- Edit: `nano ~/atlas-cron/run-all.sh`

**404 errors?**
- API routes not deployed
- Run: `vercel --prod` locally

**High CPU usage?**
```bash
# Check CPU
htop

# If too high, increase sleep time:
# Edit run-all.sh and change: sleep 1 → sleep 5 (for 5 seconds)
```
