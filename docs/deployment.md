# BoosterBeacon Deployment Guide

## 🚀 Overview

BoosterBeacon is a production-ready, enterprise-grade platform with comprehensive deployment capabilities including automated catalog ingestion, subscription management, real-time features, and advanced monitoring.

## 📋 Prerequisites

### System Requirements
- **Node.js**: 18+ (LTS recommended)
- **PostgreSQL**: 15+ with PostGIS extension
- **Redis**: 6+ for caching and sessions
- **Docker**: 20+ for containerized deployment
- **Nginx**: For reverse proxy and SSL termination
- **PM2**: For process management (optional)

### Infrastructure Requirements
- **CPU**: 2+ cores (4+ recommended for production)
- **RAM**: 4GB+ (8GB+ recommended for production)
- **Storage**: 50GB+ SSD storage
- **Network**: Stable internet connection for retailer APIs

## 🏗️ Architecture Components

### Core Services
- **Backend API**: Node.js/Express with TypeScript
- **Frontend**: React with Vite and TypeScript
- **Browser Extension**: Chrome/Firefox extension
- **Background Services**: Automated catalog ingestion and monitoring
- **Real-Time**: WebSocket integration for live updates
- **ML System**: Advanced predictions and analytics

### External Integrations
- **Stripe**: Subscription management and billing
- **AWS S3**: File storage and backups
- **Retailer APIs**: Best Buy, Walmart, Costco, Sam's Club
- **Email Services**: SES, SMTP, or Ethereal for development
- **Monitoring**: Grafana, Loki, Prometheus stack

## 🔧 Environment Configuration

### Required Environment Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/boosterbeacon
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your_super_secure_jwt_secret_key
JWT_REFRESH_SECRET=your_refresh_token_secret

# Email Configuration
EMAIL_PROVIDER=ses  # ses, smtp, ethereal
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
FROM_EMAIL=alerts@boosterbeacon.com
FROM_NAME=BoosterBeacon

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Retailer API Keys
BESTBUY_API_KEY=your_bestbuy_api_key
WALMART_API_KEY=your_walmart_api_key

# AWS Configuration (if using S3)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
S3_BUCKET=boosterbeacon-storage

# Application Configuration
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://boosterbeacon.com
DOMAIN=boosterbeacon.com

# Memory Service (OpenMemory)
OPENMEMORY_MEMORIES_URL=your_openmemory_endpoint
OPENMEMORY_API_KEY=your_openmemory_api_key
```

### Optional Environment Variables

```bash
# Advanced Configuration
LOG_LEVEL=info
MAX_FILE_SIZE=10485760
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=1000

# Monitoring
GRAFANA_URL=http://localhost:3000
PROMETHEUS_URL=http://localhost:9090

# Development
DEBUG=false
ENABLE_SWAGGER=true
```

## 🐳 Docker Deployment

### Configure VPS Target (Optional)

For SSH-based deployments via scripts, create `deploy.env` at the repo root (copy from `deploy.env.example`) and set:

- `DEPLOY_USER`, `DEPLOY_HOST`, `DEPLOY_PATH`
- Optional: `DOMAIN` for nginx `server_name`
- Optional: `SSH_OPTS` and `RSYNC_OPTS` for custom port / identity file

Scripts like `scripts/deploy.sh`, `scripts/quick-deploy.sh`, and `scripts/verify-production.sh` will automatically source this file.

### Quick Start with Docker Compose

```bash
# Clone the repository
git clone https://github.com/your-org/boosterbeacon.git
cd boosterbeacon

# Copy environment file
cp .env.example .env
# Edit .env with your configuration

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose exec backend npm run migrate:up

# Seed initial data
docker-compose exec backend npm run seed:prod
```

### Production Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/boosterbeacon
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - boosterbeacon

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    environment:
      - VITE_API_URL=https://api.boosterbeacon.com
    restart: unless-stopped
    networks:
      - boosterbeacon

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/boosterbeacon.conf:/etc/nginx/conf.d/default.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend
    restart: unless-stopped
    networks:
      - boosterbeacon

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=boosterbeacon
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped
    networks:
      - boosterbeacon

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - boosterbeacon

  monitoring:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    restart: unless-stopped
    networks:
      - boosterbeacon

volumes:
  postgres_data:
  redis_data:
  grafana_data:

networks:
  boosterbeacon:
    driver: bridge
```

## 🚀 Manual Deployment

### 1. Backend Deployment

```bash
# Install dependencies
cd backend
npm install --production

# Build the application
npm run build

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run migrate:up

# Start the application
npm start
```

### 2. Frontend Deployment

```bash
# Install dependencies
cd frontend
npm install

# Build for production
npm run build

# Serve with a static server
npm install -g serve
serve -s dist -l 3000
```

### 3. Extension Deployment

```bash
# Build extension
cd extension
npm install
npm run build:chrome  # or build:firefox

# Package for distribution
npm run package:chrome
```

## 🔒 SSL Configuration

