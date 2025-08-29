# Per-User Encryption for Retailer Credentials

## Overview

BoosterBeacon implements a sophisticated per-user encryption system for retailer credentials that provides maximum security by deriving unique encryption keys from each user's password. This ensures that even if the database is compromised, retailer credentials remain protected by the user's password.

## Security Architecture

### Key Derivation

Each user's retailer credentials are encrypted using a unique key derived from:
- **User Password**: The user's login password
- **User ID**: Unique identifier for additional entropy
- **Random Salt**: 32-byte cryptographically secure random salt per encryption operation
- **High Iteration Count**: 100,000 PBKDF2 iterations for computational security

### Encryption Details

- **Algorithm**: AES-256-GCM for authenticated encryption
- **Key Size**: 256-bit encryption keys
- **Salt**: 32-byte random salt per encryption operation
- **IV**: 16-byte random initialization vector per encryption
- **Authentication**: Built-in authentication tag prevents tampering

### Data Format

Encrypted data uses the format: `user-v1:salt:iv:authTag:encrypted`

- `user-v1`: Version identifier for user-specific encryption
- `salt`: Hex-encoded 32-byte salt used for key derivation
- `iv`: Hex-encoded 16-byte initialization vector
- `authTag`: Hex-encoded authentication tag
- `encrypted`: Hex-encoded encrypted data

## API Endpoints

### Store Credentials with User-Specific Encryption

```http
POST /api/users/retailer-credentials/secure
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "retailer": "bestbuy",
  "username": "user@example.com",
  "retailerPassword": "retailer_password",
  "userPassword": "user_login_password",
  "twoFactorEnabled": true
}
```

**Response:**
```json
{
  "message": "Retailer credentials added successfully with enhanced security",
  "retailer": "bestbuy",
  "encryptionType": "user-specific"
}
```

### Retrieve Credentials with User-Specific Decryption

```http
POST /api/users/retailer-credentials/secure/:retailer
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "userPassword": "user_login_password"
}
```

**Response:**
```json
{
  "retailer": "bestbuy",
  "username": "user@example.com",
  "twoFactorEnabled": true,
  "encryptionType": "user-specific",
  "message": "Credentials retrieved successfully"
}
```

### List Credentials with Encryption Type

```http
GET /api/users/retailer-credentials/secure
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "credentials": [
    {
      "retailer": "bestbuy",
      "username": "user@example.com",
      "twoFactorEnabled": true,
      "lastVerified": "2023-12-01T10:00:00Z",
      "isActive": true,
      "encryptionType": "user-specific"
    },
    {
      "retailer": "walmart",
      "username": "user2@example.com",
      "twoFactorEnabled": false,
      "lastVerified": "2023-11-15T14:30:00Z",
      "isActive": true,
      "encryptionType": "global"
    }
  ],
  "summary": {
    "total": 2,
    "userEncrypted": 1,
    "globalEncrypted": 1
  }
}
```

### Migrate Existing Credentials

```http
POST /api/users/retailer-credentials/migrate
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "userPassword": "user_login_password"
}
```

**Response:**
```json
{
  "message": "Credential migration completed",
  "results": {
    "migrated": ["walmart", "costco"],
    "skipped": ["bestbuy"],
    "failed": []
  },
  "summary": {
    "totalProcessed": 3,
    "successfullyMigrated": 2,
    "alreadySecure": 1,
    "failedMigration": 0
  }
}
```

## Implementation Details

### UserEncryptionService

The `UserEncryptionService` class provides the core encryption functionality:

```typescript
class UserEncryptionService {
  // Encrypt data with user-specific key
  async encryptWithUserKey(plaintext: string, userPassword: string, userId: string): Promise<string>
  
  // Decrypt data with user-specific key
  async decryptWithUserKey(encryptedData: string, userPassword: string, userId: string): Promise<string>
  
  // Check if data uses user-specific encryption
  static isUserEncrypted(encryptedData: string): boolean
  
  // Migrate from global to user-specific encryption
  async migrateToUserEncryption(globalEncryptedData: string, userPassword: string, userId: string, globalDecryptFunction: Function): Promise<string>
}
```

### UserCredentialService

The `UserCredentialService` class provides high-level credential management:

```typescript
class UserCredentialService {
  // Store credentials with user-specific encryption
  async storeRetailerCredentials(userId: string, credentials: RetailerCredentialInput, userPassword: string): Promise<boolean>
  
  // Retrieve credentials (supports both encryption types)
  async getRetailerCredentials(userId: string, retailer: string, userPassword: string): Promise<CredentialOutput | null>
  
  // Migrate all user credentials to user-specific encryption
  async migrateAllCredentialsToUserEncryption(userId: string, userPassword: string): Promise<MigrationResults>
  
  // List credentials with encryption type information
  async listRetailerCredentials(userId: string): Promise<RetailerCredentialOutput[]>
}
```

