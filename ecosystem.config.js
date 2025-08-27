module.exports = {
  apps: [{
    name: 'booster-beacon-api',
    script: './backend/dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      // Email service configuration
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_SECURE: process.env.SMTP_SECURE,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      FROM_EMAIL: process.env.FROM_EMAIL,
      FROM_NAME: process.env.FROM_NAME,
      // Notification services
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
      DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
      // Web Push VAPID keys
      VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
      VAPID_SUBJECT: process.env.VAPID_SUBJECT,
      // Retailer API keys
      BESTBUY_API_KEY: process.env.BESTBUY_API_KEY,
      WALMART_API_KEY: process.env.WALMART_API_KEY,
      // Database and Redis
      DATABASE_URL: process.env.DATABASE_URL,
      REDIS_URL: process.env.REDIS_URL,
      // JWT configuration
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
      JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,
      // Frontend URL for CORS and links
      FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost'
    },
    // Logging configuration
    error_file: './logs/backend/err.log',
    out_file: './logs/backend/out.log',
    log_file: './logs/backend/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Performance and reliability settings
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'frontend'],
    
    // Restart configuration
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    exp_backoff_restart_delay: 100,
    
    // Health monitoring
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Advanced PM2 features
    merge_logs: true,
    autorestart: true,
    
    // Environment-specific overrides
    env_production: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    },
    env_staging: {
      NODE_ENV: 'staging',
      LOG_LEVEL: 'debug'
    }
  }],
  
  // PM2 deployment configuration
  deploy: {
    production: {
      user: 'derek',
      host: '82.180.162.48',
      ref: 'origin/main',
      repo: 'https://github.com/curtesyflush1/booster.git',
      path: '/opt/booster',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};