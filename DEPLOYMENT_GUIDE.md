# BoosterBeacon Production Deployment Guide

This guide covers deploying BoosterBeacon to production using Docker containers.

## Prerequisites

### Local Development Machine
- Node.js 20+
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

2. **Configure Deployment Targets**
   Copy `deploy.env.example` to `deploy.env` and set your VPS details:
   ```bash
   cp deploy.env.example deploy.env
   nano deploy.env   # set DEPLOY_USER, DEPLOY_HOST, DEPLOY_PATH, optional DOMAIN
   ```

3. **Configure Production Environment**
   Edit `.env.production` with your actual values:
   ```bash
   nano .env.production
   ```

4. **Deploy to Production**
   ```bash
   npm run deploy:prod
   ```

5. **Set JWT Secrets (first deploy)**
   - On the server, ensure `/opt/booster/.env` contains strong secrets:
     - `JWT_SECRET`, `JWT_REFRESH_SECRET`
   - The compose file injects these into the app container.

## Detailed Deployment Process

### Step 1: Environment Configuration

The `.env.production` file contains all production configuration. Update these critical values (and mirror into `/opt/booster/.env` on the server):

```bash
# Database - Use strong passwords
DATABASE_URL=postgresql://booster_user:STRONG_PASSWORD@db:5432/boosterbeacon_prod

# JWT - Generate secure secret
JWT_SECRET=your_very_secure_jwt_secret_key_here_change_this_in_production
JWT_REFRESH_SECRET=your_very_secure_jwt_refresh_secret_key_here

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

Note: The Docker images use Node 20. Host Node.js is optional; if you install it, prefer Node 20+.

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

Configuration is read from `deploy.env` when present; you can still override via environment variables (e.g., `DEPLOY_HOST=1.2.3.4 npm run deploy:prod`).
\n+Required secrets (first run): ensure `/opt/booster/.env` includes `JWT_SECRET` and `JWT_REFRESH_SECRET`. The compose file injects these into the app container.

Recommended rsync options to avoid attribute warnings (set locally in `deploy.env`):
```
RSYNC_OPTS="--no-perms --no-owner --no-group --omit-dir-times"
```

Compose tip: Docker Compose v2 ignores the top-level `version:` key and logs a warning; you can safely remove it from `docker-compose.prod.yml`.
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

#### Plans and Watch Limits
After a fresh deployment, ensure subscription plans exist and reflect the correct watch limits:

- Free: max_watches = 2
- Pro (monthly/yearly): max_watches = 10
- Premium: max_watches = null (unlimited)

Run migrations and seeds if needed:
```bash
docker-compose -f docker-compose.prod.yml exec app sh -c "cd backend && npm run migrate:up && npm run seed:dev"
```

Stripe environment variables to verify (production):
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_YEARLY_PRICE_ID` (optional)
- `STRIPE_PREMIUM_MONTHLY_PRICE_ID`
- `STRIPE_PREMIUM_SETUP_FEE_PRICE_ID` (for Premium setup fee)
- `STRIPE_WEBHOOK_SECRET` (recommended)

#### Email (Dev and Production)
- Development:
  - If you do not set SMTP variables, the backend will use a Nodemailer Ethereal test account automatically and print a preview URL to the server logs when sending contact emails.
  - To test real SMTP in dev, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_TLS_REJECT_UNAUTHORIZED` in `backend/.env`.
- Production:
  - Set your SMTP provider credentials and `FROM_EMAIL`, `FROM_NAME`, `SUPPORT_EMAIL` in `.env.production`.
  - Verify connectivity using your provider’s tools and check `/api/email` routes where applicable.

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

# If you already have a bundle on the server (e.g., /opt/booster/nginx/ssl/boosterbeacon.com-ssl-bundle),
# map Nginx’s expected paths by symlink:
ln -sfn /opt/booster/nginx/ssl/boosterbeacon.com-ssl-bundle/domain.cert.pem /opt/booster/nginx/ssl/cert.pem
ln -sfn /opt/booster/nginx/ssl/boosterbeacon.com-ssl-bundle/private.key.pem /opt/booster/nginx/ssl/key.pem

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

#### Nginx container fails to start (SSL)
```
nginx: [emerg] cannot load certificate "/etc/ssl/cert.pem": No such file or directory
```
Fix: Ensure `/opt/booster/nginx/ssl/cert.pem` and `/opt/booster/nginx/ssl/key.pem` exist (symlink to your bundle or Let’s Encrypt paths). Recreate Nginx:
```
docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
```

#### Nginx fails: "host not found in upstream app:3000"
The app container isn’t up. Start the app and check logs:
```
docker compose -f docker-compose.prod.yml up -d app
docker compose -f docker-compose.prod.yml logs app --tail=200
```

#### Node 18 runtime crash (undici) – “File is not defined”
Use Node 20-based images. The Dockerfile uses `node:20-alpine`.

#### PWA service worker caches localhost API
If registration calls try to hit `localhost:3000`, update `vite.config.ts` workbox runtimeCaching to match same-origin:
```ts
// In frontend/vite.config.ts (workbox.runtimeCaching[0])
urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
```
Ensure icons referenced in the manifest exist under `frontend/public/icons/` (e.g., `icon-192.png`, `icon-512.png`). Rebuild the frontend and update the service worker (Application tab → Unregister → Reload).

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

## Keeping Prod and Repo in Sync

If you hotfix directly on the production server, pull those changes back into the repo or re‑apply them locally before the next deploy. Practical tips:

- Prefer fixing in the repo and using `npm run deploy:quick` to sync changes.
- If you must patch the server:
  - Document what you changed and send a PR mirroring the change.
  - For frontend PWA and icons, use the helper script:
    - `./scripts/sync-frontend-assets.sh` (runs locally)
      - Copies `frontend/public/icons/*` to `${DEPLOY_PATH}/frontend/dist/icons/` on the server.
      - Patches the server `sw.js` to allow any host for `/api/*` caching (instead of `localhost:3000`).
    - Options: `--icons` or `--sw` to run a single step.
- To avoid divergence, schedule a post‑deploy audit to remove the `version:` key from compose, confirm Node 20, and ensure `/opt/booster/.env` contains `JWT_SECRET` and `JWT_REFRESH_SECRET`.

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
