# Enhanced Error Logging Implementation

This document describes the enhanced error logging system implemented for BoosterBeacon, which provides comprehensive debugging context for all application errors.

## Overview

The enhanced error logging system captures detailed context information for every error, including:

- **Stack traces with method names** - Extracted function/method names from the call stack
- **Request context** - Complete request information including headers, body, and timing
- **System information** - Node.js version, platform, memory usage, and process details
- **Correlation IDs** - Request tracking across distributed systems
- **User context** - User ID and role when available
- **Operation context** - Specific operation being performed when error occurred

## Key Components

### 1. Enhanced Error Handler Middleware (`errorHandler.ts`)

The error handler middleware has been enhanced with:

```typescript
// Extract method names from stack trace
const extractMethodNames = (stack?: string): string[] => {
  // Parses stack trace to identify function/method names
}

// Sanitize sensitive data from request body
const sanitizeRequestBody = (body: any): any => {
  // Removes passwords, tokens, secrets from logs
}

// Extract comprehensive request context
const extractRequestContext = (req: Request) => {
  // Captures all relevant request information
}
```

**Features:**
- Automatic method name extraction from stack traces
- Sensitive data sanitization (passwords, tokens, secrets)
- Request timing calculation
- Comprehensive system context
- Correlation ID tracking

### 2. Enhanced Error Classes (`errors.ts`)

New error classes with built-in context:

```typescript
// Base error class with enhanced context
export class BaseAppError extends Error implements AppError {
  public readonly correlationId?: string;
  public readonly timestamp: string;
  public readonly context?: Record<string, any>;
  // ... other properties
}

// Specific error types
export class ValidationError extends BaseAppError
export class AuthenticationError extends BaseAppError
export class NotFoundError extends BaseAppError
export class DatabaseError extends BaseAppError
```

**Benefits:**
- Automatic correlation ID capture
- Structured error context
- Type-safe error handling
- Consistent error format

### 3. Enhanced Logger (`logger.ts`)

Extended logging capabilities:

```typescript
// Contextual error creation
export const createContextualError = (message: string, options: {
  statusCode?: number;
  code?: string;
  operation?: string;
  context?: Record<string, any>;
  userId?: string;
}) => AppError

// Enhanced error logging
export const logError = (
  error: Error | AppError,
  operation?: string,
  additionalContext?: Record<string, any>
): void
```

### 4. Enhanced Correlation ID Middleware (`correlationId.ts`)

Improved request tracking:

```typescript
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Generates correlation IDs
  // Adds request timing
  // Logs request start/completion
  // Tracks performance metrics
}
```

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
import { loggerWithContext, logError } from '../utils/logger';

try {
  await processUserData(userData);
} catch (error) {
  // Automatic context logging
  logError(error, 'processUserData', { userId, dataSize: userData.length });
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
    "timestamp": "2024-01-15T10:30:00.000Z",
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
    "timestamp": "2024-01-15T10:29:58.500Z"
  },
  "system": {
    "nodeVersion": "v18.17.0",
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
    "errorTime": "2024-01-15T10:30:00.000Z",
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

## Performance Considerations

### Request Timing

- Automatic request duration calculation
- Performance logging for slow operations (>1000ms)
- Memory usage tracking in error context

### Log Volume Management

- Structured JSON logging for efficient parsing
- Log rotation and size limits configured
- Different log levels for different environments

## Integration with Existing Code

The enhanced error logging is designed to be backward compatible:

1. **Existing error handlers** continue to work
2. **New error classes** provide additional context
3. **Correlation IDs** are automatically managed
4. **Request timing** is transparent to application code

## Testing

Comprehensive test coverage includes:

- Unit tests for error handler middleware
- Integration tests for end-to-end error flows
- Mock verification of log output structure
- Security tests for data sanitization

## Benefits

1. **Faster Debugging** - Complete context in every error log
2. **Request Tracing** - Correlation IDs across distributed systems
3. **Security** - Automatic sensitive data redaction
4. **Performance Monitoring** - Built-in timing and memory tracking
5. **Production Ready** - Safe error responses with detailed server logs
6. **Developer Experience** - Rich error context in development mode

## Migration Guide

To use the enhanced error logging in existing code:

1. **Replace generic Error throws** with specific error classes:
   ```typescript
   // Before
   throw new Error('User not found');
   
   // After
   throw new NotFoundError('User', userId, currentUserId);
   ```

2. **Use async route handlers** for automatic error handling:
   ```typescript
   // Before
   app.get('/users/:id', async (req, res, next) => {
     try {
       // ... logic
     } catch (error) {
       next(error);
     }
   });
   
   // After
   app.get('/users/:id', asyncRouteHandler(async (req, res) => {
     // ... logic (errors automatically handled)
   }));
   ```

3. **Add operation context** to existing error logs:
   ```typescript
   // Before
   logger.error('Database error', error);
   
   // After
   logError(error, 'getUserById', { userId, query });
   ```

This enhanced error logging system provides comprehensive debugging capabilities while maintaining security and performance standards for production environments.