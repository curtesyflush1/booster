# Token Revocation System

## Overview

The BoosterBeacon application implements a comprehensive token revocation system using Redis to immediately invalidate JWT tokens upon logout or password change. This system provides enhanced security by ensuring that compromised or outdated tokens cannot be used to access the system.

## Architecture

### Components

1. **RedisService** (`src/services/redisService.ts`)
   - Provides a wrapper around the Redis client
   - Handles connection management and error handling
   - Supports all necessary Redis operations for token blacklisting

2. **TokenBlacklistService** (`src/services/tokenBlacklistService.ts`)
   - Manages the token blacklist using Redis
   - Tracks user tokens for bulk revocation
   - Provides cleanup and statistics functionality

3. **AuthService** (updated `src/services/authService.ts`)
   - Integrates with the token blacklist service
   - Automatically blacklists tokens during logout and password changes
   - Validates tokens against the blacklist

4. **Authentication Middleware** (updated `src/middleware/auth.ts`)
   - Checks tokens against the blacklist before validation
   - Fails secure when Redis is unavailable

## Features

### Token Blacklisting
- Individual token revocation with reason tracking
- Automatic expiration based on JWT expiry time
- Consistent token key generation using SHA-256 hashing

### User Token Tracking
- Tracks all active tokens for each user
- Enables bulk revocation (logout from all devices)
- Automatic cleanup of expired token references

### Security Features
- **Fail Secure**: When Redis is unavailable, tokens are considered invalid
- **Reason Tracking**: Each blacklisted token includes the reason for revocation
- **Automatic Cleanup**: Expired blacklist entries are automatically removed

### Performance Optimizations
- Blacklist check happens before expensive JWT verification
- Uses Redis sets for efficient user token tracking
- Automatic TTL management to prevent memory leaks

## API Endpoints

### New Endpoints

#### POST /api/auth/logout
Logs out the current user by blacklisting their access and refresh tokens.

**Request:**
```json
{
  "refresh_token": "optional_refresh_token"
}
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "message": "Logout successful"
}
```

#### POST /api/auth/logout-all
Logs out the user from all devices by blacklisting all their tokens.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "message": "Logged out from all devices successfully"
}
```

### Updated Endpoints

#### POST /api/auth/refresh
Now blacklists the old refresh token when generating new tokens.

#### POST /api/auth/change-password
Now blacklists all user tokens after successful password change.

#### POST /api/auth/reset-password
Now blacklists all user tokens after successful password reset.

## Redis Data Structure

### Blacklisted Tokens
```
Key: blacklist:token:<sha256_hash_of_token>
Value: {
  "userId": "user-123",
  "blacklistedAt": 1640995200,
  "reason": "user_logout",
  "expiresAt": 1641081600
}
TTL: Automatically set based on token expiry
```

### User Token Tracking
```
Key: user:tokens:<user_id>
Value: Set of active tokens for the user
TTL: Set to the longest token expiry time
```

## Configuration

### Environment Variables
```bash
REDIS_URL=redis://localhost:6379
# or for production with password:
REDIS_URL=redis://:password@redis-host:6379
```

### Docker Configuration
Redis is configured in `docker-compose.dev.yml`:
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6380:6379"
  command: redis-server --appendonly yes --requirepass booster_redis_password
```

## Usage Examples

### Manual Token Revocation
```typescript
import { tokenBlacklistService } from './services/tokenBlacklistService';

// Blacklist a specific token
await tokenBlacklistService.blacklistToken(token, 'security_breach');

// Check if token is blacklisted
const isBlacklisted = await tokenBlacklistService.isTokenBlacklisted(token);

// Blacklist all user tokens
await tokenBlacklistService.blacklistAllUserTokens(userId, 'account_compromise');
```

### Authentication Middleware Usage
The middleware automatically checks the blacklist:
```typescript
// In routes
router.get('/protected', authenticate, handler);

// The authenticate middleware will:
// 1. Check if token is blacklisted
// 2. If blacklisted, return 401 Unauthorized
// 3. If not blacklisted, proceed with JWT validation
```

