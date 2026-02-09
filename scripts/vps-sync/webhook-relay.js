#!/usr/bin/env node
/**
 * Zabbix Webhook Relay
 * 
 * Receives webhooks from Zabbix and forwards them to your Vercel app.
 * Provides near real-time updates when status changes occur.
 * 
 * Setup:
 * 1. Run this on your VPS
 * 2. Configure Zabbix to send webhooks to this server
 * 3. This relays to your Vercel app
 * 
 * Zabbix → VPS Webhook → Vercel App → Database → Client
 */

const http = require('http');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const CONFIG = {
  // Port to listen on (must be accessible from Zabbix)
  port: process.env.WEBHOOK_PORT || 3000,
  
  // Your Vercel app URL
  appUrl: process.env.APP_URL || 'https://yourdomain.com',
  
  // Secret for verifying webhooks (optional but recommended)
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  
  // Vercel app webhook endpoint
  forwardPath: '/api/zabbix/webhook',
  
  // Enable verbose logging
  verbose: process.env.VERBOSE === 'true',
};

const stats = {
  totalWebhooks: 0,
  successfulForwards: 0,
  failedForwards: 0,
  lastWebhook: null,
};

function log(level, message, data) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (data) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

async function forwardToVercel(payload) {
  const url = `${CONFIG.appUrl}${CONFIG.forwardPath}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': CONFIG.webhookSecret,
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    stats.successfulForwards++;
    return { success: true };
    
  } catch (error) {
    stats.failedForwards++;
    log('error', 'Failed to forward webhook:', error.message);
    return { success: false, error: error.message };
  }
}

function parseZabbixPayload(body) {
  // Zabbix sends different payload formats depending on configuration
  // This handles the common format
  
  try {
    const data = JSON.parse(body);
    
    // Common Zabbix webhook fields
    return {
      host: data.host || data.hostname || data['{HOST.NAME}'],
      hostId: data.hostid || data['{HOST.ID}'],
      trigger: data.trigger || data['{TRIGGER.NAME}'],
      triggerId: data.triggerid || data['{TRIGGER.ID}'],
      status: data.status || data['{TRIGGER.STATUS}'], // PROBLEM or OK
      severity: data.severity || data['{EVENT.SEVERITY}'],
      eventId: data.eventid || data['{EVENT.ID}'],
      timestamp: data.timestamp || new Date().toISOString(),
      value: data.value || data['{TRIGGER.VALUE}'], // 0 = OK, 1 = PROBLEM
      raw: data, // Keep raw data for debugging
    };
  } catch (error) {
    log('error', 'Failed to parse webhook payload:', error.message);
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  
  // Read body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    stats.totalWebhooks++;
    stats.lastWebhook = new Date();
    
    if (CONFIG.verbose) {
      log('debug', 'Received webhook:', body);
    }
    
    // Parse payload
    const payload = parseZabbixPayload(body);
    
    if (!payload) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid payload' }));
      return;
    }
    
    log('info', `📨 Webhook received: ${payload.host} - ${payload.trigger} (${payload.status})`);
    
    // Forward to Vercel
    const result = await forwardToVercel(payload);
    
    if (result.success) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true, forwarded: true }));
    } else {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true, forwarded: false, error: result.error }));
    }
  });
});

server.listen(CONFIG.port, () => {
  console.log(`
╔══════════════════════════════════════════╗
║      Zabbix Webhook Relay Started        ║
╚══════════════════════════════════════════╝
  
Listening on port: ${CONFIG.port}
Forwarding to: ${CONFIG.appUrl}${CONFIG.forwardPath}
  
Configure Zabbix webhook URL to:
http://your-vps-ip:${CONFIG.port}/
  
Make sure port ${CONFIG.port} is open in your firewall!
  `);
});

// Health check endpoint
server.on('request', (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: process.uptime(),
      stats,
    }));
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('info', 'SIGINT received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});
