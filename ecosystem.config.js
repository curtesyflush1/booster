// Docker-optimized PM2 configuration
// For non-Docker deployments, use ecosystem.pm2.config.js instead
module.exports = {
  apps: [{
    name: 'booster-beacon-api',
    script: './backend/dist/index.js',
    instances: 1, // Single instance for Docker containers
    exec_mode: 'fork', // Fork mode for containerized environments
    
    // Use env_file for cleaner configuration management
    env_file: '.env',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // Simplified logging for Docker (let Docker handle log aggregation)
    log_type: 'json',
    merge_logs: true,
    time: true,
    
    // Container-optimized settings
    max_memory_restart: '800M', // Lower limit for containers
    node_args: '--max-old-space-size=768',
    watch: false,
    
    // Faster restart for containers
    restart_delay: 2000,
    max_restarts: 5,
    min_uptime: '5s',
    
    // Container health settings
    kill_timeout: 3000,
    listen_timeout: 2000,
    
    autorestart: true,
    
    // Environment-specific overrides
    env_production: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    },
    env_staging: {
      NODE_ENV: 'staging',
      LOG_LEVEL: 'debug'
    },
    env_development: {
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug'
    }
  }]
  
  // No deployment config - handled by Docker/Kubernetes
};