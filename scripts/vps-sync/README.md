# Zabbix VPS Sync Poller

High-frequency sync poller for Zabbix integration. Run this on an external VPS to achieve near real-time service status updates.

## Quick Start

### 1. Copy Files to VPS

```bash
# On your local machine
scp -r scripts/vps-sync/* root@your-vps-ip:/opt/zabbix-sync/
```

### 2. Install on VPS

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Go to the directory
cd /opt/zabbix-sync

# Install dependencies
npm install

# Create environment file
cp .env.example .env
nano .env  # Edit with your settings
```

### 3. Configure Environment

Edit `.env` file:

```bash
APP_URL=https://atlas.agrnetworks.com
CRON_SECRET_TOKEN=your-secret-token-from-vercel
SYNC_INTERVAL_MS=10000
ORG_ID=ALL
VERBOSE=false
```

### 4. Run

**Option A: Direct (for testing)**
```bash
npm start
```

**Option B: With PM2 (recommended for production)**
```bash
# Install PM2 globally if not already installed
npm install -g pm2

# Start with PM2
npm run pm2:start

# View logs
npm run pm2:logs

# Check status
npm run pm2:status

# Save PM2 config to start on boot
pm2 save
pm2 startup
```

## Sync Intervals

Choose based on your needs:

| Interval | Use Case | API Calls/Hour |
|----------|----------|----------------|
| 1000ms (1s) | Extreme real-time | 3,600 |
| 5000ms (5s) | Near real-time | 720 |
| 10000ms (10s) | Fast updates | 360 |
| 30000ms (30s) | Balanced | 120 |
| 60000ms (1min) | Standard | 60 |

**Recommendation**: Start with 10s (10000ms) and adjust based on your Zabbix server's capacity.

## Monitoring the Poller

### View Logs

```bash
# Real-time logs
pm2 logs zabbix-poller

# Last 100 lines
pm2 logs zabbix-poller --lines 100

# Error logs only
cat logs/error.log
```

### Stats

The poller prints stats every 5 minutes:
```
=== Zabbix Poller Stats ===
Uptime: 2h 15m
Total Syncs: 810
Successful: 808 (99.8%)
Failed: 2
Last Sync: 2026-02-07T05:30:00.123Z
Interval: 10000ms (10.0s)
===========================
```

### Health Check Endpoint (Optional)

Add this to your VPS for monitoring:

```bash
# install.sh - One-liner install
curl -fsSL https://raw.githubusercontent.com/yourrepo/main/scripts/vps-sync/install.sh | bash
```

## Troubleshooting

### "Connection refused" or timeout

1. Check APP_URL is correct (include https://)
2. Verify your Vercel app is deployed and accessible
3. Check firewall rules on VPS (outbound HTTPS should be allowed)

### "Unauthorized" error

1. Verify CRON_SECRET_TOKEN matches the one in Vercel environment variables
2. Check token doesn't have extra spaces or newlines

### High memory usage

PM2 will auto-restart if memory exceeds 256MB. If this happens frequently:
- Increase sync interval
- Check for memory leaks in your app
- Restart poller: `pm2 restart zabbix-poller`

### Poller stops unexpectedly

Check PM2 logs:
```bash
pm2 logs zabbix-poller --err
```

Common causes:
- Out of memory (increase VPS RAM or sync interval)
- Network issues (check VPS connectivity)
- Invalid configuration

## Systemd Service (Alternative to PM2)

If you prefer systemd over PM2:

```bash
# Create service file
sudo nano /etc/systemd/system/zabbix-poller.service
```

Content:
```ini
[Unit]
Description=Zabbix Sync Poller
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/zabbix-sync
ExecStart=/usr/bin/node /opt/zabbix-sync/poller.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable zabbix-poller
sudo systemctl start zabbix-poller
sudo systemctl status zabbix-poller
```

## Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV NODE_ENV=production
CMD ["node", "poller.js"]
```

Build and run:
```bash
docker build -t zabbix-poller .
docker run -d --env-file .env --name zabbix-poller zabbix-poller
```

## Security Best Practices

1. **Use firewall**: Only allow necessary outbound connections
2. **Secure .env file**: `chmod 600 .env`
3. **Use strong token**: Generate with `openssl rand -base64 32`
4. **Run as non-root**: Create a dedicated user for the poller
5. **VPN/Private network**: If possible, put VPS and Zabbix on same private network

## Updating

```bash
cd /opt/zabbix-sync
git pull  # If using git
npm install
pm2 restart zabbix-poller
```

## Uninstall

```bash
pm2 stop zabbix-poller
pm2 delete zabbix-poller
rm -rf /opt/zabbix-sync
```

## Support

For issues or questions:
1. Check logs: `pm2 logs zabbix-poller`
2. Verify configuration in `.env`
3. Test manually: `VERBOSE=true node poller.js`
