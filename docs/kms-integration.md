# Key Management Service (KMS) Integration

BoosterBeacon supports multiple Key Management Services for secure encryption key management in production environments. This document describes the KMS integration, configuration options, and usage.

## Overview

The KMS integration replaces static environment variable encryption keys with secure, managed keys from dedicated key management services. This provides:

- **Enhanced Security**: Keys are managed by dedicated security services
- **Key Rotation**: Automatic or manual key rotation capabilities
- **Audit Logging**: Comprehensive logging of key access and operations
- **Compliance**: Meet enterprise security and compliance requirements
- **High Availability**: Redundant key storage and access

## Supported KMS Providers

### 1. Environment Variables (Development/Testing)
- **Provider**: `env`
- **Use Case**: Development, testing, and simple deployments
- **Security Level**: Basic (keys stored in environment variables)

### 2. AWS Key Management Service (KMS)
- **Provider**: `aws`
- **Use Case**: Production deployments on AWS
- **Security Level**: Enterprise-grade
- **Features**: Automatic rotation, audit logging, IAM integration

### 3. Google Cloud Key Management Service
- **Provider**: `gcp`
- **Use Case**: Production deployments on Google Cloud
- **Security Level**: Enterprise-grade
- **Features**: Automatic rotation, audit logging, IAM integration

### 4. HashiCorp Vault
- **Provider**: `vault`
- **Use Case**: Multi-cloud or on-premises deployments
- **Security Level**: Enterprise-grade
- **Features**: Dynamic secrets, multiple auth methods, audit logging

## Configuration

### Environment Variables

```bash
# KMS Provider Configuration
KMS_PROVIDER=env|aws|gcp|vault
KMS_KEY_ID=default
KMS_TIMEOUT=10000
KMS_RETRY_ATTEMPTS=3

# Environment Provider (Development)
ENCRYPTION_KEY=your_encryption_key_here_32_chars_minimum

# AWS KMS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Google Cloud KMS Configuration
GOOGLE_CLOUD_PROJECT=your_project_id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# HashiCorp Vault Configuration
VAULT_ADDR=https://vault.example.com:8200
VAULT_TOKEN=your_vault_token
```

### Provider-Specific Setup

#### AWS KMS Setup

1. **Create KMS Key**:
   ```bash
   aws kms create-key \
     --description "BoosterBeacon encryption key" \
     --key-usage ENCRYPT_DECRYPT \
     --key-spec SYMMETRIC_DEFAULT
   ```

2. **Create Parameter Store Entry**:
   ```bash
   aws ssm put-parameter \
     --name "/boosterbeacon/encryption-keys/default" \
     --value "$(openssl rand -hex 32)" \
     --type "SecureString" \
     --key-id "your-kms-key-id"
   ```

3. **Set Environment Variables**:
   ```bash
   export KMS_PROVIDER=aws
   export KMS_KEY_ID=default
   export AWS_REGION=us-east-1
   ```

#### Google Cloud KMS Setup

1. **Create Key Ring and Key**:
   ```bash
   gcloud kms keyrings create boosterbeacon-keyring \
     --location=global
   
   gcloud kms keys create boosterbeacon-key \
     --location=global \
     --keyring=boosterbeacon-keyring \
     --purpose=encryption
   ```

2. **Create Secret**:
   ```bash
   echo -n "$(openssl rand -hex 32)" | \
   gcloud secrets create boosterbeacon-encryption-key-default \
     --data-file=-
   ```

3. **Set Environment Variables**:
   ```bash
   export KMS_PROVIDER=gcp
   export KMS_KEY_ID=default
   export GOOGLE_CLOUD_PROJECT=your-project-id
   ```

#### HashiCorp Vault Setup

1. **Enable KV Secrets Engine**:
   ```bash
   vault secrets enable -path=secret kv-v2
   ```

2. **Store Encryption Key**:
   ```bash
   vault kv put secret/boosterbeacon/encryption-keys/default \
     key="$(openssl rand -hex 32)" \
     created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
     description="BoosterBeacon encryption key"
   ```

3. **Set Environment Variables**:
   ```bash
   export KMS_PROVIDER=vault
   export KMS_KEY_ID=default
   export VAULT_ADDR=https://vault.example.com:8200
   export VAULT_TOKEN=your_vault_token
   ```

## API Endpoints

### Health Check
```http
GET /api/admin/kms/health
Authorization: Bearer <admin_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "provider": "aws",
    "healthy": true,
    "lastChecked": "2025-01-15T10:30:00Z",
    "responseTime": 150
  }
}
```

### Key Metadata
```http
GET /api/admin/kms/key/metadata
Authorization: Bearer <admin_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "keyId": "default",
    "description": "BoosterBeacon encryption key",
    "createdAt": "2025-01-01T00:00:00Z",
    "lastRotated": "2025-01-10T00:00:00Z",
    "enabled": true,
    "keyUsage": "ENCRYPT_DECRYPT",
    "keySpec": "AES-256"
  }
}
```

