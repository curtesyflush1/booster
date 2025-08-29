# Pagination Enforcement System

This document describes the comprehensive pagination enforcement system implemented to prevent performance degradation with large datasets.

## Overview

The pagination enforcement system ensures that all database queries that can return multiple rows are properly paginated by default. This prevents memory issues and performance degradation when dealing with large datasets.

## Key Components

### 1. BaseModel Changes

The `BaseModel.findBy()` method now **requires pagination** and returns `IPaginatedResult<T>` instead of `T[]`:

```typescript
// OLD (deprecated)
const users = await User.findBy({ is_active: true }); // Returns T[]

// NEW (required)
const result = await User.findBy({ is_active: true }, { page: 1, limit: 20 });
const users = result.data; // Access the actual data
```

### 2. Pagination Middleware

Use the pagination enforcement middleware in your routes:

```typescript
import { enforcePagination, PaginationRequest } from '../middleware/paginationEnforcement';

router.get('/users', enforcePagination, async (req: PaginationRequest, res: Response) => {
  const result = await User.findBy({ is_active: true }, req.pagination);
  res.json(formatPaginatedResponse(result.data, result.total, result.page, result.limit));
});
```

### 3. Query Interceptor

The `QueryInterceptor` monitors database queries and warns about potential performance issues:

```typescript
import { queryInterceptor } from '../utils/queryInterceptor';

// Analyze a query for pagination compliance
const analysis = queryInterceptor.analyzeQuery(knexQuery);
if (analysis.riskLevel === 'high') {
  console.warn('High-risk query detected:', analysis.suggestions);
}
```

### 4. Safe Unpaginated Queries

For cases where you truly need all records (rare), use the safe unpaginated method:

```typescript
const allUsers = await User.findByUnpaginated(
  { is_active: true },
  {
    maxRecords: 500,
    reason: 'Export functionality - verified small dataset'
  }
);
```

## Migration Guide

### Step 1: Update Model Usage

Replace all `findBy()` calls with paginated versions:

```typescript
// Before
const products = await Product.findBy({ category_id: categoryId });

// After
const result = await Product.findBy({ category_id: categoryId }, { 
  page: req.pagination.page, 
  limit: req.pagination.limit 
});
const products = result.data;
```

### Step 2: Update Controllers

Add pagination middleware to routes that return multiple records:

```typescript
// Before
router.get('/products', async (req: Request, res: Response) => {
  const products = await Product.findBy({ is_active: true });
  res.json(products);
});

// After
router.get('/products', enforcePagination, async (req: PaginationRequest, res: Response) => {
  const result = await Product.findBy({ is_active: true }, req.pagination);
  res.json(formatPaginatedResponse(result.data, result.total, result.page, result.limit));
});
```

### Step 3: Update Direct Knex Queries

Use the `createPaginatedQuery` helper for direct database queries:

```typescript
// Before
const products = await knex('products').select('*').where('is_active', true);

// After
const { query, countQuery } = createPaginatedQuery(knex, 'products', {
  where: { is_active: true },
  page: req.pagination.page,
  limit: req.pagination.limit
});
const products = await query;
const totalResult = await countQuery;
```

## Configuration

### Pagination Limits

Default pagination settings are defined in `constants/index.ts`:

```typescript
export const DEFAULT_VALUES = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_QUERY_LIMIT: 100, // Maximum records per query
} as const;
```

### Environment Overrides

You can adjust limits based on environment:

```typescript
// In production, use stricter limits
if (process.env.NODE_ENV === 'production') {
  DEFAULT_VALUES.MAX_QUERY_LIMIT = 50;
}
```

## Monitoring and Compliance

### Query Monitoring

The system automatically monitors query patterns:

```typescript
// Get monitoring statistics
const stats = queryInterceptor.getStats();
console.log(`Risk percentage: ${stats.riskPercentage}%`);
```

### Compliance Checking

Track pagination compliance across your application:

