# Parameter Sanitization System

## Overview

BoosterBeacon implements a comprehensive parameter sanitization system that provides an additional layer of security beyond Joi validation. This system automatically sanitizes all URL parameters and query strings before they reach controllers, preventing various security vulnerabilities.

## Features

### Automatic Sanitization
- **URL Parameters**: All path parameters (`:id`, `:slug`, etc.) are automatically sanitized
- **Query Parameters**: All query string parameters are sanitized, including arrays
- **Request Body**: Body parameters are validated and sanitized through Joi schemas
- **Real-time Processing**: Sanitization occurs before validation middleware

### Security Protection
- **XSS Prevention**: Removes HTML tags, script tags, and dangerous characters
- **SQL Injection Protection**: Strips SQL injection patterns and null bytes
- **Control Character Removal**: Eliminates control characters and null bytes
- **Length Limiting**: Automatically truncates overly long parameters (200 char limit)
- **Unicode Safety**: Handles Unicode characters safely with proper decoding

## Implementation

### Middleware Usage

The sanitization middleware is automatically applied to routes that need it:

```typescript
import { sanitizeParameters, sanitizeProductParameters } from '../middleware/parameterSanitization';

// General parameter sanitization
router.get('/users/:userId', 
  sanitizeParameters,
  authenticate,
  userController.getUser
);

// Specialized product parameter sanitization
router.get('/products/set/:setName', 
  sanitizeProductParameters,
  productController.getProductsBySet
);
```

### Parameter-Specific Sanitization

Different parameter types receive specialized sanitization:

#### UUID Parameters
- **Fields**: `id`, `userId`, `productId`, `categoryId`, etc.
- **Validation**: Strict UUID format validation
- **Sanitization**: Removes non-UUID characters, validates format
- **Result**: Valid UUID or empty string

```typescript
// Input: "123e4567-e89b-12d3-a456-426614174000<script>"
// Output: "" (invalid UUID after sanitization)

// Input: "123E4567-E89B-12D3-A456-426614174000"
// Output: "123e4567-e89b-12d3-a456-426614174000"
```

#### Set Name Parameters
- **Fields**: `setName`, `set_name`
- **Validation**: Pokemon TCG set name patterns
- **Sanitization**: URL decoding, character filtering, length limiting
- **Result**: Clean set name with allowed characters

```typescript
// Input: "Pok%C3%A9mon%20TCG<script>alert('xss')</script>"
// Output: "Pokémon TCGscriptalert(xss)script"

// Input: "Scarlet & Violet - Paldea Evolved"
// Output: "Scarlet & Violet - Paldea Evolved" (unchanged)
```

#### Slug Parameters
- **Fields**: `slug`
- **Validation**: URL-safe slug format
- **Sanitization**: Lowercase conversion, character filtering, hyphen normalization
- **Result**: Valid URL slug

```typescript
// Input: "Test-Slug-123"
// Output: "test-slug-123"

// Input: "test_slug@#$%^&*()"
// Output: "testslug"

// Input: "-test---slug-"
// Output: "test-slug"
```

#### UPC/Barcode Parameters
- **Fields**: `upc`, `barcode`
- **Validation**: 8-14 digit format
- **Sanitization**: Digit extraction, length validation
- **Result**: Valid UPC or empty string

```typescript
// Input: "123-456-789-012"
// Output: "123456789012"

// Input: "1234567" (too short)
// Output: ""

// Input: "12345678901234" (14 digits)
// Output: "12345678901234"
```

#### Search Query Parameters
- **Fields**: `q`, `search`, `query`
- **Validation**: Search-friendly characters
- **Sanitization**: Dangerous character removal, whitespace normalization
- **Result**: Safe search query

```typescript
// Input: 'pokemon cards: "rare" & "holographic"!'
// Output: 'pokemon cards: "rare" & "holographic"!'

// Input: 'search<script>alert("xss")</script>'
// Output: 'searchscriptalert(xss)script'

// Input: 'pokemon    cards   with   spaces'
// Output: 'pokemon cards with spaces'
```

