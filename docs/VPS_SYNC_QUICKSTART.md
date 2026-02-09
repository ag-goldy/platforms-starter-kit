# VPS Sync Quick Start

Achieve **1-second or faster** sync intervals using an external VPS.

## Architecture

```
┌─────────────┐      HTTP POST      ┌─────────────┐     API Call      ┌─────────────┐
│   Your VPS  │ ──────────────────▶ │  Vercel App │ ────────────────▶ │   Zabbix    │
│  (poller.js)│   Every X seconds   │  (Next.js)  │    (Sync Data)    │   Server    │
└─────────────┘                     └─────────────┘                   └─────────────┘
       │                                                                   │
       │                                                                   │
       │                                                           ┌───────▼──────┐
       │                                                           │   Update     │
       │                                                           │   Database   │
       │                                                           └──────────────┘
       │
  ┌────▼─────┐
  │  Timer   │  (Configurable: 1s, 5s, 10s, etc.)
  └──────────┘
```

## Quick Deploy (One Command)

```bash
# Set your variables
export VPS_HOST=your-vps-ip
export APP_URL=https://atlas.agrnetworks.com
export CRON_SECRET_TOKEN=your-secret-token

# Deploy
cd scripts/vps-sync
./deploy.sh
```

## Manual Setup

### 1. Copy Files to VPS

```bash
# From your local machine
scp -r scripts/vps-sync/* root@YOUR_VPS_IP:/opt/zabbix-sync/
```

### 2. Configure

```bash
ssh root@YOUR_VPS_IP
cd /opt/zabbix-sync
cp .env.example .env
nano .env
```

Edit `.env`:
```bash
APP_URL=https://atlas.agrnetworks.com
CRON_SECRET_TOKEN=your-vercel-cron-secret
SYNC_INTERVAL_MS=1000    # 1000 = 1 second, 5000 = 5 seconds, etc.
ORG_ID=ALL
VERBOSE=false
```

### 3. Install & Run

```bash
npm install
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Sync Intervals

| Interval | API Calls/Hour | Best For |
|----------|---------------|----------|
| 1000ms (1s) | 3,600 | Extreme real-time |
| 5000ms (5s) | 720 | Near real-time |
| 10000ms (10s) | 360 | Fast updates |
| 30000ms (30s) | 120 | Balanced |
| 60000ms (1min) | 60 | Standard |

**⚠️ Warning**: Sub-second intervals (like 1ms) are not practical due to:
- Network latency (~50-200ms per request)
- Zabbix API rate limits
- Database write limits
- No real benefit (Zabbix itself updates every 30-60 seconds typically)

**Realistic minimum**: 1-5 seconds for practical use.

## Monitoring

```bash
# View logs
pm2 logs zabbix-poller

# View stats
pm2 status

# Restart
pm2 restart zabbix-poller
```

## Files Created

| File | Purpose |
|------|---------|
| `scripts/vps-sync/poller.js` | Main poller script |
| `scripts/vps-sync/webhook-relay.js` | Webhook receiver (optional) |
| `scripts/vps-sync/package.json` | Dependencies |
| `scripts/vps-sync/ecosystem.config.js` | PM2 config |
| `scripts/vps-sync/deploy.sh` | One-click deploy |
| `scripts/vps-sync/README.md` | Full documentation |
| `app/api/zabbix/webhook/route.ts` | Webhook receiver endpoint |
| `docs/EXTERNAL_VPS_SYNC.md` | Architecture docs |

## Next Steps

1. **Test it**: Set interval to 10 seconds first
2. **Monitor**: Check logs for errors
3. **Optimize**: Lower interval if Zabbix can handle it
4. **Secure**: Use firewall to restrict access
5. **Scale**: Consider webhook approach for >1000 services

## Troubleshooting

### "Connection refused"
- Check APP_URL is correct with https://
- Verify Vercel app is deployed
- Check firewall on VPS (outbound HTTPS)

### "Unauthorized"
- Verify CRON_SECRET_TOKEN matches Vercel env var
- Check for extra spaces in token

### High CPU/Memory
- Increase SYNC_INTERVAL_MS
- Check Zabbix API response times
- Monitor with `pm2 monit`

## Advanced: Event-Driven (Webhooks)

For true real-time without polling:

1. Run webhook relay on VPS:
```bash
node webhook-relay.js
```

2. Configure Zabbix → Media Types → Webhook → URL: `http://your-vps:3000/`

3. Zabbix sends webhook on every trigger change → VPS → Vercel instantly

See `EXTERNAL_VPS_SYNC.md` for details.

---

**Ready to deploy?** Just run the deploy.sh script with your VPS IP! 🚀