```typescript
import { PaginationComplianceChecker } from '../utils/paginationMigration';

// Check compliance for a method
PaginationComplianceChecker.checkCompliance('getProducts', 500, false);

// Get compliance report
const report = PaginationComplianceChecker.getComplianceReport();
```

## Best Practices

### 1. Always Use Pagination for Lists

Any endpoint that returns a list of items should use pagination:

```typescript
// ✅ Good
GET /api/products?page=1&limit=20

// ❌ Bad
GET /api/products (returns all products)
```

### 2. Provide Meaningful Defaults

Set reasonable default page sizes based on the data type:

```typescript
// For heavy objects (products with images)
const result = await Product.findBy(criteria, { limit: 10 });

// For lightweight objects (simple lists)
const result = await Category.findBy(criteria, { limit: 50 });
```

### 3. Include Total Count

Always include total count for proper pagination UI:

```typescript
const response = formatPaginatedResponse(
  result.data,
  result.total,
  result.page,
  result.limit,
  { 
    processingTime: Date.now() - startTime,
    cacheHit: false 
  }
);
```

### 4. Handle Edge Cases

```typescript
// Handle empty results
if (result.total === 0) {
  return res.json({
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    message: 'No results found'
  });
}

// Handle invalid page numbers
if (req.pagination.page > Math.ceil(result.total / result.limit)) {
  return res.status(400).json({
    error: 'Page number exceeds available pages'
  });
}
```

## Performance Considerations

### 1. Database Indexes

Ensure proper indexes for paginated queries:

```sql
-- For pagination with ordering
CREATE INDEX idx_products_active_created ON products(is_active, created_at DESC);

-- For filtered pagination
CREATE INDEX idx_products_category_active ON products(category_id, is_active, created_at DESC);
```

### 2. Count Query Optimization

For large datasets, consider approximate counts:

```typescript
// For very large tables, use estimated counts
const useEstimate = result.total > 100000;
if (useEstimate) {
  // Use database statistics for approximate count
  const estimatedTotal = await getEstimatedRowCount('products');
}
```

### 3. Cursor-Based Pagination

For high-performance scenarios, consider cursor-based pagination:

```typescript
// Instead of OFFSET/LIMIT
const products = await knex('products')
  .where('created_at', '<', lastSeenTimestamp)
  .orderBy('created_at', 'desc')
  .limit(20);
```

## Error Handling

The system provides detailed error messages for pagination issues:

```typescript
// Invalid pagination parameters
{
  "error": {
    "code": "INVALID_PAGINATION",
    "message": "Invalid pagination parameters",
    "details": ["Page must be greater than 0"],
    "corrected": { "page": 1, "limit": 20 }
  }
}

// Exceeding maximum limit
{
  "error": {
    "code": "LIMIT_EXCEEDED",
    "message": "Requested limit exceeds maximum allowed",
    "maxLimit": 100,
    "requested": 500
  }
}
```

## Testing

Test your paginated endpoints:

```typescript
describe('Product API Pagination', () => {
  it('should enforce pagination parameters', async () => {
    const response = await request(app)
      .get('/api/products')
      .expect(400);
    
    expect(response.body.error.code).toBe('PAGINATION_REQUIRED');
  });

  it('should return paginated results', async () => {
    const response = await request(app)
      .get('/api/products?page=1&limit=10')
      .expect(200);
    
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('pagination');
    expect(response.body.data.length).toBeLessThanOrEqual(10);
  });
});
```

## Troubleshooting

### Common Issues

1. **"Property 'length' does not exist on type 'IPaginatedResult'"**
   - Solution: Use `result.data.length` instead of `result.length`

2. **"Cannot iterate over IPaginatedResult"**
   - Solution: Iterate over `result.data` instead of `result`

3. **"Query returns too many records"**
   - Solution: Add pagination parameters or use `findByUnpaginated` with explicit limits

### Debug Mode

Enable query monitoring in development:

```typescript
import { enableQueryMonitoring } from '../middleware/paginationEnforcement';

if (process.env.NODE_ENV === 'development') {
  enableQueryMonitoring();
}
```

This will log statistics about query patterns and highlight potential issues.