### Automatic SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d boosterbeacon.com -d www.boosterbeacon.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Manual SSL Certificate

```bash
# Create SSL directory
sudo mkdir -p /etc/nginx/ssl

# Copy your certificates
sudo cp boosterbeacon.com.crt /etc/nginx/ssl/
sudo cp boosterbeacon.com.key /etc/nginx/ssl/

# Set permissions
sudo chmod 600 /etc/nginx/ssl/*
```

## 📊 Monitoring Setup

### Grafana Configuration

```yaml
# monitoring/grafana/datasources/prometheus.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

### Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'boosterbeacon-backend'
    static_configs:
      - targets: ['backend:3001']
    metrics_path: '/metrics'

  - job_name: 'boosterbeacon-frontend'
    static_configs:
      - targets: ['frontend:3000']
```

## 🔄 Automated Deployment Scripts

### Production Deployment

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

ENVIRONMENT=${1:-production}
ACTION=${2:-deploy}

echo "Deploying BoosterBeacon to $ENVIRONMENT..."

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build applications
npm run build

# Run database migrations
cd backend && npm run migrate:up && cd ..

# Restart services
if [ "$ENVIRONMENT" = "production" ]; then
    pm2 restart booster-beacon-api
    pm2 restart booster-beacon-frontend
else
    docker-compose -f docker-compose.dev.yml restart
fi

echo "Deployment completed successfully!"
```

### Health Check Script

```bash
#!/bin/bash
# scripts/health-check.sh

# Check backend health
curl -f http://localhost:3001/health || exit 1

# Check database connection
curl -f http://localhost:3001/api/health/database || exit 1

# Check Redis connection
curl -f http://localhost:3001/api/health/redis || exit 1

echo "All health checks passed!"
```

## 🔧 PM2 Configuration

### Ecosystem Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'booster-beacon-api',
      script: './backend/dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'booster-beacon-frontend',
      script: 'serve',
      args: '-s frontend/dist -l 3000',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

### PM2 Commands

```bash
# Start applications
pm2 start ecosystem.config.js

# Monitor applications
pm2 monit

# View logs
pm2 logs booster-beacon-api

# Restart applications
pm2 restart booster-beacon-api

# Stop applications
pm2 stop booster-beacon-api

# Delete applications
pm2 delete booster-beacon-api
```

## 🔄 Database Management

### Migration Commands

```bash
# Run migrations
cd backend
npm run migrate:up

# Rollback migrations
npm run migrate:down

# Check migration status
npm run migrate:status

# Create new migration
npm run migrate:make -- create_users_table
```

### Backup and Restore

```bash
# Create backup
pg_dump -h localhost -U user -d boosterbeacon > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
psql -h localhost -U user -d boosterbeacon < backup_20240915_143000.sql

# Automated backup script
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U user -d boosterbeacon | gzip > "$BACKUP_DIR/backup_$DATE.sql.gz"
```

## 🚨 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database status
sudo systemctl status postgresql

# Check connection
psql -h localhost -U user -d boosterbeacon -c "SELECT 1;"

# Restart database
sudo systemctl restart postgresql
```

#### Redis Connection Issues
```bash
# Check Redis status
sudo systemctl status redis

# Test Redis connection
redis-cli ping

# Restart Redis
sudo systemctl restart redis
```

#### Application Issues
```bash
# Check application logs
pm2 logs booster-beacon-api

# Check system resources
htop

# Check network connectivity
netstat -tulpn | grep :3001
```

### Performance Optimization

#### Database Optimization
```sql
-- Create indexes for better performance
CREATE INDEX idx_products_upc ON products(upc);
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_watches_user_id ON watches(user_id);

-- Analyze table statistics
ANALYZE products;
ANALYZE alerts;
ANALYZE watches;
```

#### Redis Optimization
```bash
# Configure Redis for better performance
echo "maxmemory 256mb" >> /etc/redis/redis.conf
echo "maxmemory-policy allkeys-lru" >> /etc/redis/redis.conf
sudo systemctl restart redis
```

## 📈 Scaling Considerations

### Horizontal Scaling
- Use load balancer for multiple backend instances
- Configure Redis cluster for distributed caching
- Use PostgreSQL read replicas for read-heavy workloads

### Vertical Scaling
- Increase server resources (CPU, RAM, Storage)
- Optimize database queries and indexes
- Implement connection pooling

### Performance Monitoring
- Monitor response times and throughput
- Track database query performance
- Monitor cache hit rates
- Set up alerting for performance degradation

## 🔐 Security Best Practices

### Network Security
- Use HTTPS for all communications
- Implement rate limiting
- Configure firewall rules
- Use VPN for admin access

### Application Security
- Keep dependencies updated
- Implement input validation
- Use secure session management
- Regular security audits

### Data Security
- Encrypt sensitive data at rest
- Use secure communication protocols
- Implement access controls
- Regular backup testing

---

**Last Updated**: September 2024
**Deployment Version**: 2.0
**Status**: Production Ready
