# Authentication Security System

BoosterBeacon implements a comprehensive authentication security system with advanced JWT token management, multi-device session control, and Redis-based token revocation.

## Overview

The authentication system provides enterprise-grade security features including:
- JWT-based authentication with access and refresh tokens
- Redis-powered token blacklist for immediate revocation
- Multi-device session management
- Comprehensive audit logging
- Role-based access control (RBAC) integration
- Enterprise Key Management Service (KMS) integration for secure encryption

## Key Management Integration

BoosterBeacon integrates with enterprise Key Management Services for secure encryption key management:

### Supported KMS Providers
- **AWS KMS**: Enterprise-grade key management with automatic rotation
- **Google Cloud KMS**: Native GCP integration with Secret Manager
- **HashiCorp Vault**: Multi-cloud and on-premises key management
- **Environment Variables**: Development and testing fallback

### Security Features
- **AES-256-GCM Encryption**: Authenticated encryption for all sensitive data
- **Key Rotation**: Manual and automatic key rotation capabilities
- **Audit Logging**: Comprehensive logging of all key operations
- **Performance Optimization**: 5-minute key caching with automatic expiry

See [KMS Integration Documentation](kms-integration.md) for complete setup and configuration.

## JWT Token Management

### Token Structure
```typescript
interface JWTPayload {
  userId: string;
  iat?: number;  // Issued at
  exp?: number;  // Expires at
  jti?: string;  // JWT ID for revocation
}
```

### Token Types
- **Access Token**: Short-lived (15 minutes) for API authentication
- **Refresh Token**: Long-lived (7 days) for token renewal

## Token Revocation System

### TokenBlacklistService

The `TokenBlacklistService` provides high-performance token revocation using Redis:

```typescript
// Revoke a specific token
await TokenBlacklistService.revokeToken(token);

// Check if token is revoked
const isRevoked = await TokenBlacklistService.isTokenRevoked(token);

// Revoke all user tokens (password change, security incident)
await TokenBlacklistService.revokeAllUserTokens(userId, 'password_change');
```

### Features

#### Individual Token Revocation
- Immediate token invalidation on logout
- Sub-millisecond lookup performance using Redis
- Automatic expiration based on token TTL

#### User-wide Token Revocation
- Revoke all tokens for a user across all devices
- Triggered by password changes, account suspension, or security incidents
- 24-hour blacklist duration to cover maximum JWT expiration

#### Fail-Safe Security
- Tokens are considered revoked if blacklist check fails
- Comprehensive error logging for security monitoring
- Graceful degradation with security-first approach

## Authentication Endpoints

### Standard Authentication
```http
POST /api/auth/login     # User login
POST /api/auth/logout    # Single device logout
POST /api/auth/refresh   # Token refresh
```

### Multi-Device Management
```http
POST /api/auth/logout-all  # Logout from all devices
```

### Administrative Control
```http
POST /api/admin/security/revoke-tokens/:userId  # Admin token revocation
GET  /api/admin/security/blacklist/stats        # Blacklist statistics
POST /api/admin/security/blacklist/cleanup      # Cleanup expired entries
```

## Security Features

### Password Security
- bcrypt hashing with 12 salt rounds
- Password strength validation
- Automatic token revocation on password change

### Account Protection
- Account lockout after 5 failed login attempts
- 30-minute lockout duration
- Rate limiting on authentication endpoints

### Session Management
- Comprehensive session tracking
- Multi-device logout capability
- Session invalidation on security events

## RBAC Integration

### Security Permissions
- `SECURITY_TOKENS_REVOKE`: Revoke user tokens
- `SECURITY_SESSIONS_MANAGE`: Manage user sessions
- `SECURITY_AUDIT_VIEW`: View security audit logs
- `SECURITY_AUDIT_EXPORT`: Export security data

### Permission Hierarchy
```typescript
// Admin permissions for token management
const adminPermissions = [
  Permission.SECURITY_TOKENS_REVOKE,
  Permission.SECURITY_SESSIONS_MANAGE,
  Permission.SECURITY_AUDIT_VIEW
];
```

## Monitoring & Analytics

### Token Blacklist Statistics
```typescript
interface BlacklistStats {
  totalTokensBlacklisted: number;
  totalUsersBlacklisted: number;
  oldestEntry: string | null;
  newestEntry: string | null;
}
```

### Audit Logging
All authentication events are logged with:
- User ID and email
- IP address and user agent
- Timestamp and action type
- Success/failure status
- Error details for failures

## Implementation Examples

### Basic Authentication Flow
```typescript
// Login
const { user, tokens } = await authService.login({
  email: 'user@example.com',
  password: 'securePassword123'
});

// Use access token for API calls
const response = await fetch('/api/protected', {
  headers: {
    'Authorization': `Bearer ${tokens.access_token}`
  }
});

// Logout
await authService.logout(tokens.access_token, tokens.refresh_token);
```

### Multi-Device Logout
```typescript
// Logout from all devices (security incident)
await authService.logoutAllDevices(userId);

// Admin revoke user tokens
await TokenBlacklistService.revokeAllUserTokens(userId, 'security_incident');
```

### Token Validation
```typescript
// Middleware automatically checks token revocation
const user = await authService.validateAccessToken(token);
// Returns user if valid, throws error if revoked
```

## Security Best Practices

### For Developers
1. Always use the authentication middleware for protected routes
2. Handle token expiration gracefully with refresh logic
3. Log security events for monitoring
4. Use HTTPS in production for token transmission

### For Administrators
1. Monitor blacklist statistics for unusual patterns
2. Revoke tokens immediately for compromised accounts
3. Regular security audits of authentication logs
4. Keep Redis instance secure and properly configured

## Configuration

### Environment Variables
```bash
# JWT Configuration
JWT_SECRET=your_secure_secret_key
JWT_REFRESH_SECRET=your_refresh_secret_key

# Redis Configuration (for token blacklist)
REDIS_URL=redis://:password@localhost:6379
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000

# Security Settings
BCRYPT_SALT_ROUNDS=12
MAX_FAILED_LOGIN_ATTEMPTS=5
ACCOUNT_LOCK_DURATION_MINUTES=30
```

### Production Considerations
- Use strong, unique JWT secrets
- Configure Redis with authentication and encryption
- Set up monitoring for authentication failures
- Implement rate limiting at the network level
- Regular security audits and penetration testing

## Troubleshooting

### Common Issues

#### Token Validation Failures
```typescript
// Check if token is in blacklist
const isRevoked = await TokenBlacklistService.isTokenRevoked(token);
if (isRevoked) {
  // Token was revoked, user needs to re-authenticate
}
```

#### Redis Connection Issues
```typescript
// Check Redis connectivity
const stats = await TokenBlacklistService.getBlacklistStats();
// If this fails, Redis connection needs attention
```

#### High Memory Usage
```typescript
// Cleanup expired entries
const cleaned = await TokenBlacklistService.cleanupExpiredEntries();
// Redis TTL should handle this automatically
```

## Future Enhancements

### Planned Features
- Device fingerprinting for enhanced security
- Suspicious activity detection and automatic lockout
- Integration with external security services
- Advanced session analytics and reporting

### Performance Optimizations
- Token blacklist sharding for high-scale deployments
- Caching layer for frequently accessed tokens
- Batch operations for bulk token management