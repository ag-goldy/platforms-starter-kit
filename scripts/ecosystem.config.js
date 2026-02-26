// PM2 configuration for Atlas cron jobs
// Run: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'atlas-cron',
      script: './run-all.sh',
      cwd: '/home/ubuntu/atlas-cron',
      interpreter: '/bin/bash',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      log_file: '/home/ubuntu/atlas-cron/combined.log',
      out_file: '/home/ubuntu/atlas-cron/out.log',
      error_file: '/home/ubuntu/atlas-cron/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
