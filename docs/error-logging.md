# Enhanced Error Logging System

BoosterBeacon implements a comprehensive error logging system that provides detailed debugging context, request tracing, and security-focused error handling across the entire application.

## Overview

The enhanced error logging system captures and logs detailed context for every error, including:

- **Stack traces with method names** - Extracted function/method names from call stacks
- **Request context** - Complete request information with sensitive data sanitization
- **System information** - Node.js version, platform, memory usage, and process details
- **Correlation IDs** - Request tracking across distributed systems and microservices
- **User context** - User ID and role when available for audit trails
- **Operation context** - Specific operation being performed when error occurred
- **Performance metrics** - Request timing and duration tracking

## Key Features

### 🔍 Comprehensive Error Context
- **Method Name Extraction**: Automatically extracts function/method names from stack traces
- **Request Sanitization**: Removes sensitive data (passwords, tokens, secrets) from logs
- **System Metrics**: Captures memory usage, CPU info, and process statistics
- **Timing Information**: Tracks request duration and performance metrics

### 🔒 Security & Privacy
- **Sensitive Data Redaction**: Automatically sanitizes passwords, tokens, and secrets
- **Production Safety**: Hides debug information in production environments
- **Correlation ID Tracking**: Enables request tracing without exposing sensitive data
- **Audit Trail**: Comprehensive logging for security monitoring and compliance

### 📊 Performance Monitoring
- **Request Timing**: Automatic calculation of request duration
- **Slow Operation Detection**: Identifies and logs operations taking >1000ms
- **Memory Tracking**: Monitors memory usage during error conditions
- **Performance Metrics**: Built-in timing utilities for operation monitoring

### 🎯 Development Experience
- **Rich Debug Context**: Complete error context in development mode
- **Stack Trace Analysis**: Intelligent method name extraction for debugging
- **Correlation ID Management**: Automatic request tracking across services
- **Structured JSON Logging**: Machine-readable logs for analysis tools

## Architecture

### Core Components

1. **Enhanced Error Handler** (`/src/middleware/errorHandler.ts`)
   - Comprehensive error processing with context extraction
   - Environment-specific response formatting
   - Sensitive data sanitization
   - Performance metrics collection

2. **Correlation ID Middleware** (`/src/middleware/correlationId.ts`)
   - Request tracking and correlation ID management
   - Request timing and performance monitoring
   - Enhanced logging context for all requests

3. **Enhanced Logger** (`/src/utils/logger.ts`)
   - Structured JSON logging with Winston
   - Contextual error creation utilities
   - Performance timing helpers
   - Audit and security logging

4. **Error Classes** (`/src/utils/errors.ts`)
   - Type-safe error handling with context
   - Automatic correlation ID capture
   - Structured error information
   - Operational vs system error classification

## Usage Examples

### Basic Error Logging

```typescript
import { loggerWithContext, createContextualError } from '../utils/logger';

try {
  await processUserData(userData);
} catch (error) {
  // Automatic context logging with correlation ID
  loggerWithContext.error('Failed to process user data', error, {
    userId: userData.id,
    operation: 'processUserData',
    dataSize: userData.length
  });
  throw error;
}
```

### Creating Contextual Errors

```typescript
import { ValidationError, NotFoundError } from '../utils/errors';

// Validation error with context
throw new ValidationError('Invalid email format', {
  field: 'email',
  value: userInput.email,
  expectedFormat: 'user@domain.com'
}, userId);

// Not found error with resource context
throw new NotFoundError('User', userId, currentUserId);
```

### Performance Timing

```typescript
import { loggerWithContext } from '../utils/logger';

const timer = loggerWithContext.time('databaseQuery');
try {
  const result = await database.query(sql);
  timer(); // Automatically logs duration
  return result;
} catch (error) {
  timer(); // Logs duration even on error
  throw error;
}
```

## Log Output Examples

### Development Mode Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "statusCode": 400,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req-123-456",
    "correlationId": "corr-789-012",
    "stack": "ValidationError: Invalid email format\n    at UserController.createUser...",
    "methodNames": ["UserController.createUser", "Router.handle"],
    "operation": "validateUserInput",
    "context": {
      "field": "email",
      "value": "invalid-email",
      "expectedFormat": "user@domain.com"
    }
  }
}
```

### Production Mode Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "statusCode": 400,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req-123-456",
    "correlationId": "corr-789-012"
  }
}
```

