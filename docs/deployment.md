# Deployment Guide

This document covers the deployment process for BoosterBeacon using PM2 and the automated deployment script.

## PM2 Configuration

The application uses PM2 for production process management with the following features:

### Cluster Mode
- **Instances**: `max` - Utilizes all available CPU cores
- **Exec Mode**: `cluster` - Load balances across instances
- **Memory Limit**: 1GB per instance with automatic restart
- **Node Args**: `--max-old-space-size=1024` for memory optimization

### Logging
- **Error Log**: `./logs/err.log`
- **Output Log**: `./logs/out.log`
- **Combined Log**: `./logs/combined.log`
- **Timestamps**: Enabled for all log entries

### Restart Policy
- **Max Restarts**: 10 attempts before giving up
- **Restart Delay**: 4 seconds between restart attempts
- **Min Uptime**: 10 seconds before considering restart successful
- **Watch Mode**: Disabled (manual restarts only)

## Deployment Script

The `scripts/deploy.sh` script provides automated deployment with the following features:

### Commands
```bash
# Full deployment (default)
./scripts/deploy.sh
npm run deploy:prod

# Rollback to previous release
./scripts/deploy.sh rollback
npm run rollback

# Sync files only (no restart)
./scripts/deploy.sh sync-only

# Restart services only
./scripts/deploy.sh restart-only

# Health check only
./scripts/deploy.sh check
```

### Deployment Process

1. **Pre-deployment Checks**
   - SSH connection verification
   - Test suite execution
   - Application build process

2. **File Synchronization**
   - Creates timestamped release directory
   - Syncs files excluding development artifacts
   - Uses `.rsyncignore` for exclusion patterns

3. **Dependency Installation**
   - Runs `npm ci --production` on remote server
   - Installs only production dependencies

4. **Database Migrations**
   - Executes pending database migrations
   - Ensures schema is up-to-date

5. **Atomic Deployment**
   - Updates symlink to new release
   - Zero-downtime deployment

6. **Service Management**
   - Restarts PM2 processes
   - Verifies service health

7. **Cleanup**
   - Maintains last 5 releases for rollback
   - Removes older releases automatically

### Configuration Requirements

#### Server Setup
- SSH key-based authentication configured
- PM2 installed globally on target server
- Node.js 18+ installed
- PostgreSQL database accessible

#### Environment Variables
Ensure the following are configured on the production server:
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@localhost:5432/boosterbeacon
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_production_secret
```

#### Directory Structure
The deployment creates the following structure on the server:
```
/opt/booster/
├── current -> releases/20240826-143022/
├── releases/
│   ├── 20240826-143022/
│   ├── 20240825-120000/
│   └── ...
└── logs/
    ├── err.log
    ├── out.log
    └── combined.log
```

## PM2 Management Commands

### Basic Operations
```bash
# Start application
npm run pm2:start
pm2 start ecosystem.config.js

# Restart application
npm run pm2:restart
pm2 restart booster-beacon-api

# Stop application
npm run pm2:stop
pm2 stop booster-beacon-api

# View logs
npm run pm2:logs
pm2 logs booster-beacon-api

# Monitor in real-time
npm run pm2:monit
pm2 monit
```

### Advanced Operations
```bash
# View detailed status
pm2 status

# Reload with zero downtime
pm2 reload booster-beacon-api

# Scale instances
pm2 scale booster-beacon-api 4

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

## Monitoring and Troubleshooting

### Health Checks
The deployment script includes automatic health checks:
- Verifies HTTP response from `/health` endpoint
- Checks service startup within 5 seconds
- Displays recent logs on failure

### Log Analysis
```bash
# View recent logs
pm2 logs booster-beacon-api --lines 50

# Follow logs in real-time
pm2 logs booster-beacon-api -f

# View error logs only
pm2 logs booster-beacon-api --err

# View JSON formatted logs
pm2 logs booster-beacon-api --json
```

### Performance Monitoring
```bash
# Real-time monitoring dashboard
pm2 monit

# Memory and CPU usage
pm2 status

# Detailed process information
pm2 show booster-beacon-api
```

## Rollback Procedure

If issues are detected after deployment:

1. **Automatic Rollback**
   ```bash
   ./scripts/deploy.sh rollback
   npm run rollback
   ```

2. **Manual Rollback**
   ```bash
   # SSH to server
   ssh derek@82.180.162.48
   
   # List available releases
   ls -la /opt/booster/releases/
   
   # Switch to previous release
   cd /opt/booster
   ln -sfn releases/PREVIOUS_RELEASE current
   
   # Restart services
   pm2 restart booster-beacon-api
   ```

3. **Verification**
   - Check application health endpoint
   - Verify logs for errors
   - Test critical functionality

## Security Considerations

- SSH keys used for authentication (no passwords)
- Production environment variables secured
- File permissions properly configured
- Database credentials encrypted in transit
- PM2 processes run with limited privileges

## Backup Strategy

Before each deployment:
- Database backup created automatically
- Previous release maintained for rollback
- Configuration files backed up
- Logs rotated and archived

For manual backups:
```bash
# Database backup
npm run db:backup

# Full application backup
rsync -avz derek@82.180.162.48:/opt/booster/ ./backups/
```