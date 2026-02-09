module.exports = {
  apps: [
    {
      name: 'zabbix-poller',
      script: './poller.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        // Edit these or use .env file
        APP_URL: 'https://yourdomain.com',
        CRON_SECRET_TOKEN: 'your-secret-token',
        SYNC_INTERVAL_MS: '10000', // 10 seconds
        ORG_ID: 'ALL',
        VERBOSE: 'false',
      },
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Restart strategy
      min_uptime: '10s',
      max_restarts: 5,
      // Error handling
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};