## Backward Compatibility

The system maintains full backward compatibility with existing global-encrypted credentials:

1. **Automatic Detection**: The system automatically detects encryption type when retrieving credentials
2. **Seamless Migration**: Users can migrate existing credentials to user-specific encryption
3. **Mixed Support**: Users can have both global and user-encrypted credentials simultaneously
4. **Gradual Transition**: New credentials use user-specific encryption by default

## Security Benefits

### Database Compromise Protection

Even if the database is fully compromised:
- Retailer passwords remain encrypted with user-specific keys
- Attackers cannot decrypt credentials without user passwords
- Each user's credentials are independently protected

### Key Isolation

- Each user has unique encryption keys
- Compromise of one user's password doesn't affect others
- No shared encryption keys across the system

### Forward Security

- Password changes can trigger re-encryption with new keys
- Old encrypted data becomes inaccessible with old passwords
- Supports credential rotation and security updates

## Performance Considerations

### Key Derivation Cost

- PBKDF2 with 100,000 iterations adds ~50-100ms per operation
- Keys are derived on-demand (not cached for security)
- Acceptable latency for credential operations

### Storage Overhead

- User-encrypted data is ~20% larger due to salt and metadata
- Minimal impact on database storage requirements
- Improved security justifies storage cost

### Migration Performance

- Migration processes credentials sequentially
- Large credential sets may take several seconds
- Progress tracking available through API responses

## Best Practices

### For Developers

1. **Always Use User Password**: Never store or cache user passwords for encryption
2. **Validate Input**: Ensure user passwords meet security requirements
3. **Handle Errors Gracefully**: Provide clear error messages for decryption failures
4. **Log Security Events**: Track credential access and migration events
5. **Test Thoroughly**: Verify encryption/decryption with various data types

### For Users

1. **Strong Passwords**: Use strong, unique passwords for maximum security
2. **Regular Updates**: Update passwords periodically for enhanced security
3. **Migration**: Migrate existing credentials to user-specific encryption
4. **Backup**: Ensure password recovery methods are available

### For Administrators

1. **Monitor Migration**: Track user adoption of enhanced encryption
2. **Security Audits**: Regular security reviews of encryption implementation
3. **Performance Monitoring**: Monitor encryption operation performance
4. **Incident Response**: Procedures for handling security incidents

## Testing

### Unit Tests

- Encryption/decryption functionality
- Key derivation security
- Error handling scenarios
- Performance metrics

### Integration Tests

- API endpoint functionality
- Authentication and authorization
- Migration processes
- Cross-user security isolation

### Security Tests

- Encryption strength validation
- Key derivation verification
- Attack scenario simulation
- Compliance verification

## Monitoring and Metrics

### Security Metrics

- Encryption operation success rates
- Migration completion rates
- Failed decryption attempts
- Performance timing metrics

### Operational Metrics

- API endpoint usage
- Error rates and types
- User adoption rates
- System performance impact

## Compliance and Standards

### Cryptographic Standards

- **NIST Approved**: Uses NIST-approved algorithms (AES-256, PBKDF2, SHA-256)
- **Industry Best Practices**: Follows OWASP encryption guidelines
- **Key Management**: Secure key derivation and handling practices

### Data Protection

- **GDPR Compliance**: Enhanced data protection for EU users
- **PCI DSS**: Secure handling of payment-related credentials
- **SOC 2**: Security controls for service organization compliance

## Future Enhancements

### Planned Features

1. **Hardware Security Modules (HSM)**: Integration with HSM for key management
2. **Multi-Factor Encryption**: Additional factors beyond password
3. **Key Rotation**: Automated key rotation capabilities
4. **Audit Logging**: Enhanced audit trails for compliance

### Research Areas

1. **Post-Quantum Cryptography**: Preparation for quantum-resistant algorithms
2. **Zero-Knowledge Proofs**: Enhanced privacy protection
3. **Homomorphic Encryption**: Computation on encrypted data
4. **Secure Enclaves**: Hardware-based security improvements

## Conclusion

The per-user encryption system provides enterprise-grade security for retailer credentials while maintaining usability and backward compatibility. This implementation ensures that BoosterBeacon users can trust their sensitive retailer login information is protected with the highest security standards, even in the event of a database compromise.