## Security Logging

### Modification Detection
The system logs when parameters are modified during sanitization:

```typescript
logger.warn('URL parameters were sanitized', {
  path: '/api/products/set/dangerous-input',
  method: 'GET',
  originalParams: { setName: 'Test<script>alert("xss")</script>' },
  sanitizedParams: { setName: 'Testscriptalert(xss)script' },
  userAgent: 'Mozilla/5.0...',
  ip: '192.168.1.100',
  correlationId: 'req-123-456'
});
```

### Security Monitoring
- **Potential Attacks**: Logs when dangerous characters are removed
- **User Agent Tracking**: Records browser/client information
- **IP Address Logging**: Tracks source of potentially malicious requests
- **Correlation IDs**: Links sanitization events to specific requests

## Error Handling

### Graceful Degradation
- **Non-blocking**: Sanitization errors don't block requests
- **Logging**: All errors are logged for monitoring
- **Fallback**: Original parameters used if sanitization fails

### Validation Integration
- **Post-sanitization Validation**: Joi validation occurs after sanitization
- **Consistency Checks**: Validates that sanitized parameters are still valid
- **Error Reporting**: Clear error messages for invalid sanitized parameters

```typescript
// If sanitization removes too much content
{
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Request contains invalid parameters",
    "timestamp": "2025-08-28T16:00:00.000Z",
    "correlationId": "req-123-456"
  }
}
```

## Performance Considerations

### Efficiency
- **Minimal Overhead**: Fast string operations with minimal CPU impact
- **Memory Efficient**: In-place parameter modification where possible
- **Caching**: Sanitization patterns are compiled once and reused

### Monitoring
- **Performance Metrics**: Tracks sanitization processing time
- **Memory Usage**: Monitors memory impact of sanitization operations
- **Error Rates**: Tracks sanitization failure rates

## Best Practices

### Route Configuration
```typescript
// Apply sanitization before authentication for security
router.get('/products/:id',
  sanitizeParameters,      // First: sanitize input
  authenticate,           // Second: authenticate user
  validateJoiParams(productSchemas.getById.params), // Third: validate
  productController.getById // Finally: process request
);
```

### Custom Sanitization
For specialized parameter types, extend the sanitization system:

```typescript
function sanitizeCustomParameter(value: string): string {
  // Custom sanitization logic
  return value
    .replace(/[^a-zA-Z0-9\-_]/g, '') // Allow only alphanumeric, hyphens, underscores
    .toLowerCase()
    .substring(0, 50); // Limit to 50 characters
}
```

### Testing Sanitization
```typescript
describe('Parameter Sanitization', () => {
  it('should sanitize dangerous characters', () => {
    const input = 'test<script>alert("xss")</script>';
    const result = sanitizeUrlParameter(input);
    expect(result).toBe('testscriptalert("xss")/script');
    expect(result).not.toContain('<script>');
  });

  it('should handle Unicode characters safely', () => {
    const input = 'Pokémon TCG';
    const result = sanitizeSetName(input);
    expect(result).toBe('Pokémon TCG');
  });
});
```

## Security Benefits

### Attack Prevention
- **XSS Attacks**: Removes script tags and dangerous HTML
- **SQL Injection**: Strips SQL injection patterns
- **Path Traversal**: Prevents directory traversal attempts
- **Buffer Overflow**: Limits parameter length to prevent overflow attacks

### Compliance
- **OWASP Guidelines**: Follows OWASP input validation recommendations
- **Security Standards**: Implements industry-standard sanitization practices
- **Audit Trail**: Comprehensive logging for security audits

## Conclusion

The parameter sanitization system provides a robust first line of defense against various web application attacks. Combined with Joi validation and other security measures, it ensures that BoosterBeacon maintains the highest security standards while providing a seamless user experience.

Key benefits:
- **Automatic Protection**: No manual intervention required
- **Performance Optimized**: Minimal impact on request processing
- **Comprehensive Coverage**: Handles all parameter types
- **Security Logging**: Complete audit trail for monitoring
- **Developer Friendly**: Easy to use and extend