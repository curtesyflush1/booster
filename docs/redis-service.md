# Redis Service Documentation

## Overview

BoosterBeacon uses Redis as a high-performance caching layer and for advanced features like JWT token revocation and rate limiting. The Redis service provides a comprehensive set of utilities for secure, scalable operations.

## Features

### 1. JWT Token Revocation System

The Redis service implements a secure token blacklist system for immediate JWT token revocation.

#### Key Methods

```typescript
// Revoke a specific token
await TokenBlacklistService.revokeToken(jwtToken);

// Revoke all tokens for a user (password change, account suspension)
await TokenBlacklistService.revokeAllUserTokens(userId, 'password_change');

// Check if a token is revoked
const isRevoked = await TokenBlacklistService.isTokenRevoked(token);

// Get blacklist statistics
const stats = await TokenBlacklistService.getBlacklistStats();
```

#### Security Benefits

- **Immediate Revocation**: Tokens are invalidated instantly on logout or security events
- **User-wide Revocation**: All user tokens can be revoked simultaneously
- **Automatic Cleanup**: Blacklist entries expire automatically with token TTL
- **Performance**: Sub-millisecond token validation using Redis
- **Audit Trail**: All revocation events are logged with context

### 2. Advanced Caching Utilities

High-performance caching with automatic serialization and intelligent cache management.

#### JSON Caching

```typescript
// Cache complex objects with automatic serialization
await redisService.setJSON('user:123', userData, 3600);
const user = await redisService.getJSON<User>('user:123');

// Cache-or-fetch pattern with automatic refresh
const expensiveData = await redisService.getOrSet(
  'expensive:calculation',
  () => performExpensiveCalculation(),
  3600 // Cache for 1 hour
);
```

#### Performance Benefits

- **Type Safety**: TypeScript generics for type-safe caching
- **Automatic Serialization**: JSON objects handled transparently
- **Cache Miss Handling**: Automatic data fetching and caching on miss
- **Reduced Database Load**: Significant performance improvements

### 3. Rate Limiting Infrastructure

Built-in rate limiting for API protection and abuse prevention.

#### Usage Examples

```typescript
// Check and increment rate limit
const result = await redisService.rateLimit('api:user:123', 60, 100);
if (result.isLimited) {
  // Handle rate limit exceeded
  return res.status(429).json({
    error: 'Rate limit exceeded',
    resetTime: result.resetTime
  });
}

// Get current rate limit status without incrementing
const status = await redisService.getRateLimitStatus('api:user:123');
```

#### Features

- **Atomic Operations**: Race-condition-free using Redis pipelines
- **Flexible Keys**: Support for user-based, IP-based, or endpoint-based limiting
- **Real-time Status**: Current count and reset time information
- **Configurable Windows**: Customizable time windows and limits

### 4. Connection Management

Optimized Redis connection handling for production environments.

#### Configuration

```typescript
const redisService = new RedisService({
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: 10000,    // 10 seconds
    commandTimeout: 5000,     // 5 seconds
    keepAlive: 30000         // 30 seconds
  },
  isolationPoolOptions: {
    min: 2,                  // Minimum connections
    max: 10                  // Maximum connections
  }
});
```

#### Features

- **Connection Pooling**: Efficient resource utilization (2-10 connections)
- **Automatic Reconnection**: Exponential backoff with retry limits
- **Health Monitoring**: Connection status and performance tracking
- **Timeout Management**: Configurable timeouts for reliability

## Environment Configuration

### Required Variables

```bash
# Basic Redis connection
REDIS_URL=redis://:password@localhost:6379
```

### Optional Advanced Configuration

```bash
# Connection timeouts (milliseconds)
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
REDIS_KEEPALIVE=30000

# Connection pool settings
REDIS_POOL_MIN=2
REDIS_POOL_MAX=10
```

## Integration Examples

### Authentication Middleware

```typescript
import { TokenBlacklistService } from '../services/tokenBlacklistService';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractToken(req);
  
  // Fast blacklist check before token validation
  const isRevoked = await TokenBlacklistService.isTokenRevoked(token);
  if (isRevoked) {
    return res.status(401).json({ error: 'Token has been revoked' });
  }
  
  // Continue with normal token validation
  const user = await authService.validateAccessToken(token);
  req.user = user;
  next();
};
```

### Rate Limiting Middleware

```typescript
export const rateLimitMiddleware = (windowSeconds: number, maxRequests: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `api:${req.ip}:${req.route.path}`;
    
    const result = await redisService.rateLimit(key, windowSeconds, maxRequests);
    
    if (result.isLimited) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        resetTime: result.resetTime
      });
    }
    
    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': (maxRequests - result.count).toString(),
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
    });
    
    next();
  };
};
```

### Caching Service Integration

```typescript
export class UserService {
  async getUserProfile(userId: string): Promise<User> {
    return await redisService.getOrSet(
      `user:profile:${userId}`,
      () => this.fetchUserFromDatabase(userId),
      300 // Cache for 5 minutes
    );
  }
  
  async updateUserProfile(userId: string, updates: Partial<User>): Promise<User> {
    const user = await this.updateUserInDatabase(userId, updates);
    
    // Invalidate cache
    await redisService.del(`user:profile:${userId}`);
    
    return user;
  }
}
```

## Monitoring and Health Checks

### Health Check Integration

