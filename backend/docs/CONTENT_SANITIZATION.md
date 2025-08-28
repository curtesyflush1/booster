# Content Sanitization System

## Overview

The BoosterBeacon application implements comprehensive content sanitization to prevent XSS (Cross-Site Scripting) attacks and ensure that all user-generated content is safe before being stored in the database or displayed to users.

## Architecture

The content sanitization system consists of several layers:

1. **Input Sanitization Middleware** - Sanitizes request bodies before they reach controllers
2. **Model-Level Sanitization** - Additional sanitization in data models before database storage
3. **Content Type Detection** - Automatic detection of content types based on field names
4. **Configurable Sanitization Rules** - Different sanitization rules for different content types

## Components

### Core Sanitization Functions

#### `sanitizeHTML(content, config)`
The main sanitization function that uses DOMPurify to clean HTML content.

```typescript
const sanitized = sanitizeHTML('<p>Hello <script>alert(1)</script></p>', {
  allowedTags: ['p', 'strong', 'em'],
  allowedAttributes: {},
  stripTags: false,
  maxLength: 1000,
  preserveLineBreaks: true
});
// Result: '<p>Hello </p>'
```

#### `sanitizeUserContent(content, contentType)`
High-level function that sanitizes content based on its type.

```typescript
const sanitized = sanitizeUserContent('<p>Product <strong>description</strong></p>', 'product_description');
// Allows rich HTML for product descriptions
```

#### `sanitizeJSONContent(obj, contentType)`
Recursively sanitizes all string values in JSON objects.

```typescript
const obj = {
  name: '<script>alert(1)</script>Product Name',
  description: '<p>Safe <strong>description</strong></p>'
};
const sanitized = sanitizeJSONContent(obj, 'product_description');
```

### Content Types

The system supports different content types with varying levels of HTML support:

#### `PLAIN_TEXT`
- **Use Case**: Names, titles, search queries
- **Allowed Tags**: None
- **Behavior**: Strips all HTML, keeps only text content

#### `USER_DESCRIPTION`
- **Use Case**: User bios, custom descriptions
- **Allowed Tags**: `p`, `br`, `strong`, `em`
- **Behavior**: Allows basic formatting, removes dangerous content

#### `PRODUCT_DESCRIPTION`
- **Use Case**: Product descriptions (admin content)
- **Allowed Tags**: `p`, `br`, `strong`, `em`, `u`, `ol`, `ul`, `li`, `h3`, `h4`
- **Behavior**: Allows rich formatting for administrative content

#### `ADMIN_NOTES`
- **Use Case**: Internal admin notes, training notes, review notes
- **Allowed Tags**: `p`, `br`, `strong`, `em`, `ul`, `li`
- **Behavior**: Allows basic formatting for internal use

#### `BASIC_RICH_TEXT`
- **Use Case**: Comments, posts, community content
- **Allowed Tags**: `p`, `br`, `strong`, `em`, `u`, `ol`, `ul`, `li`
- **Behavior**: Allows safe rich text formatting

#### `SEARCH_QUERY`
- **Use Case**: Search inputs, query parameters
- **Allowed Tags**: None
- **Behavior**: Very restrictive, removes all HTML and dangerous characters

### Middleware Integration

#### Route-Level Sanitization

```typescript
import { contentSanitizationMiddleware } from '../utils/contentSanitization';

// Product routes
router.post('/products', 
  contentSanitizationMiddleware.products,
  validateBody(productSchema),
  productController.createProduct
);

// User routes
router.put('/profile', 
  contentSanitizationMiddleware.users,
  validateBody(userSchema),
  userController.updateProfile
);
```

#### Available Middleware

- `contentSanitizationMiddleware.products` - For product-related content
- `contentSanitizationMiddleware.users` - For user profile content
- `contentSanitizationMiddleware.admin` - For admin notes and internal content
- `contentSanitizationMiddleware.community` - For community posts and comments
- `contentSanitizationMiddleware.search` - For search queries
- `contentSanitizationMiddleware.watchPacks` - For watch pack descriptions

### Model Integration

Models automatically sanitize content using the `sanitize()` method:

```typescript
// In Product model
sanitize(data: Partial<IProduct>): Partial<IProduct> {
  const sanitized: Partial<IProduct> = { ...data };
  
  if (sanitized.name) {
    sanitized.name = sanitizeUserContent(sanitized.name, 'plain_text');
  }
  if (sanitized.description) {
    sanitized.description = sanitizeUserContent(sanitized.description, 'product_description');
  }
  
  return sanitized;
}
```

## Security Features

### XSS Prevention

The system prevents various XSS attack vectors:

- **Script Injection**: `<script>` tags are completely removed
- **Event Handlers**: `onclick`, `onerror`, `onload`, etc. are stripped
- **JavaScript URLs**: `javascript:` protocols are removed
- **Data URLs**: `data:` protocols are sanitized
- **Iframe Injection**: `<iframe>` tags are blocked
- **Object/Embed Tags**: Dangerous embedded content is removed

### Content Validation

After sanitization, the system validates that:

- Content wasn't completely removed (potential attack detection)
- Content wasn't significantly modified (>30% change triggers warning)
- Suspicious patterns are logged for security monitoring

```typescript
const validation = validateSanitizedContent(original, sanitized, 'field_name');
if (!validation.isValid) {
  logger.warn('Content sanitization issues', { warnings: validation.warnings });
}
```