### Server Log Entry
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "ERROR",
  "message": "ValidationError: Invalid email format",
  "correlationId": "corr-789-012",
  "service": "booster-beacon-api",
  "environment": "production",
  "error": {
    "name": "ValidationError",
    "message": "Invalid email format",
    "statusCode": 400,
    "code": "VALIDATION_ERROR",
    "methodNames": ["UserController.createUser"],
    "context": {
      "field": "email",
      "value": "invalid-email"
    },
    "operation": "validateUserInput"
  },
  "request": {
    "method": "POST",
    "url": "/api/users",
    "correlationId": "corr-789-012",
    "ip": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "body": {
      "name": "John Doe",
      "email": "invalid-email",
      "password": "[REDACTED]"
    },
    "userId": "user-456",
    "timestamp": "2024-01-15T10:29:58.500Z"
  },
  "system": {
    "nodeVersion": "v18.17.0",
    "platform": "linux",
    "memory": {
      "heapUsed": 45678912,
      "heapTotal": 67108864
    },
    "uptime": 3600.5,
    "pid": 12345
  },
  "timing": {
    "errorTime": "2024-01-15T10:30:00.000Z",
    "requestDuration": 1500
  }
}
```

## Configuration

### Environment Variables
```bash
# Logging configuration
LOG_LEVEL=info                    # Logging level (debug, info, warn, error)
NODE_ENV=production              # Environment mode (affects debug info)

# Log file configuration (production)
LOG_DIR=./logs                   # Log directory path
LOG_MAX_SIZE=10485760           # Max log file size (10MB)
LOG_MAX_FILES=10                # Max number of log files to keep
```

### Logger Configuration
```typescript
// Custom logger configuration
const customLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

## Security Features

### Sensitive Data Sanitization
The system automatically redacts sensitive fields from logs:
- `password` → `[REDACTED]`
- `token` → `[REDACTED]`
- `secret` → `[REDACTED]`
- `authorization` → `[REDACTED]`
- `cookie` → `[REDACTED]`

### Production Safety
- Stack traces and debug info only included in development
- Internal errors masked as "Internal Server Error" in production
- Correlation IDs allow error tracking without exposing sensitive data
- Automatic log rotation and size limits

## Performance Considerations

### Request Timing
- Automatic request duration calculation
- Performance logging for slow operations (>1000ms)
- Memory usage tracking in error context
- Built-in timing utilities for custom operations

### Log Volume Management
- Structured JSON logging for efficient parsing
- Log rotation and size limits configured
- Different log levels for different environments
- Automatic cleanup of old log files

## Integration with Existing Systems

### Middleware Integration
```typescript
import { errorHandler } from './middleware/errorHandler';
import { correlationIdMiddleware } from './middleware/correlationId';

// Add to Express app
app.use(correlationIdMiddleware);
// ... other middleware
app.use(errorHandler); // Must be last
```

### Service Integration
```typescript
import { logError, createContextualError } from './utils/logger';

// In service methods
try {
  const result = await externalService.call();
  return result;
} catch (error) {
  logError(error, 'externalServiceCall', { 
    service: 'external-api',
    endpoint: '/api/data'
  });
  throw createContextualError('External service failed', {
    statusCode: 502,
    code: 'EXTERNAL_SERVICE_ERROR',
    cause: error
  });
}
```

## Monitoring and Alerting

### Error Metrics
The system automatically tracks:
- Error counts by type and status code
- Request duration and performance metrics
- System resource usage during errors
- User and operation context for errors

### Alert Integration
- Integration with monitoring systems (Prometheus, Grafana)
- Automatic alerting for high error rates
- Performance degradation detection
- Security event monitoring

## Best Practices

### Error Creation
1. **Use Specific Error Classes**: Use `ValidationError`, `NotFoundError`, etc. instead of generic `Error`
2. **Include Context**: Always provide relevant context in error objects
3. **Sanitize Sensitive Data**: Never log passwords, tokens, or secrets
4. **Use Correlation IDs**: Ensure all errors can be traced back to requests

### Logging Practices
1. **Log at Appropriate Levels**: Use `error` for errors, `warn` for warnings, `info` for information
2. **Include Operation Context**: Always specify what operation was being performed
3. **Use Structured Data**: Provide context as structured objects, not strings
4. **Monitor Performance**: Use timing utilities for performance-critical operations

### Production Considerations
1. **Log Rotation**: Configure appropriate log rotation and retention
2. **Monitoring**: Set up alerts for error rate increases
3. **Storage**: Ensure adequate disk space for log files
4. **Security**: Regularly audit logs for sensitive data exposure

## Related Documentation

- [Authentication Security](authentication-security.md) - Security features and JWT token management
- [Validation System](validation-system.md) - Request validation and error handling
- [Parameter Sanitization](parameter-sanitization.md) - Input sanitization and security
- [Monitoring System](monitoring-system.md) - Health monitoring and system metrics
- [API Reference](api-reference.md) - Complete API documentation with error examples

For detailed implementation examples and advanced usage, see the [Enhanced Error Logging Implementation Guide](../backend/docs/enhanced-error-logging.md).