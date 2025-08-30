# Deployment Strategies

BoosterBeacon supports two primary deployment strategies:

## 1. Docker-based Deployment (Recommended)

**Configuration**: `ecosystem.config.js` + `docker-compose.prod.yml`

**Advantages**:
- Consistent environment across development and production
- Built-in service orchestration (database, Redis, monitoring)
- Easier scaling and load balancing
- Simplified dependency management

**Usage**:
```bash
# Deploy using Docker
./scripts/deploy.sh deploy

# Or manually
docker-compose -f docker-compose.prod.yml up -d --build
```

## 2. Standalone PM2 Deployment

**Configuration**: `ecosystem.pm2.config.js`

**Advantages**:
- Direct server deployment without containers
- Full PM2 feature set (clustering, monitoring, deployment)
- Lower resource overhead for single-server deployments

**Usage**:
```bash
# Deploy using PM2
npm run pm2:deploy

# Or manually
pm2 start ecosystem.pm2.config.js --env production
```

## Configuration Differences

### Docker Configuration (`ecosystem.config.js`)
- Single instance per container
- Fork mode for container compatibility
- Simplified logging (Docker handles aggregation)
- Lower memory limits optimized for containers
- No deployment configuration (handled by Docker)

### Standalone Configuration (`ecosystem.pm2.config.js`)
- Multiple instances with clustering
- Full PM2 deployment pipeline
- Direct log file management
- Higher resource limits for bare metal
- Built-in deployment automation

## Choosing the Right Strategy

**Use Docker when**:
- You need consistent environments
- You want built-in monitoring and logging
- You plan to scale horizontally
- You prefer infrastructure as code

**Use PM2 standalone when**:
- You have a single server deployment
- You need maximum performance on bare metal
- You want direct control over the Node.js process
- You prefer traditional server management

## Migration Between Strategies

To switch from PM2 to Docker:
1. Ensure your `.env.production` file is properly configured
2. Build Docker images: `docker-compose -f docker-compose.prod.yml build`
3. Stop PM2: `pm2 stop all`
4. Start Docker: `docker-compose -f docker-compose.prod.yml up -d`

To switch from Docker to PM2:
1. Stop Docker containers: `docker-compose -f docker-compose.prod.yml down`
2. Ensure database and Redis are running separately
3. Start PM2: `pm2 start ecosystem.pm2.config.js --env production`