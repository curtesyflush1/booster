// PM2-specific configuration for non-Docker deployments
module.exports = {
  apps: [{
    name: 'booster-beacon-api',
    script: './backend/dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      // Load from .env file instead of hardcoding
    },
    env_file: '.env.production',
    
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
    
    // Health monitoring
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true,
  }],
  
  deploy: {
    production: {
      user: process.env.DEPLOY_USER || 'derek',
      host: process.env.DEPLOY_HOST || '82.180.162.48',
      ref: 'origin/main',
      repo: process.env.DEPLOY_REPO || 'https://github.com/curtesyflush1/booster.git',
      path: process.env.DEPLOY_PATH || '/opt/booster',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.pm2.config.js --env production',
      'pre-setup': '',
      // SSH key configuration
      key: process.env.DEPLOY_SSH_KEY,
      ssh_options: 'StrictHostKeyChecking=no'
    }
  }
};