### Key Rotation
```http
POST /api/admin/kms/key/rotate
Authorization: Bearer <admin_token>
```

**Response**:
```json
{
  "success": true,
  "message": "Encryption key rotated successfully",
  "data": {
    "newKeyVersion": "default-1642204800000"
  }
}
```

### Configuration Management
```http
GET /api/admin/kms/config
Authorization: Bearer <admin_token>
```

```http
POST /api/admin/kms/config/test
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "provider": "aws",
  "keyId": "default",
  "region": "us-east-1"
}
```

```http
PUT /api/admin/kms/config
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "provider": "aws",
  "keyId": "default",
  "region": "us-east-1",
  "credentials": {
    "accessKeyId": "AKIA...",
    "secretAccessKey": "..."
  }
}
```

## Security Considerations

### Key Storage
- **AWS KMS**: Keys stored in AWS Parameter Store, encrypted with KMS
- **GCP KMS**: Keys stored in Google Secret Manager
- **Vault**: Keys stored in Vault's encrypted backend
- **Environment**: Keys derived from environment variables (development only)

### Access Control
- All KMS operations require admin authentication
- Rate limiting applied to prevent abuse
- Comprehensive audit logging of all operations

### Key Rotation
- **Automatic**: Supported by AWS KMS and GCP KMS
- **Manual**: Available through API endpoints
- **Zero-downtime**: Key rotation doesn't interrupt service

### Encryption
- **Algorithm**: AES-256-GCM
- **Key Size**: 256 bits (32 bytes)
- **IV**: Random 16-byte initialization vector per operation
- **Authentication**: Galois/Counter Mode provides authentication

## Monitoring and Alerting

### Health Monitoring
```typescript
// Check KMS health
const healthStatus = await kmsManagementService.getHealthStatus();
if (!healthStatus.healthy) {
  // Alert on KMS unavailability
  logger.error('KMS service unhealthy', healthStatus);
}
```

### Performance Metrics
- Key retrieval response times
- Cache hit rates
- Error rates by provider
- Key rotation frequency

### Alerts
- KMS service unavailability
- Key retrieval failures
- Slow response times (>1000ms)
- Authentication failures

## Migration Guide

### From Environment Variables to KMS

1. **Set up KMS provider** (AWS/GCP/Vault)
2. **Create encryption key** in the KMS
3. **Update environment variables**:
   ```bash
   export KMS_PROVIDER=aws  # or gcp/vault
   export KMS_KEY_ID=default
   # Add provider-specific credentials
   ```
4. **Restart application**
5. **Verify KMS health**: `GET /api/admin/kms/health`
6. **Test key operations**: Encrypt/decrypt test data

### Between KMS Providers

1. **Set up new KMS provider**
2. **Export existing key** (if possible)
3. **Import key to new provider**
4. **Update configuration**
5. **Test thoroughly** before production deployment

## Troubleshooting

### Common Issues

#### KMS Service Unavailable
```
Error: KMS service unavailable
```
**Solution**: Check network connectivity, credentials, and service status

#### Key Not Found
```
Error: Encryption key not found: default
```
**Solution**: Verify key exists in KMS and key ID is correct

#### Authentication Failed
```
Error: Access denied to encryption key
```
**Solution**: Check IAM permissions, service account, or Vault token

#### Invalid Key Format
```
Error: Invalid key length: expected 32 bytes
```
**Solution**: Ensure key is properly formatted (64-character hex string)

### Debug Mode

Enable debug logging:
```bash
export LOG_LEVEL=debug
export KMS_DEBUG=true
```

### Health Check Script

```bash
#!/bin/bash
# Check KMS health
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     http://localhost:3000/api/admin/kms/health
```

## Best Practices

1. **Use dedicated KMS in production** - Never use environment variables for production
2. **Rotate keys regularly** - Set up automatic rotation where possible
3. **Monitor KMS health** - Set up alerts for service unavailability
4. **Backup key metadata** - Keep records of key IDs and creation dates
5. **Test disaster recovery** - Regularly test key recovery procedures
6. **Principle of least privilege** - Grant minimal required permissions
7. **Audit key access** - Monitor and log all key operations
8. **Use separate keys per environment** - Different keys for dev/staging/prod

## Performance Optimization

### Caching
- Keys are cached for 5 minutes by default
- Cache TTL configurable via `KMS_CACHE_TTL` environment variable
- Cache automatically cleared on key rotation

### Connection Pooling
- HTTP clients use connection pooling for better performance
- Configurable timeout and retry settings
- Circuit breaker pattern for fault tolerance

### Async Operations
- Key retrieval supports both sync and async modes
- Async mode recommended for new implementations
- Backward compatibility maintained with sync mode