```typescript
export const healthCheck = async (): Promise<HealthStatus> => {
  try {
    const pingResponse = await redisService.ping();
    const isReady = redisService.isReady();
    
    return {
      status: isReady ? 'healthy' : 'unhealthy',
      responseTime: Date.now() - startTime,
      message: `Redis ${pingResponse}`
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};
```

### Performance Metrics

```typescript
// Get blacklist statistics for monitoring
const stats = await TokenBlacklistService.getBlacklistStats();
console.log('Blacklist Stats:', {
  tokensBlacklisted: stats.totalTokensBlacklisted,
  usersBlacklisted: stats.totalUsersBlacklisted,
  oldestEntry: stats.oldestEntry,
  newestEntry: stats.newestEntry
});

// Monitor rate limiting
const rateLimitStatus = await redisService.getRateLimitStatus('api:user:123');
console.log('Rate Limit Status:', {
  currentCount: rateLimitStatus.count,
  timeToReset: rateLimitStatus.ttl
});
```

## Error Handling

### Redis Error Types

```typescript
export enum RedisErrorType {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  COMMAND_ERROR = 'COMMAND_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class RedisError extends Error {
  public readonly type: RedisErrorType;
  public readonly originalError?: Error;
}
```

### Error Handling Best Practices

```typescript
try {
  const result = await redisService.get('some:key');
  return result;
} catch (error) {
  if (error instanceof RedisError) {
    switch (error.type) {
      case RedisErrorType.CONNECTION_ERROR:
        // Handle connection issues
        logger.error('Redis connection failed', { error: error.message });
        break;
      case RedisErrorType.TIMEOUT_ERROR:
        // Handle timeout issues
        logger.warn('Redis operation timed out', { error: error.message });
        break;
      default:
        logger.error('Redis operation failed', { error: error.message });
    }
  }
  
  // Fallback behavior
  return null;
}
```

## Testing

### Unit Testing

```typescript
import { redisService } from '../services/redisService';
import { TokenBlacklistService } from '../services/tokenBlacklistService';

describe('TokenBlacklistService', () => {
  beforeEach(async () => {
    // Clear test data
    await redisService.getClient().flushdb();
  });

  it('should revoke and detect revoked tokens', async () => {
    const token = generateTestToken();
    
    await TokenBlacklistService.revokeToken(token);
    const isRevoked = await TokenBlacklistService.isTokenRevoked(token);
    
    expect(isRevoked).toBe(true);
  });

  it('should handle rate limiting correctly', async () => {
    const key = 'test:rate:limit';
    
    // First request should pass
    const result1 = await redisService.rateLimit(key, 60, 1);
    expect(result1.isLimited).toBe(false);
    
    // Second request should be limited
    const result2 = await redisService.rateLimit(key, 60, 1);
    expect(result2.isLimited).toBe(true);
  });
});
```

### Integration Testing

```typescript
describe('Redis Integration', () => {
  it('should handle connection failures gracefully', async () => {
    // Simulate connection failure
    await redisService.disconnect();
    
    const result = await redisService.get('test:key').catch(err => null);
    expect(result).toBeNull();
  });
});
```

## Performance Considerations

### Best Practices

1. **Connection Pooling**: Use connection pooling for high-throughput applications
2. **Key Naming**: Use consistent, hierarchical key naming conventions
3. **TTL Management**: Always set appropriate TTL values to prevent memory leaks
4. **Pipeline Operations**: Use pipelines for multiple operations
5. **Error Handling**: Implement graceful degradation for Redis failures

### Performance Metrics

- **Token Validation**: < 1ms average response time
- **Cache Operations**: < 5ms for JSON serialization/deserialization
- **Rate Limiting**: < 1ms using atomic operations
- **Connection Pool**: 2-10 connections for optimal resource usage

## Troubleshooting

### Common Issues

1. **Connection Timeouts**: Check network connectivity and Redis server status
2. **Memory Usage**: Monitor Redis memory usage and set appropriate TTL values
3. **Performance**: Use Redis monitoring tools to identify slow operations
4. **Key Expiration**: Ensure TTL values are set correctly for temporary data

### Debugging

```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Monitor Redis operations
redisService.on('connect', () => console.log('Redis connected'));
redisService.on('error', (error) => console.error('Redis error:', error));
redisService.on('ready', () => console.log('Redis ready'));
```

## Security Considerations

1. **Token Security**: JWT tokens are securely blacklisted without storing sensitive data
2. **Rate Limiting**: Prevents abuse and DDoS attacks
3. **Connection Security**: Use Redis AUTH and TLS in production
4. **Key Isolation**: Use prefixed keys to prevent conflicts
5. **Audit Logging**: All security-related operations are logged

## Future Enhancements

### Planned Features

1. **Redis Cluster Support**: Multi-node Redis deployment for high availability
2. **Advanced Analytics**: Detailed usage analytics and insights
3. **Geo-distributed Caching**: Multi-region cache synchronization
4. **ML-based Rate Limiting**: Adaptive rate limiting based on usage patterns

### Monitoring Enhancements

1. **Real-time Dashboards**: Redis performance and usage dashboards
2. **Alerting Rules**: Automated alerts for performance degradation
3. **Capacity Planning**: Usage trend analysis and capacity recommendations
4. **Security Monitoring**: Anomaly detection for security events