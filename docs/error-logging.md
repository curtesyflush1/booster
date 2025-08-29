# Enhanced Error Logging System

## Overview

BoosterBeacon implements a comprehensive error logging system that provides detailed debugging context while maintaining security and performance standards. The system captures complete error information including stack traces, request context, system metrics, and correlation IDs for distributed request tracking.

## Key Features

### Comprehensive Error Context
- **Stack Trace Analysis**: Automatic method name extraction from call stacks for precise debugging
- **Request Context**: Complete request information including headers, body, timing, and user context
- **System Information**: Node.js version, platform details, memory usage, and process information
- **Correlation IDs**: Request tracking across distributed systems and microservices
- **Operation Context**: Specific operation being performed when error occurred

### Security Features
- **Sensitive Data Sanitization**: Automatic removal of passwords, tokens, secrets from all error logs
- **Environment-Specific Responses**: Rich debug information in development, secure responses in production
- **Security Logging**: Comprehensive audit trail for security monitoring and compliance
- **Data Protection**: GDPR-compliant error logging with automatic PII sanitization

### Performance Monitoring
- **Request Timing**: Automatic calculation of request duration and performance metrics
- **Memory Tracking**: System memory usage and resource consumption monitoring
- **Slow Operation Detection**: Automatic flagging of operations exceeding 1000ms threshold
- **Performance Baselines**: Tracking of system performance trends and anomalies

## Architecture

### Core Components

#### 1. Enhanced Error Handler Middleware
```typescript
// Location: backend/src/middleware/errorHandler.ts
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void
```

**Features:**
- Automatic method name extraction from stack traces
- Comprehensive request context capture
- Sensitive data sanitization
- Environment-specific error responses
- Correlation ID tracking and logging

#### 2. Enhanced Error Classes
```typescript
// Location: backend/src/utils/errors.ts
export class BaseAppError extends Error implements AppError {
  public readonly correlationId?: string;
  public readonly timestamp: string;
  public readonly context?: Record<string, any>;
  // ... other properties
}
```

**Error Types:**
- `ValidationError` - Input validation failures
- `AuthenticationError` - Authentication and authorization failures
- `NotFoundError` - Resource not found errors
- `DatabaseError` - Database operation failures
- `ExternalServiceError` - Third-party service failures

#### 3. Enhanced Logger
```typescript
// Location: backend/src/utils/logger.ts
export const logError = (
  error: Error | AppError,
  operation?: string,
  additionalContext?: Record<string, any>
): void
```

**Capabilities:**
- Structured JSON logging with Winston
- Automatic log rotation and retention
- Performance metrics integration
- Correlation ID propagation
- Context-aware error logging

#### 4. Correlation ID Middleware
```typescript
// Location: backend/src/middleware/correlationId.ts
export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void
```

**Features:**
- Unique correlation ID generation per request
- Request timing and performance tracking
- Automatic correlation ID propagation
- Request lifecycle logging

## Usage Examples

### Creating Contextual Errors

```typescript
import { ValidationError, createContextualError } from '../utils/errors';

// Using specific error classes
throw new ValidationError('Invalid email format', {
  field: 'email',
  value: userInput.email,
  expectedFormat: 'user@domain.com'
}, userId);

// Using generic contextual error
throw createContextualError('Operation failed', {
  statusCode: 500,
  code: 'OPERATION_FAILED',
  operation: 'processUserData',
  context: { step: 'validation', userId },
  userId
});
```

### Enhanced Logging

```typescript
import { logError } from '../utils/logger';

try {
  await processUserData(userData);
} catch (error) {
  // Automatic context logging
  logError(error, 'processUserData', { 
    userId, 
    dataSize: userData.length,
    operation: 'user-registration'
  });
  throw error;
}
```

### Async Route Handling

```typescript
import { asyncRouteHandler } from '../utils/errors';

// Automatic error handling for async routes
export const getUserProfile = asyncRouteHandler(async (req, res) => {
  const user = await userService.getById(req.params.id);
  if (!user) {
    throw new NotFoundError('User', req.params.id, req.user?.id);
  }
  res.json({ user });
});
```

## Log Output Examples

