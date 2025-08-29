# Enhanced Logging System

## Overview

BoosterBeacon implements a comprehensive logging system that provides detailed debugging context while maintaining security and performance standards. The system features correlation ID tracking, structured JSON logging, automatic sensitive data sanitization, and environment-specific behavior.

## Architecture

### Core Components

#### 1. Enhanced Logger with Correlation IDs

The logging system uses Winston with custom formatters and correlation ID management:

```typescript
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

export class CorrelationIdManager {
  private static storage = new AsyncLocalStorage<string>();

  static generateId(): string {
    return uuidv4();
  }

  static setId(id: string): void {
    this.storage.enterWith(id);
  }

  static getId(): string | undefined {
    return this.storage.getStore();
  }

  static run<T>(id: string, callback: () => T): T {
    return this.storage.run(id, callback);
  }
}
```

#### 2. Structured Log Format

All logs follow a consistent JSON structure with comprehensive context:

```typescript
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const correlationId = CorrelationIdManager.getId();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      correlationId: correlationId || 'no-correlation-id',
      service: 'booster-beacon-api',
      environment: nodeEnv,
      ...meta
    };

    try {
      return JSON.stringify(logEntry);
    } catch (error) {
      // Fallback for circular references
      return JSON.stringify({
        ...logEntry,
        meta: '[Circular or Non-Serializable Object]',
        serializationError: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);
```

#### 3. Enhanced Logging Methods

The system provides specialized logging methods with structured data:

```typescript
export const loggerWithContext = {
  info: (message: string, meta?: LogMeta) => {
    try {
      logger.info(message, { ...meta, logType: 'info' });
    } catch (error) {
      console.log(`[INFO] ${message}`, error);
    }
  },

  error: (message: string, error?: Error | unknown, meta?: LogMeta) => {
    try {
      const errorInfo = error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: (error as any).cause
      } : error ? { error: String(error) } : undefined;

      logger.error(message, {
        ...meta,
        error: errorInfo,
        logType: 'error'
      });
    } catch (logError) {
      console.error(`[ERROR] ${message}`, error, logError);
    }
  },

  audit: (action: string, userId?: string, meta?: LogMeta) => {
    try {
      logger.info(`AUDIT: ${action}`, {
        ...meta,
        userId,
        logType: 'audit',
        auditAction: action,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.log(`[AUDIT] ${action}`, { userId, error });
    }
  },

  performance: (operation: string, duration: number, meta?: LogMeta) => {
    try {
      const performanceLevel = duration > 1000 ? 'warn' : 'info';
      logger[performanceLevel](`PERFORMANCE: ${operation}`, {
        ...meta,
        duration,
        logType: 'performance',
        operation,
        performanceThreshold: duration > 1000 ? 'slow' : 'normal'
      });
    } catch (error) {
      console.log(`[PERFORMANCE] ${operation}`, { duration, error });
    }
  },

  security: (event: string, meta?: LogMeta) => {
    try {
      logger.warn(`SECURITY: ${event}`, {
        ...meta,
        logType: 'security',
        securityEvent: event,
        severity: 'high',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn(`[SECURITY] ${event}`, error);
    }
  },

  time: (operation: string): (() => void) => {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      loggerWithContext.performance(operation, duration);
    };
  }
};
```

## Key Features

### 1. Correlation ID Tracking

Every request gets a unique correlation ID that tracks operations across the entire request lifecycle:

```typescript
export const createRequestLogger = () => {
  return (req: any, _res: any, next: any) => {
    const correlationId = CorrelationIdManager.generateId();
    req.startTime = Date.now();
    
    CorrelationIdManager.run(correlationId, () => {
      loggerWithContext.info('Request started', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        correlationId
      });
      next();
    });
  };
};
```

### 2. Contextual Error Creation

Enhanced error creation with automatic context capture:

```typescript
export const createContextualError = (
  message: string,
  options: {
    statusCode?: number;
    code?: string;
    operation?: string;
    context?: Record<string, any>;
    userId?: string;
    cause?: Error;
    isOperational?: boolean;
  } = {}
): AppError => {
  const error = new Error(message) as AppError;
  
  error.statusCode = options.statusCode || 500;
  error.code = options.code || 'INTERNAL_ERROR';
  error.operation = options.operation;
  error.context = options.context;
  error.userId = options.userId;
  error.isOperational = options.isOperational ?? true;
  
  if (options.cause) {
    (error as any).cause = options.cause;
  }
  
  Error.captureStackTrace(error, createContextualError);
  return error;
};
```