## Configuration

### Custom Sanitization Rules

You can create custom sanitization configurations:

```typescript
const customConfig: SanitizationConfig = {
  allowedTags: ['p', 'strong'],
  allowedAttributes: {},
  stripTags: false,
  maxLength: 500,
  preserveLineBreaks: true
};

const sanitized = sanitizeHTML(content, customConfig);
```

### Field-Specific Sanitization

For complex objects, you can specify different content types for different fields:

```typescript
const fieldMap = {
  'title': 'plain_text',
  'description': 'user_description',
  'admin_notes': 'admin_notes'
};

const sanitized = sanitizeObjectFields(obj, fieldMap);
```

## Testing

### Unit Tests

The system includes comprehensive unit tests covering:

- Basic HTML sanitization
- XSS prevention for common attack vectors
- Content type detection
- JSON object sanitization
- Performance with large content

### Integration Tests

Integration tests verify:

- End-to-end sanitization in API endpoints
- Middleware integration
- Database storage of sanitized content
- Real-world XSS prevention

### Running Tests

```bash
# Run content sanitization tests
npm test -- --testPathPattern=contentSanitization

# Run integration tests
npm run test:integration -- --testPathPattern=contentSanitization
```

## Performance Considerations

### Optimization Features

- **Caching**: DOMPurify configurations are reused
- **Lazy Loading**: Heavy sanitization only when needed
- **Length Limits**: Configurable maximum content length
- **Efficient Patterns**: Optimized regex patterns for common cases

### Performance Monitoring

The system tracks:

- Sanitization processing time
- Content size before/after sanitization
- Memory usage for large content
- Cache hit rates

## Logging and Monitoring

### Security Logging

All sanitization events are logged with:

- Original content length
- Sanitized content length
- Content type used
- Warnings for suspicious content
- Performance metrics

### Alert Conditions

The system alerts on:

- Content completely removed during sanitization
- Significant content modification (>30% change)
- Suspicious XSS patterns detected
- Performance degradation (>1000ms processing time)

## Best Practices

### For Developers

1. **Always Use Middleware**: Apply content sanitization middleware to all routes handling user input
2. **Choose Appropriate Content Types**: Use the most restrictive content type that meets your needs
3. **Validate After Sanitization**: Check that sanitization didn't break expected content
4. **Test XSS Vectors**: Include XSS testing in your test suites
5. **Monitor Logs**: Watch for sanitization warnings in production

### For Content Types

1. **Plain Text**: Use for names, titles, identifiers
2. **User Description**: Use for user-generated descriptions, bios
3. **Rich Text**: Use for comments, posts where formatting is needed
4. **Admin Notes**: Use for internal administrative content
5. **Search Query**: Use for all search inputs and query parameters

### Security Guidelines

1. **Defense in Depth**: Sanitization is one layer; also validate on frontend
2. **Regular Updates**: Keep DOMPurify library updated
3. **Content Security Policy**: Implement CSP headers as additional protection
4. **Input Validation**: Combine sanitization with proper input validation
5. **Output Encoding**: Consider additional encoding when displaying content

## Troubleshooting

### Common Issues

#### Content Being Over-Sanitized
```typescript
// Problem: Important content being removed
const result = sanitizeUserContent('<em>Important</em>', 'plain_text');
// Result: 'Important' (em tag removed)

// Solution: Use appropriate content type
const result = sanitizeUserContent('<em>Important</em>', 'user_description');
// Result: '<em>Important</em>' (em tag preserved)
```

#### Performance Issues
```typescript
// Problem: Large content causing slowdowns
const largeContent = 'A'.repeat(100000);

// Solution: Set appropriate length limits
const config = { ...SANITIZATION_CONFIGS.PLAIN_TEXT, maxLength: 1000 };
const result = sanitizeHTML(largeContent, config);
```

#### Unexpected Content Removal
```typescript
// Check validation results
const validation = validateSanitizedContent(original, sanitized, 'field');
if (validation.warnings.length > 0) {
  console.log('Sanitization warnings:', validation.warnings);
}
```

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
// Set environment variable
process.env.SANITIZATION_DEBUG = 'true';

// Or use debug function
const result = sanitizeHTML(content, config, { debug: true });
```

## Migration Guide

### Existing Applications

To add content sanitization to existing routes:

1. **Install Dependencies**:
   ```bash
   npm install dompurify jsdom @types/dompurify @types/jsdom
   ```

2. **Add Middleware**:
   ```typescript
   import { contentSanitizationMiddleware } from '../utils/contentSanitization';
   
   router.post('/api/content', 
     contentSanitizationMiddleware.users, // Add this line
     validateBody(schema),
     controller.method
   );
   ```

3. **Update Models**:
   ```typescript
   // Add sanitization to model methods
   static async create(data: any) {
     const sanitized = this.sanitize(data);
     return super.create(sanitized);
   }
   ```

4. **Test Thoroughly**:
   - Run existing tests to ensure no breaking changes
   - Add XSS prevention tests
   - Verify content is properly sanitized

### Backward Compatibility

The sanitization system is designed to be backward compatible:

- Existing content in database remains unchanged
- New content is automatically sanitized
- Gradual migration possible through feature flags
- No breaking changes to existing APIs