### Development Mode Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "statusCode": 400,
    "timestamp": "2025-08-28T10:30:00.000Z",
    "requestId": "req-123-456",
    "correlationId": "corr-789-012",
    "stack": "ValidationError: Invalid email format\n    at UserController.createUser...",
    "methodNames": ["UserController.createUser", "Router.handle", "next"],
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
    "timestamp": "2025-08-28T10:30:00.000Z",
    "requestId": "req-123-456",
    "correlationId": "corr-789-012"
  }
}
```

### Server Log Entry
```json
{
  "timestamp": "2025-08-28T10:30:00.000Z",
  "level": "ERROR",
  "message": "ValidationError: Invalid email format",
  "correlationId": "corr-789-012",
  "service": "booster-beacon-api",
  "environment": "production",
  "error": {
    "name": "ValidationError",
    "message": "Invalid email format",
    "stack": "ValidationError: Invalid email format\n    at UserController.createUser...",
    "statusCode": 400,
    "code": "VALIDATION_ERROR",
    "methodNames": ["UserController.createUser", "Router.handle"],
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
    "headers": {
      "content-type": "application/json",
      "authorization": "[REDACTED]"
    },
    "userId": "user-456",
    "timestamp": "2025-08-28T10:29:58.500Z"
  },
  "system": {
    "nodeVersion": "v20.19.4",
    "platform": "linux",
    "memory": {
      "heapUsed": 45678912,
      "heapTotal": 67108864,
      "external": 1234567
    },
    "uptime": 3600.5,
    "pid": 12345
  },
  "timing": {
    "errorTime": "2025-08-28T10:30:00.000Z",
    "requestDuration": 1500
  }
}
```

## Security Features

### Sensitive Data Sanitization
The system automatically redacts sensitive fields from logs:
- `password` → `[REDACTED]`
- `token` → `[REDACTED]`
- `secret` → `[REDACTED]`
- `key` → `[REDACTED]`
- `authorization` → `[REDACTED]`
- `cookie` → `[REDACTED]`

### Production Safety
- Stack traces and debug info only included in development
- Internal errors masked as "Internal Server Error" in production
- Correlation IDs allow error tracking without exposing sensitive data
- Automatic PII detection and sanitization

## Performance Considerations

### Request Timing
- Automatic request duration calculation
- Performance logging for slow operations (>1000ms)
- Memory usage tracking in error context
- System resource monitoring

### Log Volume Management
- Structured JSON logging for efficient parsing
- Log rotation and size limits configured
- Different log levels for different environments
- Automatic cleanup of old log files

## Integration

### Existing Code Compatibility
The enhanced error logging is designed to be backward compatible:
1. **Existing error handlers** continue to work
2. **New error classes** provide additional context
3. **Correlation IDs** are automatically managed
4. **Request timing** is transparent to application code

### Middleware Integration
```typescript
// Automatic integration in Express app
app.use(correlationIdMiddleware);
app.use(/* your routes */);
app.use(errorHandler);
```

## Monitoring and Alerting

### Error Metrics
- Error rates by endpoint and error type
- Response time percentiles and trends
- Memory usage patterns and anomalies
- System health and performance metrics

### Alert Thresholds
- High error rates (>5% of requests)
- Slow response times (>2000ms average)
- Memory usage spikes (>80% heap usage)
- Critical system errors

### Dashboard Integration
- Real-time error monitoring
- Performance trend analysis
- System health visualization
- Alert management interface

## Best Practices

### For Developers
1. **Use Specific Error Classes**: Choose appropriate error types for better categorization
2. **Include Context**: Add relevant context information to errors
3. **Avoid Sensitive Data**: Never include passwords or tokens in error messages
4. **Use Correlation IDs**: Track related operations across services
5. **Test Error Scenarios**: Verify error handling in unit and integration tests

### For Operations
1. **Monitor Error Rates**: Set up alerts for unusual error patterns
2. **Review Logs Regularly**: Analyze error trends and patterns
3. **Performance Monitoring**: Track response times and system metrics
4. **Security Auditing**: Review error logs for security incidents

### For Security
1. **Data Sanitization**: Ensure sensitive data is properly redacted
2. **Access Control**: Restrict access to detailed error logs
3. **Audit Trails**: Maintain comprehensive audit logs for compliance
4. **Incident Response**: Use correlation IDs for security incident investigation

## Testing

### Unit Tests
- Error handler middleware functionality
- Error class creation and context
- Sensitive data sanitization
- Correlation ID generation and propagation

### Integration Tests
- End-to-end error handling workflows
- Log output verification
- Performance impact assessment
- Security data sanitization validation

### Performance Tests
- Error handling performance under load
- Memory usage during error scenarios
- Log volume and rotation testing
- System resource impact assessment

## Troubleshooting

### Common Issues

#### Missing Correlation IDs
**Symptom**: Logs don't include correlation IDs
**Solution**: Ensure `correlationIdMiddleware` is properly configured before routes

#### Sensitive Data in Logs
**Symptom**: Passwords or tokens appear in error logs
**Solution**: Verify sanitization rules and add new sensitive field patterns

#### High Log Volume
**Symptom**: Excessive disk usage from error logs
**Solution**: Adjust log levels and rotation settings, implement log aggregation

#### Performance Impact
**Symptom**: Slow response times due to error logging
**Solution**: Optimize logging configuration, use async logging where possible

### Debug Mode
Enable enhanced debugging:
```bash
export LOG_LEVEL=debug
export ERROR_LOGGING_DEBUG=true
export CORRELATION_ID_DEBUG=true
```

## Future Enhancements

### Planned Features
1. **Distributed Tracing**: Integration with OpenTelemetry for microservices
2. **Machine Learning**: Anomaly detection for error patterns
3. **Real-time Alerts**: Instant notifications for critical errors
4. **Log Analytics**: Advanced querying and analysis capabilities

### Integration Opportunities
1. **APM Tools**: Integration with New Relic, DataDog, or similar
2. **SIEM Systems**: Security information and event management
3. **Metrics Platforms**: Prometheus, Grafana integration
4. **Chat Notifications**: Slack, Discord error notifications

## Conclusion

The enhanced error logging system provides comprehensive debugging capabilities while maintaining security and performance standards. It enables rapid issue identification and resolution through detailed context capture, correlation ID tracking, and intelligent error classification.

Key benefits include:
- **Faster Debugging**: Complete context in every error log
- **Request Tracing**: Correlation IDs across distributed systems
- **Security**: Automatic sensitive data redaction
- **Performance Monitoring**: Built-in timing and memory tracking
- **Production Ready**: Safe error responses with detailed server logs
- **Developer Experience**: Rich error context in development mode

This system forms the foundation for reliable error handling and monitoring in production environments, enabling proactive issue detection and rapid resolution.