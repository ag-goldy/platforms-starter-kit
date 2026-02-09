#!/bin/bash
# User data script for EC2 Zabbix Poller
# This runs on first boot to set up the instance

set -e

echo "=== Starting Zabbix Poller Setup ==="

# Update system
yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs git

# Install CloudWatch agent
yum install -y amazon-cloudwatch-agent

# Create app directory
mkdir -p /opt/zabbix-sync
cd /opt/zabbix-sync

# Create package.json
cat > package.json << 'EOF'
{
  "name": "zabbix-aws-poller",
  "version": "1.0.0",
  "description": "High-frequency Zabbix poller for AWS",
  "main": "poller.js",
  "scripts": {
    "start": "node poller.js",
    "dev": "DEBUG=true node poller.js"
  },
  "dependencies": {
    "node-fetch": "^3.3.2",
    "ioredis": "^5.3.2"
  }
}
EOF

# Install dependencies
npm install

# Create environment file
cat > .env << EOF
APP_URL=${app_url}
CRON_SECRET_TOKEN=${cron_secret_token}
SYNC_INTERVAL_MS=${sync_interval_ms}
ORG_ID=${org_id}
REDIS_ENDPOINT=${redis_endpoint}
USE_REDIS=${use_redis}
USE_WEBHOOK=${use_webhook}
WEBHOOK_SECRET=${webhook_secret}
EOF

# Create the poller script
cat > poller.js << 'POLLER_EOF'
#!/usr/bin/env node
/**
 * AWS-Optimized Zabbix Poller
 * Achieves sub-100ms latency using Redis pub/sub
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const Redis = require('ioredis');

const CONFIG = {
  appUrl: process.env.APP_URL,
  cronToken: process.env.CRON_SECRET_TOKEN,
  syncIntervalMs: parseInt(process.env.SYNC_INTERVAL_MS) || 1000,
  orgId: process.env.ORG_ID || 'ALL',
  redisEndpoint: process.env.REDIS_ENDPOINT,
  useRedis: process.env.USE_REDIS === 'true',
  useWebhook: process.env.USE_WEBHOOK === 'true',
};

// Initialize Redis client if enabled
let redis = null;
if (CONFIG.useRedis && CONFIG.redisEndpoint) {
  redis = new Redis({
    host: CONFIG.redisEndpoint,
    port: 6379,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  });
  
  redis.on('connect', () => {
    console.log('[Redis] Connected');
  });
  
  redis.on('error', (err) => {
    console.error('[Redis] Error:', err.message);
  });
}

const stats = {
  totalSyncs: 0,
  successfulSyncs: 0,
  failedSyncs: 0,
  lastSyncTime: null,
  avgLatency: 0,
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

async function performSync() {
  const startTime = process.hrtime.bigint();
  
  try {
    const url = `${CONFIG.appUrl}/api/zabbix/sync`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orgId: CONFIG.orgId,
        token: CONFIG.cronToken,
      }),
    });
    
    const endTime = process.hrtime.bigint();
    const latencyMs = Number(endTime - startTime) / 1000000; // Convert to ms
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    stats.totalSyncs++;
    stats.successfulSyncs++;
    stats.lastSyncTime = new Date();
    
    // Update rolling average
    stats.avgLatency = (stats.avgLatency * (stats.totalSyncs - 1) + latencyMs) / stats.totalSyncs;
    
    log('info', `✅ Sync ${latencyMs.toFixed(2)}ms`, {
      services: data.results?.length || 0,
    });
    
    // Publish to Redis for real-time updates
    if (redis && data.results) {
      for (const result of data.results) {
        await redis.publish('zabbix:updates', JSON.stringify({
          serviceId: result.serviceId,
          status: result.status,
          timestamp: new Date().toISOString(),
          latency: latencyMs,
        }));
      }
    }
    
    return { success: true, latency: latencyMs };
    
  } catch (error) {
    stats.totalSyncs++;
    stats.failedSyncs++;
    
    log('error', `❌ Sync failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log(`
╔══════════════════════════════════════════╗
║     AWS Zabbix Poller Started            ║
╚══════════════════════════════════════════╝
  
App URL: ${CONFIG.appUrl}
Interval: ${CONFIG.syncIntervalMs}ms (${(CONFIG.syncIntervalMs / 1000).toFixed(3)}s)
Redis: ${CONFIG.useRedis ? 'Enabled' : 'Disabled'}
Org ID: ${CONFIG.orgId}
  `);
  
  // Initial sync
  await performSync();
  
  // Start high-frequency loop
  log('info', `Starting sync loop every ${CONFIG.syncIntervalMs}ms...`);
  
  setInterval(async () => {
    await performSync();
  }, CONFIG.syncIntervalMs);
  
  // Print stats every minute
  setInterval(() => {
    console.log('\n=== Stats ===');
    console.log(`Total: ${stats.totalSyncs} | Success: ${stats.successfulSyncs} | Failed: ${stats.failedSyncs}`);
    console.log(`Avg Latency: ${stats.avgLatency.toFixed(2)}ms`);
    console.log(`Last Sync: ${stats.lastSyncTime?.toISOString() || 'Never'}`);
    console.log('=============\n');
  }, 60000);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'Shutting down...');
  if (redis) redis.disconnect();
  process.exit(0);
});

process.on('SIGINT', () => {
  log('info', 'Shutting down...');
  if (redis) redis.disconnect();
  process.exit(0);
});

main().catch(console.error);
POLLER_EOF

# Create systemd service
cat > /etc/systemd/system/zabbix-poller.service << 'EOF'
[Unit]
Description=Zabbix AWS Poller
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/zabbix-sync
ExecStart=/usr/bin/node /opt/zabbix-sync/poller.js
Restart=always
RestartSec=1
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Configure CloudWatch agent
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'EOF'
{
  "metrics": {
    "namespace": "ZabbixPoller",
    "metrics_collected": {
      "mem": {
        "measurement": ["mem_used_percent"]
      },
      "cpu": {
        "measurement": ["cpu_usage_idle", "cpu_usage_iowait", "cpu_usage_user", "cpu_usage_system"]
      },
      "disk": {
        "measurement": ["used_percent"],
        "resources": ["*"]
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/zabbix-poller.log",
            "log_group_name": "/aws/ec2/zabbix-poller",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
EOF

# Start services
systemctl daemon-reload
systemctl enable zabbix-poller
systemctl start zabbix-poller
systemctl enable amazon-cloudwatch-agent
systemctl start amazon-cloudwatch-agent

# Create log file touchpoint
touch /var/log/zabbix-poller.log

echo "=== Setup Complete ==="
echo "Poller status: $(systemctl is-active zabbix-poller)"
echo "Logs: journalctl -u zabbix-poller -f"