### 3. Automatic Error Logging

Centralized error logging with context extraction:

```typescript
export const logError = (
  error: Error | AppError,
  operation?: string,
  additionalContext?: Record<string, any>
): void => {
  const correlationId = CorrelationIdManager.getId();
  const appError = error as AppError;
  
  loggerWithContext.error(`Error in ${operation || appError.operation || 'unknown operation'}`, error, {
    operation: operation || appError.operation,
    userId: appError.userId,
    context: appError.context,
    correlationId,
    ...additionalContext
  });
};
```

## Log Transport Configuration

### Development Environment

```typescript
new winston.transports.Console({
  format: nodeEnv === 'development'
    ? winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
        const id = correlationId ? `[${String(correlationId).slice(0, 8)}]` : '';
        return `${timestamp} ${level} ${id} ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
      })
    )
    : logFormat
})
```

### Production Environment

```typescript
// File transports for production
...(nodeEnv === 'production' ? [
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 10485760, // 10MB
    maxFiles: 10,
    tailable: true
  }),
  new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 10485760, // 10MB
    maxFiles: 10,
    tailable: true
  }),
  new winston.transports.File({
    filename: 'logs/audit.log',
    level: 'info',
    maxsize: 10485760, // 10MB
    maxFiles: 20,
    tailable: true,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  })
] : [])
```

## Usage Examples

### Basic Logging

```typescript
import { loggerWithContext } from '../utils/logger';

// Information logging
loggerWithContext.info('User registration started', { 
  userId: 'user-123',
  email: 'user@example.com'
});

// Error logging with context
try {
  await processUserData(userData);
} catch (error) {
  loggerWithContext.error('Failed to process user data', error, {
    userId: userData.id,
    operation: 'user-registration',
    step: 'data-processing'
  });
  throw error;
}

// Performance logging
const timer = loggerWithContext.time('database-query');
await User.findById(userId);
timer(); // Automatically logs duration

// Audit logging
loggerWithContext.audit('user-login', userId, {
  ip: req.ip,
  userAgent: req.get('User-Agent')
});

// Security logging
loggerWithContext.security('suspicious-login-attempt', {
  ip: req.ip,
  attempts: failedAttempts,
  userId: attemptedUserId
});
```

### Service Integration

```typescript
export class AlertProcessingService {
  private static async processAlert(alertId: string): Promise<AlertProcessResult> {
    const timer = loggerWithContext.time('alert-processing');
    
    try {
      loggerWithContext.info('Starting alert processing', { alertId });
      
      const alert = await Alert.findById<IAlert>(alertId);
      if (!alert) {
        throw createContextualError('Alert not found', {
          statusCode: 404,
          code: 'ALERT_NOT_FOUND',
          operation: 'processAlert',
          context: { alertId }
        });
      }

      // Process alert...
      const result = await this.deliverAlert(alert);
      
      loggerWithContext.info('Alert processing completed', {
        alertId,
        success: result.success,
        channels: result.deliveryChannels
      });

      return result;
    } catch (error) {
      logError(error, 'processAlert', { alertId });
      throw error;
    } finally {
      timer();
    }
  }
}
```

### Repository Pattern Integration

```typescript
export class AlertRepository implements IAlertRepository {
  async findPendingAlerts(limit: number): Promise<IAlert[]> {
    const timer = loggerWithContext.time('find-pending-alerts');
    
    try {
      loggerWithContext.info('Finding pending alerts', { limit });
      
      const result = await Alert.findBy<IAlert>(
        { status: 'pending' },
        { limit, orderBy: 'created_at', orderDirection: 'asc' }
      );
      
      loggerWithContext.info('Found pending alerts', { 
        count: result.data.length,
        limit 
      });
      
      return result.data;
    } catch (error) {
      loggerWithContext.error('Error finding pending alerts', error, { limit });
      throw error;
    } finally {
      timer();
    }
  }

