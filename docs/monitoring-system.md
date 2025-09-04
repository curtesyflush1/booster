# Monitoring and Metrics System

The BoosterBeacon monitoring system provides comprehensive system health monitoring, metrics collection, alerting, and performance tracking capabilities.

## Overview

The monitoring system consists of several key components:

- **Health Check Service** - System health monitoring and status reporting
- **Monitoring Service** - Metrics collection, alert rule management, and system monitoring
- **Health Endpoints** - HTTP endpoints for health checks and system status
- **Monitoring API** - REST API for metrics and alert management
- **Real-time Alerting** - Automated alert generation based on configurable rules

## Health Check System

### Health Endpoints

#### Basic Health Check
```
GET /health
```
Lightweight endpoint for load balancers and basic health monitoring.

**Response:**
```json
{
  "status": "healthy",
  "service": "booster-beacon-api",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "correlationId": "abc123"
}
```

#### Detailed Health Check
```
GET /health/detailed
```
Comprehensive system health check including database, Redis, memory, disk, and external services.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": {
      "status": "pass",
      "responseTime": 15,
      "details": {
        "userCount": "1250",
        "connectionPool": "healthy"
      }
    },
    "redis": {
      "status": "pass",
      "responseTime": 5,
      "message": "Redis connection healthy"
    },
    "memory": {
      "status": "pass",
      "responseTime": 1,
      "details": {
        "percentage": 45.2,
        "used": "512MB",
        "total": "1GB"
      }
    },
    "disk": {
      "status": "pass",
      "responseTime": 2,
      "details": {
        "percentage": 65.8,
        "used": "32GB",
        "available": "16GB"
      }
    },
    "external": {
      "status": "pass",
      "responseTime": 120,
      "details": {
        "bestbuy": "healthy",
        "walmart": "healthy",
        "costco": "degraded",
        "samsclub": "healthy"
      }
    }
  },
  "metrics": {
    "memory": {
      "percentage": 45.2,
      "used": 536870912,
      "total": 1073741824
    },
    "cpu": {
      "usage": 25.5
    },
    "requests": {
      "total": 15420,
      "errors": 23,
      "averageResponseTime": 145
    },
    "alerts": {
      "sent": 1250,
      "failed": 5
    }
  }
}
```

#### Readiness Probe
```
GET /health/ready
```
Kubernetes/Docker readiness probe to determine if the service is ready to accept traffic.

#### Liveness Probe
```
GET /health/live
```
Kubernetes/Docker liveness probe to determine if the service is alive and responsive.

#### System Metrics
```
GET /health/metrics
```
Dedicated endpoint for retrieving system metrics without full health check overhead.

### Health Status Levels

- **healthy** - All systems operational
- **degraded** - Some non-critical systems have warnings
- **unhealthy** - Critical systems are failing

## Monitoring API

### Authentication

All monitoring endpoints require authentication:
- **User endpoints** - Require valid JWT token
- **Admin endpoints** - Require admin role privileges

### Metrics Management

#### Get Metrics
```
GET /api/monitoring/metrics
```

**Query Parameters:**
- `metric` (string) - Specific metric name to retrieve
- `startTime` (ISO date) - Start time for metric data
- `endTime` (ISO date) - End time for metric data
- `aggregation` (string) - Set to "stats" for aggregated statistics

**Examples:**
```bash
# Get all metrics (last hour)
GET /api/monitoring/metrics

# Get specific metric with time range
GET /api/monitoring/metrics?metric=memory_usage_percent&startTime=2024-01-15T09:00:00Z&endTime=2024-01-15T10:00:00Z

