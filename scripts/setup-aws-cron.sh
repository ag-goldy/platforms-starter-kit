#!/bin/bash
# Setup script for AWS EC2 cron jobs
# Run this on your EC2 instance to set up the escalation cron job

echo "Setting up Atlas cron jobs on AWS EC2..."

# Create cron script directory
mkdir -p ~/atlas-cron

# Create the escalation cron script
cat > ~/atlas-cron/escalation.sh << 'EOF'
#!/bin/bash
# Escalation cron job - runs every 5 minutes
# Logs output to ~/atlas-cron/escalation.log

LOG_FILE="$HOME/atlas-cron/escalation.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Your Vercel deployment URL - UPDATE THIS
VERCEL_URL="https://your-atlas-app.vercel.app"
CRON_SECRET="your-cron-secret-here"

echo "[$TIMESTAMP] Running escalation check..." >> "$LOG_FILE"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$VERCEL_URL/api/cron/escalations")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "[$TIMESTAMP] ✓ Success: $BODY" >> "$LOG_FILE"
else
    echo "[$TIMESTAMP] ✗ Failed (HTTP $HTTP_CODE): $BODY" >> "$LOG_FILE"
fi

echo "[$TIMESTAMP] Done" >> "$LOG_FILE"
echo "---" >> "$LOG_FILE"
EOF

# Make script executable
chmod +x ~/atlas-cron/escalation.sh

# Create crontab entry
# Run every 5 minutes
crontab -l > /tmp/current_crontab 2>/dev/null || true

# Remove old atlas entries if exist
sed -i '/atlas-cron/d' /tmp/current_crontab

# Add new entries
cat >> /tmp/current_crontab << EOF
# Atlas Escalation Cron - Every 1 minute
* * * * * $HOME/atlas-cron/escalation.sh >/dev/null 2>&1
EOF

# Install new crontab
crontab /tmp/current_crontab
rm /tmp/current_crontab

echo ""
echo "✓ Cron job installed successfully!"
echo ""
echo "Running every 1 minute: ~/atlas-cron/escalation.sh"
echo "Logs: ~/atlas-cron/escalation.log"
echo ""
echo "IMPORTANT: Edit ~/atlas-cron/escalation.sh and update:"
echo "  1. VERCEL_URL - Your actual Vercel deployment URL"
echo "  2. CRON_SECRET - Your CRON_SECRET from .env.local"
echo ""
echo "To verify crontab: crontab -l"
echo "To view logs: tail -f ~/atlas-cron/escalation.log"
echo "To test manually: ~/atlas-cron/escalation.sh"