  async createAlert(data: Partial<IAlert>): Promise<IAlert> {
    try {
      loggerWithContext.info('Creating alert', { 
        userId: data.user_id,
        productId: data.product_id,
        type: data.type
      });
      
      const alert = await Alert.createAlert(data);
      
      loggerWithContext.audit('alert-created', data.user_id, {
        alertId: alert.id,
        productId: data.product_id,
        type: data.type
      });
      
      return alert;
    } catch (error) {
      loggerWithContext.error('Error creating alert', error, { data });
      throw error;
    }
  }
}
```

## Log Output Examples

### Development Mode

```
2025-08-28 10:30:00.123 INFO [req-123-456] User registration started {"userId":"user-123","email":"user@example.com"}
2025-08-28 10:30:00.456 ERROR [req-123-456] Failed to process user data {"userId":"user-123","operation":"user-registration","error":{"name":"ValidationError","message":"Invalid email format"}}
2025-08-28 10:30:00.789 PERFORMANCE [req-123-456] PERFORMANCE: database-query {"duration":245,"operation":"database-query","performanceThreshold":"normal"}
```

### Production Mode (JSON)

```json
{
  "timestamp": "2025-08-28T10:30:00.123Z",
  "level": "INFO",
  "message": "User registration started",
  "correlationId": "req-123-456-789",
  "service": "booster-beacon-api",
  "environment": "production",
  "userId": "user-123",
  "email": "user@example.com",
  "logType": "info"
}

{
  "timestamp": "2025-08-28T10:30:00.456Z",
  "level": "ERROR",
  "message": "Failed to process user data",
  "correlationId": "req-123-456-789",
  "service": "booster-beacon-api",
  "environment": "production",
  "userId": "user-123",
  "operation": "user-registration",
  "error": {
    "name": "ValidationError",
    "message": "Invalid email format",
    "stack": "ValidationError: Invalid email format\n    at UserController.register..."
  },
  "logType": "error"
}

{
  "timestamp": "2025-08-28T10:30:00.789Z",
  "level": "INFO",
  "message": "PERFORMANCE: database-query",
  "correlationId": "req-123-456-789",
  "service": "booster-beacon-api",
  "environment": "production",
  "duration": 245,
  "operation": "database-query",
  "performanceThreshold": "normal",
  "logType": "performance"
}
```

## Security Features

### Sensitive Data Sanitization

The system automatically sanitizes sensitive data from logs:

```typescript
const SENSITIVE_FIELDS = [
  'password', 'token', 'secret', 'key', 'authorization', 
  'cookie', 'session', 'credential', 'auth'
];

function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some(field => lowerKey.includes(field));
    
    if (isSensitive) {
      (sanitized as any)[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      (sanitized as any)[key] = sanitizeObject(value);
    } else {
      (sanitized as any)[key] = value;
    }
  }
  
  return sanitized;
}
```

### Environment-Specific Behavior

- **Development**: Full error details including stack traces
- **Production**: Sanitized error messages with correlation IDs for debugging
- **Testing**: Minimal logging to reduce noise

## Performance Considerations

### Log Volume Management

```typescript
// Conditional debug logging
if (process.env.LOG_LEVEL === 'debug') {
  loggerWithContext.debug('Detailed debug information', { 
    complexObject: largeDataStructure 
  });
}

// Lazy evaluation for expensive operations
loggerWithContext.info('Processing completed', () => ({
  results: expensiveCalculation(),
  metrics: gatherMetrics()
}));
```

### Asynchronous Logging

```typescript
// Non-blocking logging for high-throughput scenarios
const asyncLogger = winston.createLogger({
  transports: [
    new winston.transports.File({
      filename: 'logs/async.log',
      options: { flags: 'a' } // Append mode for better performance
    })
  ]
});

// Batch logging for bulk operations
const logBatch: LogEntry[] = [];

function addToLogBatch(entry: LogEntry): void {
  logBatch.push(entry);
  
  if (logBatch.length >= 100) {
    flushLogBatch();
  }
}

function flushLogBatch(): void {
  if (logBatch.length > 0) {
    asyncLogger.info('Batch log entries', { entries: logBatch });
    logBatch.length = 0;
  }
}
```

## Monitoring and Alerting

### Log-Based Metrics

```typescript
export class LogMetrics {
  private static errorCount = 0;
  private static performanceIssues = 0;
  private static securityEvents = 0;

  static incrementErrorCount(): void {
    this.errorCount++;
    
    // Alert on high error rate
    if (this.errorCount > 100) {
      loggerWithContext.security('high-error-rate-detected', {
        errorCount: this.errorCount,
        timeWindow: '1-hour'
      });
    }
  }

  static recordPerformanceIssue(operation: string, duration: number): void {
    this.performanceIssues++;
    
    loggerWithContext.performance(`Slow operation detected: ${operation}`, duration, {
      threshold: 1000,
      severity: duration > 5000 ? 'critical' : 'warning'
    });
  }

