#!/usr/bin/env node
/**
 * Zabbix VPS Poller
 * 
 * Run this on your external VPS for high-frequency syncing.
 * Calls your Vercel app's sync endpoint at regular intervals.
 * 
 * Setup:
 * 1. Copy this file to your VPS
 * 2. npm install node-fetch
 * 3. Set environment variables or edit config below
 * 4. node poller.js
 * 5. (Optional) Use PM2 to keep it running: pm2 start poller.js
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Configuration - Edit these or use environment variables
const CONFIG = {
  // Your Vercel app domain
  appUrl: process.env.APP_URL || 'https://yourdomain.com',
  
  // Secret token (must match CRON_SECRET_TOKEN on Vercel)
  cronToken: process.env.CRON_SECRET_TOKEN || 'your-secret-token',
  
  // Sync interval in milliseconds
  // 5000 = 5 seconds, 10000 = 10 seconds, 30000 = 30 seconds, 60000 = 1 minute
  syncIntervalMs: parseInt(process.env.SYNC_INTERVAL_MS) || 10000,
  
  // Organization ID to sync (or 'ALL' to sync all orgs with Zabbix configured)
  orgId: process.env.ORG_ID || 'ALL',
  
  // Enable verbose logging
  verbose: process.env.VERBOSE === 'true',
  
  // Retry on failure
  retryAttempts: 3,
  retryDelayMs: 5000,
};

// Stats tracking
const stats = {
  totalSyncs: 0,
  successfulSyncs: 0,
  failedSyncs: 0,
  lastSyncTime: null,
  servicesSynced: 0,
  errors: [],
};

/**
 * Log with timestamp
 */
function log(level, message, data) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (data) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

/**
 * Perform sync
 */
async function performSync() {
  const startTime = Date.now();
  
  try {
    const url = `${CONFIG.appUrl}/api/zabbix/sync`;
    
    if (CONFIG.verbose) {
      log('debug', `Syncing to: ${url}`);
    }
    
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
    
    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    stats.totalSyncs++;
    stats.successfulSyncs++;
    stats.lastSyncTime = new Date();
    stats.servicesSynced = data.results?.length || 0;
    
    log('info', `✅ Sync completed in ${duration}ms`, {
      services: data.results?.length || 0,
      duration: `${duration}ms`,
    });
    
    if (CONFIG.verbose && data.results) {
      data.results.forEach(result => {
        log('debug', `  - ${result.serviceName}: ${result.status}`);
      });
    }
    
    return { success: true, data };
    
  } catch (error) {
    stats.totalSyncs++;
    stats.failedSyncs++;
    
    const errorMsg = error instanceof Error ? error.message : String(error);
    stats.errors.push({ time: new Date(), error: errorMsg });
    
    // Keep only last 10 errors
    if (stats.errors.length > 10) {
      stats.errors.shift();
    }
    
    log('error', `❌ Sync failed: ${errorMsg}`);
    
    return { success: false, error: errorMsg };
  }
}

/**
 * Retry wrapper for sync
 */
async function syncWithRetry(attempt = 1) {
  const result = await performSync();
  
  if (!result.success && attempt < CONFIG.retryAttempts) {
    log('warn', `Retrying sync (attempt ${attempt + 1}/${CONFIG.retryAttempts})...`);
    await sleep(CONFIG.retryDelayMs);
    return syncWithRetry(attempt + 1);
  }
  
  return result;
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Print stats
 */
function printStats() {
  const uptime = process.uptime();
  const uptimeHours = Math.floor(uptime / 3600);
  const uptimeMinutes = Math.floor((uptime % 3600) / 60);
  
  console.log('\n=== Zabbix Poller Stats ===');
  console.log(`Uptime: ${uptimeHours}h ${uptimeMinutes}m`);
  console.log(`Total Syncs: ${stats.totalSyncs}`);
  console.log(`Successful: ${stats.successfulSyncs} (${((stats.successfulSyncs / stats.totalSyncs) * 100 || 0).toFixed(1)}%)`);
  console.log(`Failed: ${stats.failedSyncs}`);
  console.log(`Last Sync: ${stats.lastSyncTime?.toISOString() || 'Never'}`);
  console.log(`Interval: ${CONFIG.syncIntervalMs}ms (${(CONFIG.syncIntervalMs / 1000).toFixed(1)}s)`);
  console.log('===========================\n');
}

/**
 * Main loop
 */
async function main() {
  console.log(`
╔══════════════════════════════════════════╗
║       Zabbix VPS Poller Started          ║
╚══════════════════════════════════════════╝
  
App URL: ${CONFIG.appUrl}
Org ID: ${CONFIG.orgId}
Interval: ${CONFIG.syncIntervalMs}ms (${(CONFIG.syncIntervalMs / 1000).toFixed(1)} seconds)
Retry: ${CONFIG.retryAttempts} attempts
  `);
  
  // Validate config
  if (!CONFIG.appUrl || CONFIG.appUrl === 'https://yourdomain.com') {
    log('error', 'Please set APP_URL environment variable or edit CONFIG.appUrl');
    process.exit(1);
  }
  
  if (!CONFIG.cronToken || CONFIG.cronToken === 'your-secret-token') {
    log('error', 'Please set CRON_SECRET_TOKEN environment variable or edit CONFIG.cronToken');
    process.exit(1);
  }
  
  // Initial sync
  log('info', 'Performing initial sync...');
  await syncWithRetry();
  
  // Start interval
  log('info', `Starting sync loop every ${CONFIG.syncIntervalMs}ms...`);
  
  setInterval(async () => {
    await syncWithRetry();
  }, CONFIG.syncIntervalMs);
  
  // Print stats every 5 minutes
  setInterval(() => {
    printStats();
  }, 5 * 60 * 1000);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log('info', '\nShutting down gracefully...');
    printStats();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    log('info', '\nShutting down gracefully...');
    printStats();
    process.exit(0);
  });
}

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  log('error', 'Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception:', error);
});

// Start
main().catch(error => {
  log('error', 'Failed to start:', error);
  process.exit(1);
});
