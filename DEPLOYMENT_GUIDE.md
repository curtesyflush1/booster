# BoosterBeacon Production Deployment Guide

This guide covers deploying BoosterBeacon to production using Docker containers.

## Prerequisites

### Local Development Machine
- Node.js 18+
- npm 9+
- Docker and Docker Compose
- SSH access to production server

### Production Server
- Ubuntu 20.04+ or similar Linux distribution
- Docker and Docker Compose installed
- SSH access configured
- At least 2GB free disk space
- Ports 80 and 443 available

## Quick Start

1. **Verify Environment**
   ```bash
   npm run deploy:verify
   ```

2. **Configure Production Environment**
   Edit `.env.production` with your actual values:
   ```bash
   nano .env.production
   ```

3. **Deploy to Production**
   ```bash
   npm run deploy:prod
   ```

## Detailed Deployment Process

### Step 1: Environment Configuration

The `.env.production` file contains all production configuration. Update these critical values:

```bash
# Database - Use strong passwords
DATABASE_URL=postgresql://booster_user:STRONG_PASSWORD@db:5432/boosterbeacon_prod

# JWT - Generate secure secret
JWT_SECRET=your_very_secure_jwt_secret_key_here_change_this_in_production

# Domain - Your actual domain
FRONTEND_URL=https://your-domain.com
SEO_BASE_URL=https://your-domain.com

# Email Service - Configure SES or SMTP
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
FROM_EMAIL=alerts@your-domain.com

# API Keys - Add your retailer API keys
BESTBUY_API_KEY=your_bestbuy_api_key
WALMART_API_KEY=your_walmart_api_key
```

### Step 2: Server Preparation

If this is your first deployment, run the server setup script:

```bash
./scripts/setup-production.sh
```

This script will:
- Install Docker and Docker Compose
- Create necessary directories
- Configure basic security
- Set up log rotation

### Step 3: Deployment Options

#### Full Production Deployment
```bash
npm run deploy:prod
```

This performs:
- Environment verification
- Application building
- File synchronization
- Service deployment
- Health checks
- Rollback on failure
\n+Additional automation:
- If `backend/data/products.csv` exists on the server, the deploy script runs the CSV importer automatically to upsert your catalog.
- If `boosterbeacon.com-ssl-bundle.zip` is present at repo root, it extracts to `nginx/ssl/` (requires `unzip` installed on server).
- If `DOMAIN` env var is provided when invoking the script, it substitutes `server_name your-domain.com;` in `nginx/nginx.conf` with your domain.

#### Quick Deployment (for code changes)
```bash
npm run deploy:quick
```

This performs:
- Quick build check
- Sync only built files
- Restart application container
- Health check

#### Deployment Verification
```bash
npm run deploy:verify
```

Checks:
- Local environment setup
- Server connectivity
- Required software installation
- Current deployment status

### Step 4: Post-Deployment

#### Check Status
```bash
npm run deploy:status
```

#### View Logs
```bash
npm run deploy:logs
```

#### Health Check
```bash
npm run deploy:health
```

## Service Architecture

The production deployment uses Docker Compose with these services:

- **nginx**: Reverse proxy and SSL termination
- **app**: Main application (Node.js backend + React frontend)
- **db**: PostgreSQL database
- **redis**: Cache and session store
- **prometheus**: Metrics collection
- **grafana**: Monitoring dashboard
- **loki**: Log aggregation
- **backup**: Automated database backups

## SSL/HTTPS Setup

After initial deployment, configure SSL:

```bash
# SSH to your server
ssh derek@82.180.162.48

# Install SSL certificate
sudo certbot --nginx -d your-domain.com

# Update nginx configuration if needed (or pass DOMAIN when deploying)
sudo nano /opt/booster/nginx/nginx.conf
```

## Database Management

### Migrations
Migrations run automatically during deployment. To run manually:

```bash
# SSH to server
ssh derek@82.180.162.48
cd /opt/booster

# Run migrations
docker-compose -f docker-compose.prod.yml exec app sh -c "cd backend && npm run migrate:up"
```

### Backups
Automated backups run daily. To create manual backup:

```bash
npm run deploy:backup
```

### Restore from Backup
```bash
npm run deploy:restore
```

## Monitoring

### Application Metrics
- Grafana Dashboard: `https://your-domain.com:3001`
- Prometheus: `https://your-domain.com:9090`

### Log Monitoring
- Application logs: `docker-compose logs app`
- Nginx logs: `docker-compose logs nginx`
- Database logs: `docker-compose logs db`

## Troubleshooting

### Common Issues

#### Deployment Fails at Health Check
```bash
# Check application logs
npm run deploy:logs

# Check service status
npm run deploy:status

# Manual health check
curl http://your-server:3000/health
```

#### Database Connection Issues
```bash
# Check database service
docker-compose -f docker-compose.prod.yml ps db

# Check database logs
docker-compose -f docker-compose.prod.yml logs db

# Test database connection
docker-compose -f docker-compose.prod.yml exec db psql -U booster_user -d boosterbeacon_prod
```

#### SSL Certificate Issues
```bash
# Renew certificate
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

### Rollback Procedure

If deployment fails or issues arise:

```bash
npm run rollback
```

This will:
- Stop current services
- Restore previous application files
- Restore database from backup
- Restart services
- Verify health

## Performance Optimization

### Resource Limits
The docker-compose.prod.yml includes resource limits:
- App: 1GB memory, 0.5 CPU
- Database: 1GB memory, 0.5 CPU
- Redis: 512MB memory, 0.25 CPU

### Scaling
To scale the application:

```bash
# Scale app service to 3 instances
docker-compose -f docker-compose.prod.yml up -d --scale app=3
```

## Security Considerations

1. **Environment Variables**: Never commit production secrets to git
2. **Database**: Use strong passwords and limit connections
3. **SSL**: Always use HTTPS in production
4. **Firewall**: Configure UFW to limit access
5. **Updates**: Keep system and Docker images updated

## Maintenance

### Regular Tasks
- Monitor disk space and logs
- Update SSL certificates (automated with certbot)
- Review application metrics
- Test backup/restore procedures

### Updates
For application updates:
1. Test changes locally
2. Deploy to staging (if available)
3. Run `npm run deploy:prod`
4. Monitor application health
5. Rollback if issues occur

## Support

For deployment issues:
1. Check this guide
2. Review application logs
3. Verify environment configuration
4. Test connectivity and permissions

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `REDIS_URL` | Redis connection string | Yes | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `FRONTEND_URL` | Frontend application URL | Yes | - |
| `AWS_ACCESS_KEY_ID` | AWS access key for SES | No | - |
| `BESTBUY_API_KEY` | Best Buy API key | No | - |
| `WALMART_API_KEY` | Walmart API key | No | - |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | No | - |
| `DISCORD_BOT_TOKEN` | Discord bot token | No | - |

See `.env.production` for complete list of configuration options.
