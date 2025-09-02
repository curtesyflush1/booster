# BoosterBeacon Architecture Overview

## 🏗️ System Architecture

BoosterBeacon is a production-ready, enterprise-grade platform built as a monorepo with advanced architectural patterns for scalability, maintainability, and performance.

### Core Architecture Principles

- **Microservices Pattern**: Modular service architecture with clear separation of concerns
- **Event-Driven Design**: Asynchronous processing with event bus and webhook systems
- **Real-Time Capabilities**: WebSocket integration for live updates and notifications
- **Subscription-Based Access**: Plan-based feature control and resource allocation
- **ML-Powered Insights**: Advanced prediction and analytics capabilities
- **Automated Operations**: Background services for catalog ingestion and monitoring

## 📊 System Components

### Backend Services (`backend/src/services/`)

#### Core Business Services
- **`catalogIngestionService.ts`**: Automated product discovery and normalization
- **`subscriptionService.ts`**: Plan-based policy management and feature access control
- **`alertDeliveryService.ts`**: Intelligent channel filtering and bulk delivery
- **`mlPredictionService.ts`**: Advanced ML predictions with top-tier access control
- **`websocketService.ts`**: Real-time communication and live updates
- **`RetailerIntegrationService.ts`**: Centralized retailer adapter orchestration

#### Background Services
- **`availabilityPollingService.ts`**: 2-5 minute availability monitoring
- **`planPriorityService.ts`**: Tier-based resource allocation (Premium 10x, Pro 5x, Free 1x)
- **`CronService.ts`**: Automated scheduling for discovery and maintenance
- **`backupService.ts`**: Automated database backups and recovery

#### Supporting Services
- **`authService.ts`**: JWT-based authentication with bcrypt
- **`userCredentialService.ts`**: Secure credential management
- **`kmsManagementService.ts`**: Key management and encryption
- **`emailDeliveryService.ts`**: Enhanced email delivery with templates
- **`redisService.ts`**: Multi-tier caching and session management
- **`monitoringService.ts`**: Health monitoring and performance metrics

### Frontend Architecture (`frontend/src/`)

#### Real-Time Dashboard
- **WebSocket Integration**: Live updates for availability and alerts
- **Lazy Loading**: Performance optimization for heavy components
- **Subscription Context**: Plan-based feature access and UI controls
- **Portfolio Tracking**: Real-time investment monitoring
- **Predictive Insights**: ML-powered analytics display

#### Component Structure
- **Pages**: Route-based components with lazy loading
- **Components**: Reusable UI components with TypeScript
- **Services**: API integration and data management
- **Context**: Global state management and subscription context
- **Hooks**: Custom React hooks for common functionality

### Extension Architecture (`extension/src/`)

#### Browser Integration
- **Content Scripts**: Product page monitoring and data extraction
- **Background Scripts**: Persistent monitoring and alert management
- **Popup Interface**: Quick access to alerts and settings
- **Storage Management**: Local data persistence and sync

## 🔄 Data Flow Architecture

### Catalog Ingestion Pipeline
```
1. Discovery → searchProducts(query) per retailer
2. Normalization → upsert products by UPC/slug
3. Availability → update product_availability table
4. Price History → hourly snapshots for ML
5. ML/Insights → predictive analytics using 28-day history
```

### Alert Processing Flow
```
1. Watch Creation → user defines monitoring criteria
2. Availability Polling → background service checks stock
3. Alert Triggering → conditions met, alert created
4. Channel Filtering → plan-based delivery channel selection
5. Bulk Delivery → rate-limited delivery to users
6. Analytics → delivery tracking and performance metrics
```

### Real-Time Updates
```
1. WebSocket Connection → user connects to real-time service
2. Event Subscription → user subscribes to specific events
3. Live Updates → availability changes, alerts, portfolio updates
4. UI Synchronization → frontend components update automatically
```

## 🏛️ Architectural Patterns

### Repository Pattern
- **Data Access Layer**: Abstracted database operations
- **Type Safety**: Comprehensive TypeScript interfaces
- **Transaction Management**: ACID compliance and rollback support

### Service Layer Pattern
- **Business Logic**: Centralized in service classes
- **Dependency Injection**: IoC container for service management
- **Error Handling**: Comprehensive error management and logging

### Strategy Pattern
- **Alert Strategies**: Pluggable alert processing strategies
- **Retailer Adapters**: Extensible retailer integration system
- **Delivery Channels**: Configurable notification delivery methods

### Observer Pattern
- **Event Bus**: Asynchronous event processing
- **WebSocket Events**: Real-time notification system
- **Background Services**: Automated monitoring and processing

## 🔒 Security Architecture

### Authentication & Authorization
- **JWT Tokens**: Stateless authentication with refresh tokens
- **RBAC System**: Role-based access control with fine-grained permissions
- **API Security**: Rate limiting, input validation, and sanitization

### Data Protection
- **Encryption**: KMS integration for sensitive data
- **Parameter Sanitization**: Comprehensive input validation
- **Audit Logging**: Complete audit trail for all operations

### Infrastructure Security
- **SSL/TLS**: End-to-end encryption for all communications
- **Environment Isolation**: Separate configurations for dev/staging/prod
- **Secret Management**: Secure handling of API keys and credentials

## 📈 Performance Architecture

### Caching Strategy
- **Multi-Tier Caching**: Redis for sessions, application cache, and CDN
- **Lazy Loading**: Frontend component and data lazy loading
- **Database Optimization**: Indexed queries and connection pooling

### Scalability Features
- **Horizontal Scaling**: Load balancer ready architecture
- **Background Processing**: Asynchronous task processing
- **Resource Allocation**: Plan-based resource management

### Monitoring & Observability
- **Health Checks**: Comprehensive health monitoring endpoints
- **Performance Metrics**: Real-time performance tracking
- **Logging**: Structured logging with correlation IDs

## 🚀 Deployment Architecture

### Containerization
- **Docker**: Optimized container configurations
- **Multi-Stage Builds**: Efficient image creation
- **Environment Configuration**: Dynamic configuration management

### Infrastructure
- **Nginx**: Reverse proxy with SSL termination
- **PostgreSQL**: Primary database with automated backups
- **Redis**: Caching and session storage
- **Monitoring**: Grafana, Loki, and Prometheus stack

### CI/CD Pipeline
- **Automated Testing**: Comprehensive test suite with 90%+ coverage
- **Deployment Scripts**: Automated deployment and rollback procedures
- **Health Monitoring**: Post-deployment health verification

## 🎯 Production Readiness

### Reliability
- **Error Recovery**: Comprehensive error handling and recovery
- **Backup Strategy**: Automated database backups and disaster recovery
- **Health Monitoring**: Real-time system health monitoring

### Maintainability
- **Code Quality**: TypeScript with strict type checking
- **Documentation**: Comprehensive documentation for all components
- **Testing**: Unit, integration, and end-to-end test coverage

### Scalability
- **Modular Design**: Easy to extend and modify
- **Performance Optimization**: Efficient resource utilization
- **Load Handling**: Ready for production-scale deployment

---

**Last Updated**: September 2024
**Status**: Production Ready
**Architecture Version**: 2.0