## Monitoring and Maintenance

### Statistics
```typescript
const stats = await tokenBlacklistService.getBlacklistStats();
console.log(stats);
// Output: { totalBlacklistedTokens: 150, activeBlacklistedTokens: 75 }
```

### Cleanup
```typescript
// Manual cleanup of expired entries
const cleanedCount = await tokenBlacklistService.cleanupExpiredEntries();
console.log(`Cleaned up ${cleanedCount} expired entries`);
```

### Health Checks
```typescript
// Check Redis connection
const isReady = redisService.isReady();
const pingResult = await redisService.ping(); // Should return "PONG"
```

## Error Handling

### Redis Unavailable
When Redis is unavailable, the system fails secure:
- `isTokenBlacklisted()` returns `true` (treats all tokens as invalid)
- Authentication middleware rejects all requests
- New token operations may fail, but existing valid tokens continue to work

### Token Tracking Failures
Token tracking is non-critical:
- If tracking fails, tokens are still generated
- Bulk revocation may not work for untracked tokens
- Individual token revocation still works

## Testing

### Unit Tests
- `tests/services/redisService.test.ts`
- `tests/services/tokenBlacklistService.test.ts`
- Updated `tests/services/authService.test.ts`

### Integration Tests
- `tests/integration/auth-token-revocation.test.ts`

### Smoke Tests
- `tests/smoke/token-revocation-smoke.test.ts`

### Running Tests
```bash
# Run all token revocation tests
npm test -- --testPathPattern="tokenBlacklistService|redisService|auth-token-revocation"

# Run smoke tests
npm test -- --testPathPattern="token-revocation-smoke"
```

## Security Considerations

### Token Security
- Tokens are hashed before storage to prevent token leakage
- Blacklist entries include minimal information
- Automatic expiration prevents indefinite storage

### Performance Impact
- Blacklist check adds ~1-2ms to authentication
- Redis operations are asynchronous and non-blocking
- Memory usage scales with active token count

### Scalability
- Redis can handle millions of blacklist entries
- Horizontal scaling supported through Redis clustering
- Automatic cleanup prevents memory growth

## Troubleshooting

### Common Issues

1. **Redis Connection Errors**
   ```
   Error: Redis connection failed
   ```
   - Check Redis server status
   - Verify REDIS_URL configuration
   - Check network connectivity

2. **Authentication Failures After Implementation**
   ```
   Error: Invalid token
   ```
   - May indicate Redis is treating all tokens as blacklisted
   - Check Redis connectivity
   - Verify token format and signing

3. **Memory Usage Growth**
   ```
   Redis memory usage increasing
   ```
   - Run cleanup manually: `tokenBlacklistService.cleanupExpiredEntries()`
   - Check TTL settings on blacklist entries
   - Monitor token generation rate

### Debug Commands
```bash
# Check Redis connectivity
redis-cli -h localhost -p 6380 ping

# List blacklisted tokens
redis-cli -h localhost -p 6380 keys "blacklist:token:*"

# Check user token tracking
redis-cli -h localhost -p 6380 smembers "user:tokens:user-123"

# Get blacklist entry details
redis-cli -h localhost -p 6380 get "blacklist:token:<hash>"
```

## Future Enhancements

### Planned Features
1. **Token Refresh Rotation**: Implement refresh token rotation for enhanced security
2. **Suspicious Activity Detection**: Automatically blacklist tokens on suspicious activity
3. **Admin Dashboard**: Web interface for managing blacklisted tokens
4. **Metrics and Alerting**: Monitor blacklist size and performance metrics
5. **Token Fingerprinting**: Enhanced token tracking with device/IP information

### Performance Optimizations
1. **Bloom Filters**: Use Redis Bloom filters for faster blacklist checks
2. **Batch Operations**: Batch multiple blacklist operations
3. **Caching**: Cache frequently checked tokens in memory
4. **Compression**: Compress blacklist data for memory efficiency