# Get metric statistics
GET /api/monitoring/metrics?metric=cpu_usage_percent&aggregation=stats
```

#### Record Custom Metrics
```
POST /api/monitoring/metrics
```

**Request Body:**
```json
{
  "metric": "custom_metric_name",
  "value": 42.5,
  "labels": {
    "service": "user-service",
    "environment": "production"
  }
}
```

### Alert Rule Management (Admin Only)

#### Get Alert Rules
```
GET /api/monitoring/alerts/rules
```

Returns all configured alert rules.

#### Create Alert Rule
```
POST /api/monitoring/alerts/rules
```

**Request Body:**
```json
{
  "id": "high_memory_usage",
  "name": "High Memory Usage",
  "metric": "memory_usage_percent",
  "operator": "gt",
  "threshold": 85,
  "duration": 300,
  "severity": "high",
  "enabled": true,
  "notificationChannels": ["email", "slack"]
}
```

**Alert Rule Fields:**
- `id` - Unique identifier for the rule
- `name` - Human-readable name
- `metric` - Metric name to monitor
- `operator` - Comparison operator (gt, lt, eq, gte, lte)
- `threshold` - Threshold value for triggering
- `duration` - Time in seconds the condition must persist
- `severity` - Alert severity (low, medium, high, critical)
- `enabled` - Whether the rule is active
- `notificationChannels` - Array of notification channels

#### Delete Alert Rule
```
DELETE /api/monitoring/alerts/rules/:ruleId
```

### Alert Viewing

#### Get Active Alerts
```
GET /api/monitoring/alerts/active
```

Returns currently firing alerts.

#### Get Alert History
```
GET /api/monitoring/alerts/history?limit=100
```

Returns historical alert data with optional limit.

### Dashboard Data

#### Get Monitoring Dashboard
```
GET /api/monitoring/dashboard?timeRange=24
```

**Query Parameters:**
- `timeRange` (number) - Time range in hours (default: 24)

**Response:**
```json
{
  "timeRange": {
    "start": "2024-01-14T10:30:00.000Z",
    "end": "2024-01-15T10:30:00.000Z",
    "hours": 24
  },
  "metrics": {
    "memory": {
      "count": 1440,
      "min": 35.2,
      "max": 78.9,
      "avg": 52.1,
      "sum": 75024
    },
    "cpu": {
      "count": 1440,
      "min": 15.1,
      "max": 89.3,
      "avg": 42.7,
      "sum": 61488
    }
  },
  "alerts": {
    "active": [
      {
        "id": "alert_123",
        "ruleName": "High Memory Usage",
        "severity": "high",
        "status": "firing",
        "startsAt": "2024-01-15T09:45:00.000Z"
      }
    ],
    "summary": {
      "total": 1,
      "critical": 0,
      "high": 1,
      "medium": 0,
      "low": 0
    }
  },
  "charts": {
    "memory": [
      {
        "timestamp": "2024-01-15T10:00:00.000Z",
        "value": 52.1
      }
    ]
  }
}
```

## Built-in Metrics

The system automatically collects the following metrics:

### System Metrics
- `memory_usage_percent` - Memory usage percentage
- `cpu_usage_percent` - CPU usage percentage
- `disk_usage_percent` - Disk usage percentage
- `uptime_seconds` - Process uptime in seconds

### Application Metrics
- `avg_response_time_ms` - Average HTTP response time
- `error_rate_percent` - HTTP error rate percentage
- `database_health` - Database connectivity (1 = healthy, 0 = unhealthy)
- `redis_health` - Redis connectivity (1 = healthy, 0 = unhealthy)

### Custom Metrics
Applications can record custom metrics using the metrics API for business-specific monitoring.

## Default Alert Rules

The system comes with pre-configured alert rules:

### High Memory Usage
- **Metric:** `memory_usage_percent`
- **Threshold:** > 85%
- **Duration:** 5 minutes
- **Severity:** High

### High CPU Usage
- **Metric:** `cpu_usage_percent`
- **Threshold:** > 80%
- **Duration:** 5 minutes
- **Severity:** High

### High Error Rate
- **Metric:** `error_rate_percent`
- **Threshold:** > 5%
- **Duration:** 1 minute
- **Severity:** Critical

### Slow Response Time
- **Metric:** `avg_response_time_ms`
- **Threshold:** > 2000ms
- **Duration:** 3 minutes
- **Severity:** Medium

### Database Connection Failure
- **Metric:** `database_health`
- **Threshold:** = 0
- **Duration:** 30 seconds
- **Severity:** Critical

### Low Disk Space
- **Metric:** `disk_usage_percent`
- **Threshold:** > 90%
- **Duration:** 10 minutes
- **Severity:** High

## Configuration

### Environment Variables

```bash
# Monitoring Configuration
MONITORING_ENABLED=true
METRICS_RETENTION_HOURS=24
ALERT_CHECK_INTERVAL=30000
METRICS_CLEANUP_INTERVAL=3600000

