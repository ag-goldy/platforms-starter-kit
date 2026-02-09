#!/bin/bash
#
# VPS Poller Deployment Script
# 
# This script deploys the Zabbix poller to your VPS
# Run this from your local machine
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║    Zabbix VPS Poller Deploy Script      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo

# Configuration
VPS_HOST="${VPS_HOST:-}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/zabbix-sync}"

# Check required variables
if [ -z "$VPS_HOST" ]; then
    echo -e "${RED}Error: VPS_HOST environment variable not set${NC}"
    echo "Usage: VPS_HOST=your-vps-ip ./deploy.sh"
    exit 1
fi

if [ -z "$APP_URL" ]; then
    echo -e "${YELLOW}Warning: APP_URL not set, will use placeholder${NC}"
    APP_URL="https://yourdomain.com"
fi

if [ -z "$CRON_SECRET_TOKEN" ]; then
    echo -e "${YELLOW}Warning: CRON_SECRET_TOKEN not set${NC}"
    CRON_SECRET_TOKEN="your-secret-token"
fi

echo -e "${YELLOW}Deploying to:${NC} $VPS_USER@$VPS_HOST:$DEPLOY_DIR"
echo -e "${YELLOW}App URL:${NC} $APP_URL"
echo

# Create remote directory
echo -e "${GREEN}Creating remote directory...${NC}"
ssh $VPS_USER@$VPS_HOST "mkdir -p $DEPLOY_DIR/logs"

# Copy files
echo -e "${GREEN}Copying files...${NC}"
scp poller.js package.json ecosystem.config.js .env.example $VPS_USER@$VPS_HOST:$DEPLOY_DIR/

# Create .env file remotely
echo -e "${GREEN}Creating environment file...${NC}"
ssh $VPS_USER@$VPS_HOST "cat > $DEPLOY_DIR/.env << 'EOF'
APP_URL=$APP_URL
CRON_SECRET_TOKEN=$CRON_SECRET_TOKEN
SYNC_INTERVAL_MS=${SYNC_INTERVAL_MS:-10000}
ORG_ID=${ORG_ID:-ALL}
VERBOSE=${VERBOSE:-false}
EOF"

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
ssh $VPS_USER@$VPS_HOST "cd $DEPLOY_DIR && npm install"

# Check if PM2 is installed
echo -e "${GREEN}Checking PM2...${NC}"
if ! ssh $VPS_USER@$VPS_HOST "which pm2" > /dev/null 2>&1; then
    echo -e "${YELLOW}PM2 not found, installing...${NC}"
    ssh $VPS_USER@$VPS_HOST "npm install -g pm2"
fi

# Stop existing process if running
echo -e "${GREEN}Stopping existing process...${NC}"
ssh $VPS_USER@$VPS_HOST "pm2 stop zabbix-poller 2>/dev/null || true"

# Start with PM2
echo -e "${GREEN}Starting poller...${NC}"
ssh $VPS_USER@$VPS_HOST "cd $DEPLOY_DIR && pm2 start ecosystem.config.js"

# Save PM2 config
ssh $VPS_USER@$VPS_HOST "pm2 save"

echo
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo
echo -e "Useful commands:"
echo -e "  ${YELLOW}ssh $VPS_USER@$VPS_HOST 'pm2 logs zabbix-poller'${NC} - View logs"
echo -e "  ${YELLOW}ssh $VPS_USER@$VPS_HOST 'pm2 status'${NC} - Check status"
echo -e "  ${YELLOW}ssh $VPS_USER@$VPS_HOST 'pm2 restart zabbix-poller'${NC} - Restart"
echo
