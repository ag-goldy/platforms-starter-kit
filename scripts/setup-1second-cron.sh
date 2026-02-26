#!/bin/bash
# Setup Atlas cron jobs on AWS EC2 to run every 1 second
# Includes: Escalations + Zabbix Sync

set -e

echo "🚀 Setting up Atlas 1-second cron with Zabbix sync..."

# Create cron directory
mkdir -p ~/atlas-cron
cd ~/atlas-cron

# Create the main runner script
cat > run-all.sh << 'EOF'
#!/bin/bash
# Atlas 1-Second Cron Runner
# Runs: Escalations + Zabbix Sync every 1 second

LOG_FILE="$HOME/atlas-cron/run-all.log"
VERCEL_URL="https://atlas.agrnetworks.com"
CRON_SECRET="YOUR_CRON_SECRET_HERE"

# Create log file if not exists
touch "$LOG_FILE"

while true; do
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  
  # Log start
  echo "[$TIMESTAMP] ▶ Starting cycle" >> "$LOG_FILE"
  
  # 1. Run Escalations
  echo "[$TIMESTAMP]   📋 Escalations..." >> "$LOG_FILE"
  ESCALATION_RESULT=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $CRON_SECRET" \
    "$VERCEL_URL/api/cron/escalations" 2>&1)
  ESCALATION_HTTP=$(echo "$ESCALATION_RESULT" | tail -n1)
  if [ "$ESCALATION_HTTP" = "200" ]; then
    echo "[$TIMESTAMP]   ✅ Escalations OK" >> "$LOG_FILE"
  else
    echo "[$TIMESTAMP]   ❌ Escalations Failed (HTTP $ESCALATION_HTTP)" >> "$LOG_FILE"
  fi
  
  # 2. Run Zabbix Sync (all orgs)
  echo "[$TIMESTAMP]   🖥️  Zabbix Sync..." >> "$LOG_FILE"
  ZABBIX_RESULT=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    -d '{}' \
    "$VERCEL_URL/api/admin/zabbix/sync" 2>&1)
  ZABBIX_HTTP=$(echo "$ZABBIX_RESULT" | tail -n1)
  if [ "$ZABBIX_HTTP" = "200" ]; then
    echo "[$TIMESTAMP]   ✅ Zabbix Sync OK" >> "$LOG_FILE"
  else
    echo "[$TIMESTAMP]   ❌ Zabbix Sync Failed (HTTP $ZABBIX_HTTP)" >> "$LOG_FILE"
  fi
  
  echo "[$TIMESTAMP] ✓ Cycle complete" >> "$LOG_FILE"
  echo "---" >> "$LOG_FILE"
  
  # Keep only last 1000 lines of log
  tail -n 1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
  
  # Wait 1 second
  sleep 1
done
EOF

chmod +x run-all.sh

echo ""
echo "✅ Script created at: ~/atlas-cron/run-all.sh"
echo ""
echo "⚠️  IMPORTANT: Update CRON_SECRET in the script:"
echo "   nano ~/atlas-cron/run-all.sh"
echo ""
echo "   Change: CRON_SECRET=\"YOUR_CRON_SECRET_HERE\""
echo "   To:     CRON_SECRET=\"your-actual-secret\""
echo ""

# Create systemd service
sudo tee /etc/systemd/system/atlas-cron.service > /dev/null << EOF
[Unit]
Description=Atlas 1-Second Cron Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/home/$USER/atlas-cron
ExecStart=/home/$USER/atlas-cron/run-all.sh
Restart=always
RestartSec=5
StandardOutput=append:/home/$USER/atlas-cron/run-all.log
StandardError=append:/home/$USER/atlas-cron/run-all.log

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Systemd service created"

# Remove old cron if exists
crontab -r 2>/dev/null || true
echo "✅ Old crontab removed"

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable atlas-cron

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit the script and add your CRON_SECRET:"
echo "   nano ~/atlas-cron/run-all.sh"
echo ""
echo "2. Start the service:"
echo "   sudo systemctl start atlas-cron"
echo ""
echo "3. Check status:"
echo "   sudo systemctl status atlas-cron"
echo ""
echo "4. View logs:"
echo "   tail -f ~/atlas-cron/run-all.log"
echo ""
echo "Commands:"
echo "  Start:   sudo systemctl start atlas-cron"
echo "  Stop:    sudo systemctl stop atlas-cron"
echo "  Restart: sudo systemctl restart atlas-cron"
echo "  Status:  sudo systemctl status atlas-cron"
echo "  Logs:    tail -f ~/atlas-cron/run-all.log"
