# External VPS Sync Architecture

## Goal
Achieve near real-time service status updates by offloading the sync job to an external VPS instead of Vercel's limited cron system.

## Architecture Options

### Option 1: Simple VPS HTTP Poller (Recommended for Start)
Run a lightweight script on your VPS that calls the sync endpoint every X seconds.

```
┌─────────────┐     HTTP GET      ┌─────────────┐
│  Your VPS   │ ─────────────────▶│  Vercel App │
│  (Node.js)  │  /api/sync/trigger│  (Next.js)  │
└─────────────┘                   └─────────────┘
       │                                   │
       │                                   │
       │                          ┌────────▼────┐
       │                          │   Zabbix    │
       │                          │   Server    │
       │                          └─────────────┘
       │
  ┌────▼─────┐
  │  Timer   │
  │ (setInterval)
  └──────────┘
```

**Pros:**
- Simple to implement
- Works with any VPS (DigitalOcean, AWS, Linode, etc.)
- Can run on existing infrastructure

**Cons:**
- Wastes resources polling when nothing changes
- Delay depends on polling interval

---

### Option 2: Zabbix Webhook → VPS → Your App (Event-Driven)
Zabbix sends webhooks when status changes, VPS forwards to your app.

```
┌─────────────┐     Webhook       ┌─────────────┐     Forward      ┌─────────────┐
│   Zabbix    │ ─────────────────▶│  Your VPS   │ ────────────────▶│  Vercel App │
│  (Trigger   │   Status Change   │  (Webhook   │   (Filtered)     │  (Webhook   │
│   Action)   │                   │   Relay)    │                  │   Handler)  │
└─────────────┘                   └─────────────┘                  └─────────────┘
                                                                         │
                                                                         │
                                                                   ┌─────▼─────┐
                                                                   │ Broadcast │
                                                                   │ to Clients│
                                                                   └───────────┘
```

**Pros:**
- True real-time updates
- Only processes actual changes
- Minimal resource usage

**Cons:**
- More complex setup
- Requires Zabbix webhook configuration
- Needs WebSocket/SSE for client updates

---

### Option 3: Zabbix Agent/Proxy Direct Connection
Run a custom agent on VPS that connects directly to your database.

```
┌─────────────┐     Sync Job      ┌─────────────┐     DB Write     ┌─────────────┐
│  Your VPS   │ ─────────────────▶│  Zabbix     │ ────────────────▶│  Database   │
│  (Custom    │   Direct API Call │  Server     │   (Direct)       │  (Neon/     │
│   Agent)    │                   │             │                  │   Postgres) │
└─────────────┘                   └─────────────┘                  └─────────────┘
       │                                                                   │
       │                                                                   │
  ┌────▼─────┐                                                     ┌──────▼──────┐
  │  Timer   │                                                     │  Vercel     │
  │ (1 min)  │                                                     │  (Reads DB) │
  └──────────┘                                                     └─────────────┘
```

**Pros:**
- Direct DB access = fastest updates
- No Vercel function invocations for sync
- Can use Zabbix sender protocol

**Cons:**
- Direct DB access from VPS (security)
- More complex agent code
- Need to manage DB credentials on VPS

---

## Recommended Implementation: Option 1 + Option 2 Hybrid

Start with Option 1 for immediate results, then add Option 2 for real-time updates.

### Phase 1: VPS Poller (5-60 seconds)

**VPS Setup:**
```bash
# On your VPS
mkdir /opt/zabbix-sync
cd /opt/zabbix-sync
npm init -y
npm install node-fetch
```

**sync.js:**
```javascript
const SYNC_URL = 'https://yourdomain.com/api/zabbix/sync';
const CRON_TOKEN = 'your-cron-secret-token';
const SYNC_INTERVAL_MS = 30000; // 30 seconds

async function sync() {
  try {
    const response = await fetch(`${SYNC_URL}?orgId=ALL&token=${CRON_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    console.log(`[${new Date().toISOString()}] Synced:`, data.results?.length || 0, 'services');
  } catch (error) {
    console.error('Sync failed:', error.message);
  }
}

// Run immediately
sync();

// Then every X ms
setInterval(sync, SYNC_INTERVAL_MS);
console.log(`Poller started: ${SYNC_INTERVAL_MS}ms interval`);
```

**Run with PM2:**
```bash
npm install -g pm2
pm2 start sync.js --name zabbix-sync
pm2 save
pm2 startup
```

---

### Phase 2: Webhook for Real-Time

**1. Create Webhook Endpoint:**

Add to your Vercel app:
```typescript
// app/api/zabbix/webhook/route.ts
export async function POST(req: Request) {
  const { host, status, triggers } = await req.json();
  
  // Find service by zabbixHostId
  // Update immediately
  // Broadcast to connected clients (SSE/WebSocket)
  
  return Response.json({ received: true });
}
```

**2. VPS Relay:**
```javascript
// relay.js - runs on VPS
const express = require('express');
const app = express();

// Zabbix sends webhook here
app.post('/zabbix-webhook', (req, res) => {
  // Forward to Vercel
  fetch('https://yourdomain.com/api/zabbix/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body),
  });
  res.send('OK');
});

app.listen(3000);
```

**3. Zabbix Configuration:**
- Create a Media Type in Zabbix: Administration → Media Types → Create
- Type: Webhook
- Parameters:
  - `{HOST.NAME}`
  - `{TRIGGER.NAME}`
  - `{TRIGGER.STATUS}`
  - `{EVENT.SEVERITY}`
- URL: `http://your-vps-ip:3000/zabbix-webhook`

---

### Phase 3: WebSocket for Client Real-Time Updates

**Server-Sent Events (SSE) for Vercel:**
```typescript
// app/api/services/stream/route.ts
export async function GET(req: Request) {
  const stream = new ReadableStream({
    start(controller) {
      // Subscribe to Redis pub/sub or in-memory events
      const interval = setInterval(async () => {
        const data = await getLatestServiceData();
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      }, 5000);
      
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
      });
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `scripts/vps-poller.js` | VPS poller script (Node.js) |
| `scripts/vps-relay.js` | VPS webhook relay (Node.js) |
| `app/api/zabbix/webhook/route.ts` | Receive webhooks from VPS |
| `app/api/services/stream/route.ts` | SSE endpoint for clients |
| `docs/VPS_SETUP.md` | Complete setup guide |

## Security Considerations

1. **API Token**: Use strong secret token between VPS and Vercel
2. **IP Whitelist**: Restrict webhook endpoint to VPS IP only
3. **Rate Limiting**: Prevent abuse on sync endpoint
4. **HTTPS**: Always use HTTPS for VPS → Vercel communication
5. **DB Access**: If using Option 3, use read-only DB user

## Cost Comparison

| Option | Vercel Plan | VPS Specs | Estimated Cost |
|--------|-------------|-----------|----------------|
| Vercel Cron Only | Pro ($20/mo) | N/A | $20/mo |
| VPS Poller (5s) | Hobby (Free) | 1GB RAM, 1vCPU | $5-10/mo |
| VPS Poller + Webhook | Hobby (Free) | 1GB RAM, 1vCPU | $5-10/mo |
| VPS Direct DB | Hobby (Free) | 1GB RAM, 1vCPU | $5-10/mo |

## Next Steps

1. Choose your VPS provider (DigitalOcean, Linode, AWS Lightsail)
2. Decide on sync frequency (5s, 10s, 30s, 60s)
3. Implement Phase 1 (VPS Poller)
4. Monitor API usage and adjust frequency
5. Add Phase 2 (Webhook) if needed for sub-5s updates

Which option would you like to implement?
