# Alert System Documentation

## Overview

The BoosterBeacon alert system is a comprehensive notification platform that monitors product price changes and availability across multiple retailers. The system uses a strategy pattern for alert processing and includes automated background services for continuous monitoring.

## Core Components

### 1. Background Services

#### Availability Polling Service
**File**: `backend/src/services/availabilityPollingService.ts`

Continuously monitors product availability across retailers with intelligent batching and rate limiting:

- **Scan Interval**: Every 2-5 minutes (configurable)
- **Batch Processing**: Processes products in optimized batches
- **Rate Limiting**: Respects retailer API limits
- **Priority Ordering**: Popularity score → recency for scan optimization
- **Auto Status Updates**: Updates availability and tracks price changes

```typescript
// Key features
- Configurable scan intervals (default: 2 minutes)
- Intelligent batch sizing based on system load
- Comprehensive error handling and retry logic
- Integration with plan priority system
- Automated cleanup of stale data
```

#### Plan Priority Service
**File**: `backend/src/services/planPriorityService.ts`

Manages plan-based prioritization across the system:

- **Premium Plan**: 10x priority weight
- **Pro Plan**: 5x priority weight  
- **Free Plan**: 1x priority weight (baseline)
- **Safe Fallbacks**: Handles missing subscription data gracefully
- **Queue Management**: Applies weights to processing queues

#### CronService
**File**: `backend/src/services/CronService.ts`

Orchestrates all scheduled tasks with comprehensive job management:

**Every 5 Minutes:**
- Product availability scanning
- Watch pack maintenance
- Queue processing optimization

**Hourly (at :00):**
- Price history collection
- Product data snapshots
- Performance analytics
- Alert delivery optimization

**Daily (02:30 AM):**
- Watch cleanup and maintenance
- Database optimization
- Stale data removal
- System health checks

### 2. Alert Processing Strategy Pattern

#### Base Strategy Interface
**File**: `backend/src/services/alertStrategies/AlertProcessingStrategy.ts`

```typescript
interface AlertProcessingStrategy {
  canProcess(alert: Alert): boolean;
  process(alert: Alert): Promise<void>;
  getPriority(): number;
}
```

#### Strategy Implementations

**RestockAlertStrategy** (`RestockAlertStrategy.ts`)
- Handles product restock notifications
- Validates product availability changes
- Sends immediate notifications for high-demand items

**PriceDropAlertStrategy** (`PriceDropAlertStrategy.ts`)
- Monitors price decreases below user thresholds
- Calculates percentage and absolute price changes
- Triggers alerts based on user-defined criteria

**AlertProcessorFactory** (`AlertProcessorFactory.ts`)
- Strategy selection and instantiation
- Priority-based processing order
- Extensible for new alert types

### 3. Alert Processing Service

**File**: `backend/src/services/alertProcessingService.ts`

Central orchestration of alert processing with:

- Strategy pattern implementation
- Plan-based prioritization
- Batch processing optimization
- Comprehensive error handling
- Performance metrics collection

## Alert Lifecycle

### 1. Alert Creation
```
Product Change Detected → Alert Record Created → Queue for Processing
```

### 2. Processing Pipeline
```
Strategy Selection → Plan Priority Application → Processing Execution → Delivery
```

### 3. Delivery Methods
- Email notifications
- Push notifications (future)
- In-app alerts
- SMS (premium feature)

## Configuration & Settings

### Environment Variables
```bash
# Availability Polling
AVAILABILITY_SCAN_INTERVAL=120000  # 2 minutes in ms
AVAILABILITY_BATCH_SIZE=50         # Products per batch
MAX_RETRY_ATTEMPTS=3               # Retry failed requests

# Plan Priority Weights
PREMIUM_PRIORITY_WEIGHT=10
PRO_PRIORITY_WEIGHT=5
FREE_PRIORITY_WEIGHT=1

# Cron Schedule
CRON_AVAILABILITY_SCHEDULE="*/5 * * * *"    # Every 5 minutes
CRON_HOURLY_SCHEDULE="0 * * * *"            # Every hour
CRON_DAILY_SCHEDULE="30 2 * * *"            # Daily at 2:30 AM
```

### Alert Types Configuration
```typescript
enum AlertType {
  PRICE_DROP = 'PRICE_DROP',
  RESTOCK = 'RESTOCK',
  LOW_STOCK = 'LOW_STOCK',
  PREORDER = 'PREORDER'
}

enum AlertPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  URGENT = 4
}
```

## Performance Optimizations

### 1. Intelligent Batching
- Processes alerts in optimized batches
- Reduces database query overhead
- Maintains responsive user experience

### 2. Caching Strategy
- Redis-based caching for frequent queries
- User preference caching
- Product data caching with TTL

### 3. Rate Limiting
- Respects external API limits
- Implements exponential backoff
- Queue-based request management

### 4. Plan-Based Prioritization
- Premium users get priority processing
- Fair queuing with weighted algorithms
- Prevents system overload

## Monitoring & Analytics

### Key Metrics
- Alert processing latency
- Delivery success rates
- Background service health
- Queue depth monitoring
- Plan-based usage analytics

### Health Checks
- Service availability monitoring
- Database connectivity checks
- External API status verification
- Queue processing verification

### Logging
- Structured logging with correlation IDs
- Error tracking and alerting
- Performance monitoring
- User activity tracking

## Error Handling

### Strategy Failures
- Automatic retry mechanisms
- Fallback processing strategies
- Dead letter queue for failed alerts
- Admin notification for critical failures

### Background Service Resilience
- Graceful degradation under load
- Circuit breaker patterns
- Health check integration
- Automatic service recovery

### External API Failures
- Retry with exponential backoff
- Circuit breaker for unhealthy services
- Fallback data sources
- User notification of service issues

## Security Considerations

### Data Protection
- Encrypted user preferences
- Secure API communications
- Rate limiting for abuse prevention
- Input validation and sanitization

### Access Control
- Plan-based feature access
- User authentication verification
- Admin role segregation
- Audit logging for sensitive operations

## Testing Strategy

### Unit Tests
- Strategy pattern implementations
- Service layer functionality
- Utility function validation
- Error handling scenarios

### Integration Tests
- Background service coordination
- Database interaction testing
- External API integration
- End-to-end alert processing

### Performance Tests
- Load testing for background services
- Stress testing alert processing
- Memory usage optimization
- Database query optimization

## Deployment Considerations

### Production Scaling
- Horizontal scaling for background services
- Database read replicas for analytics
- Redis cluster for caching
- Load balancing for API endpoints

### Monitoring Setup
- Application performance monitoring
- Log aggregation and analysis
- Alert dashboards and notifications
- Capacity planning metrics

### Maintenance Windows
- Background service updates
- Database migration coordination
- Cache warming strategies
- Zero-downtime deployment

## Future Enhancements

### Planned Features
1. **Advanced Analytics**: User engagement metrics and alert effectiveness
2. **ML-Powered Alerts**: Predictive price drop notifications
3. **Multi-Channel Delivery**: SMS, push notifications, social media
4. **Custom Alert Rules**: User-defined complex alert conditions
5. **Real-Time Dashboard**: Live monitoring of background services

### Scalability Improvements
1. **Microservices Architecture**: Service decomposition for better scaling
2. **Event-Driven Processing**: Kafka/RabbitMQ for message processing
3. **Database Sharding**: Horizontal database scaling
4. **CDN Integration**: Global alert delivery optimization

This documentation reflects the current state of the alert system with comprehensive background service infrastructure and production-ready monitoring capabilities.