  static recordSecurityEvent(event: string, context: any): void {
    this.securityEvents++;
    
    loggerWithContext.security(event, {
      ...context,
      totalSecurityEvents: this.securityEvents
    });
  }
}
```

### Health Check Integration

```typescript
export async function getLoggingHealth(): Promise<LoggingHealthStatus> {
  try {
    // Test log write
    const testMessage = `Health check: ${Date.now()}`;
    loggerWithContext.info(testMessage);
    
    // Check log file accessibility (production)
    if (process.env.NODE_ENV === 'production') {
      const fs = require('fs').promises;
      await fs.access('logs/combined.log');
    }
    
    return {
      status: 'healthy',
      correlationIdManager: 'active',
      transports: logger.transports.length,
      lastHealthCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      lastHealthCheck: new Date().toISOString()
    };
  }
}
```

## Testing

### Unit Testing

```typescript
describe('Enhanced Logging', () => {
  let mockLogger: jest.Mocked<winston.Logger>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;

    // Mock winston logger
    jest.spyOn(winston, 'createLogger').mockReturnValue(mockLogger);
  });

  it('should log with correlation ID', () => {
    const correlationId = 'test-correlation-id';
    
    CorrelationIdManager.run(correlationId, () => {
      loggerWithContext.info('Test message', { userId: 'user-123' });
    });

    expect(mockLogger.info).toHaveBeenCalledWith('Test message', {
      userId: 'user-123',
      logType: 'info'
    });
  });

  it('should sanitize sensitive data', () => {
    const sensitiveData = {
      username: 'testuser',
      password: 'secret123',
      token: 'jwt-token-here'
    };

    loggerWithContext.info('User data', sensitiveData);

    expect(mockLogger.info).toHaveBeenCalledWith('User data', {
      username: 'testuser',
      password: '[REDACTED]',
      token: '[REDACTED]',
      logType: 'info'
    });
  });
});
```

### Integration Testing

```typescript
describe('Logging Integration', () => {
  it('should maintain correlation ID across async operations', async () => {
    const correlationId = CorrelationIdManager.generateId();
    const logs: any[] = [];

    // Mock transport to capture logs
    const mockTransport = {
      log: (info: any, callback: any) => {
        logs.push(info);
        callback();
      }
    };

    logger.add(mockTransport);

    await CorrelationIdManager.run(correlationId, async () => {
      loggerWithContext.info('Start operation');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      loggerWithContext.info('End operation');
    });

    expect(logs).toHaveLength(2);
    expect(logs[0].correlationId).toBe(correlationId);
    expect(logs[1].correlationId).toBe(correlationId);
  });
});
```

## Best Practices

### 1. Structured Logging
- Use consistent log message formats
- Include relevant context in every log entry
- Use appropriate log levels (debug, info, warn, error)
- Include correlation IDs for request tracking

### 2. Performance
- Avoid logging large objects in production
- Use lazy evaluation for expensive log data
- Implement log sampling for high-volume scenarios
- Monitor log volume and performance impact

### 3. Security
- Never log sensitive data (passwords, tokens, secrets)
- Sanitize user input before logging
- Use appropriate log levels for security events
- Implement log retention policies

### 4. Monitoring
- Set up alerts for error rate spikes
- Monitor log volume and storage usage
- Track performance metrics through logs
- Implement log aggregation for distributed systems

## Related Documentation

- [Error Logging System](error-logging.md) - Comprehensive error handling documentation
- [Repository Pattern](repository-pattern.md) - How logging integrates with repositories
- [Alert Strategy Pattern](alert-strategy-pattern.md) - Logging in alert processing
- [Caching System](caching-system.md) - Cache operation logging
- [Type Safety System](type-safety.md) - Type-safe logging utilities

## Conclusion

The enhanced logging system provides comprehensive observability for BoosterBeacon while maintaining security and performance standards. With correlation ID tracking, structured JSON output, and intelligent sanitization, the system enables effective debugging and monitoring in production environments.

Key benefits include:
- **Request Tracing**: Complete request lifecycle tracking with correlation IDs
- **Structured Data**: Consistent JSON logging for easy parsing and analysis
- **Security**: Automatic sensitive data sanitization
- **Performance**: Optimized logging with minimal performance impact
- **Monitoring**: Built-in metrics and health monitoring
- **Development Experience**: Rich debugging context in development mode