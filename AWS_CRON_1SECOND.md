# AWS EC2 - 1 Second Cron + Zabbix Sync

## Update to Run Every 1 Second

### Step 1: SSH into EC2
```bash
ssh -i your-key.pem ubuntu@ec2-3-1-202-172.ap-southeast-1.compute.amazonaws.com
```

### Step 2: Create New Script (1 second loop + Zabbix sync)
```bash
cat > ~/atlas-cron/run-all.sh << 'EOF'
#!/bin/bash
# Runs every 1 second: Escalations + Zabbix Sync

LOG_FILE="$HOME/atlas-cron/run-all.log"
VERCEL_URL="https://atlas.agrnetworks.com"
CRON_SECRET="your-cron-secret"

while true; do
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$TIMESTAMP] Starting checks..." >> "$LOG_FILE"
  
  # 1. Run Escalations
  echo "[$TIMESTAMP] Running escalations..." >> "$LOG_FILE"
  curl -s -H "Authorization: Bearer $CRON_SECRET" \
    "$VERCEL_URL/api/cron/escalations" >> "$LOG_FILE" 2>&1
  echo "" >> "$LOG_FILE"
  
  # 2. Run Zabbix Sync for all orgs
  echo "[$TIMESTAMP] Running Zabbix sync..." >> "$LOG_FILE"
  curl -s -H "Authorization: Bearer $CRON_SECRET" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{}' \
    "$VERCEL_URL/api/admin/zabbix/sync" >> "$LOG_FILE" 2>&1
  echo "" >> "$LOG_FILE"
  
  echo "[$TIMESTAMP] Done" >> "$LOG_FILE"
  echo "---" >> "$LOG_FILE"
  
  # Wait 1 second
  sleep 1
done
EOF

chmod +x ~/atlas-cron/run-all.sh
```

### Step 3: Create Systemd Service (Auto-start on boot)
```bash
sudo tee /etc/systemd/system/atlas-cron.service << 'EOF'
[Unit]
Description=Atlas 1-Second Cron Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/atlas-cron
ExecStart=/home/ubuntu/atlas-cron/run-all.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable atlas-cron
sudo systemctl start atlas-cron
```

### Step 4: Remove Old Cron (Optional)
```bash
# Remove old 1-minute cron
crontab -r
# Or edit: crontab -e and delete the line
```

### Step 5: Check Status
```bash
# Check if service is running
sudo systemctl status atlas-cron

# View logs
tail -f ~/atlas-cron/run-all.log

# Restart if needed
sudo systemctl restart atlas-cron

# Stop service
sudo systemctl stop atlas-cron
```

## What It Does Every 1 Second:

1. **Escalations Check** - Processes escalation rules
2. **Zabbix Sync** - Syncs monitoring data from Zabbix

## Monitoring

```bash
# Real-time logs
tail -f ~/atlas-cron/run-all.log | grep -E "Running|Done|Success|Failed"

# Count runs per minute
watch -n 1 'tail -60 ~/atlas-cron/run-all.log | grep -c "Starting checks"'

# Check service status
sudo systemctl status atlas-cron --no-pager
```

## Performance Note

⚠️ **Warning**: Running every 1 second means:
- 3,600 API calls per hour
- 86,400 API calls per day
- Make sure your Vercel plan can handle this load
- Monitor your AWS EC2 CPU usage