# Health Check Configuration
HEALTH_CHECK_TIMEOUT=5000
DATABASE_HEALTH_CHECK_ENABLED=true
REDIS_HEALTH_CHECK_ENABLED=true
EXTERNAL_SERVICES_HEALTH_CHECK_ENABLED=true

# Alert Notification Configuration
ALERT_EMAIL_ENABLED=true
ALERT_SLACK_ENABLED=true
ALERT_PAGERDUTY_ENABLED=false
```

### Monitoring Service Configuration

The monitoring service can be configured through environment variables or programmatically:

```typescript
import { monitoringService } from './services/monitoringService';

// Add custom alert rule
monitoringService.addAlertRule({
  id: 'custom_metric_alert',
  name: 'Custom Metric Alert',
  metric: 'custom_business_metric',
  operator: 'gt',
  threshold: 100,
  duration: 60,
  severity: 'medium',
  enabled: true,
  notificationChannels: ['email']
});

// Record custom metrics
monitoringService.recordMetric('user_signups', 5, {
  source: 'web',
  campaign: 'holiday_2024'
});
```

## Integration with External Systems

### Kubernetes/Docker

The health endpoints are designed for container orchestration:

```yaml
# Kubernetes deployment example
apiVersion: apps/v1
kind: Deployment
metadata:
  name: booster-beacon-api
spec:
  template:
    spec:
      containers:
      - name: api
        image: booster-beacon:latest
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Load Balancers

Use the basic health endpoint for load balancer health checks:

```nginx
# NGINX upstream health check
upstream booster_backend {
    server api1:3000;
    server api2:3000;
}

# Health check configuration
location /health {
    proxy_pass http://booster_backend/health;
    proxy_set_header Host $host;
}
```

### Monitoring Tools

The system exposes metrics in a format compatible with monitoring tools:

- **Prometheus** - Metrics can be scraped from the monitoring endpoints
- **Grafana** - Dashboard data API provides structured data for visualization
- **DataDog** - Custom metrics can be forwarded to DataDog
- **New Relic** - Application performance monitoring integration

## Troubleshooting

### Common Issues

#### High Memory Usage Alerts
1. Check for memory leaks in application code
2. Review database connection pooling settings
3. Monitor garbage collection patterns
4. Consider increasing memory limits

#### Database Health Check Failures
1. Verify database connectivity
2. Check connection pool configuration
3. Review database server status
4. Validate database credentials

#### Alert Rule Not Triggering
1. Verify alert rule configuration
2. Check metric data availability
3. Confirm duration and threshold settings
4. Review alert rule enabled status

### Debugging

Enable debug logging for monitoring components:

```bash
# Environment variable
DEBUG_MONITORING=true

# Or programmatically
import { loggerWithContext } from './utils/logger';
loggerWithContext.debug('Monitoring debug info', { metric: 'test' });
```

### Performance Considerations

- Metrics are stored in memory with configurable retention
- Alert checking runs every 30 seconds by default
- Health checks have timeouts to prevent blocking
- Metrics cleanup runs hourly to prevent memory growth

## Security

### Authentication
- All monitoring endpoints require valid JWT tokens
- Admin endpoints require elevated privileges
- API rate limiting applies to monitoring endpoints

### Data Privacy
- Metrics data does not contain sensitive user information
- Alert messages are sanitized before external notification
- Correlation IDs help with debugging without exposing user data

### Access Control
- Monitoring data access is role-based
- Alert rule management restricted to administrators
- System metrics available to authenticated users only
## Drop Metrics (2025-09)

New admin monitoring endpoints provide visibility into drop detection and performance:

- `GET /api/monitoring/drop-metrics` (admin):
  - `urlCandidates` by status,
  - `events24h` and `events7d` by signal type,
  - lead‑time summary from `drop_outcomes` (p50/p90/p95).
- `GET /api/monitoring/drop-budgets` (admin): current per‑retailer candidate QPM budgets and their source (redis/env/default).
- `PUT /api/monitoring/drop-budgets` (admin): update budgets:
```json
{ "budgets": [ { "slug": "target", "qpm": 4 }, { "slug": "best-buy", "qpm": 3 } ] }
```
