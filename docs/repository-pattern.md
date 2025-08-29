# Repository Pattern Implementation

## Overview

BoosterBeacon implements a comprehensive repository pattern that provides a clean abstraction layer between business logic and data access. This architectural improvement enhances testability, maintainability, and flexibility by separating concerns and enabling dependency injection.

## Architecture

### Repository Interface Design

All repositories implement well-defined interfaces that abstract database operations:

```typescript
export interface IAlertRepository {
  findPendingAlerts(limit: number): Promise<IAlert[]>;
  findFailedAlertsForRetry(maxRetries: number): Promise<IAlert[]>;
  createAlert(data: Partial<IAlert>): Promise<IAlert>;
  markAsSent(id: string, channels: string[]): Promise<void>;
  markAsFailed(id: string, reason: string): Promise<void>;
  findById(id: string): Promise<IAlert | null>;
  findBy(criteria: Partial<IAlert>): Promise<IAlert[]>;
  updateById(id: string, data: Partial<IAlert>): Promise<IAlert | null>;
  findByUserId(userId: string, limit?: number): Promise<IAlert[]>;
  getStats(): Promise<AlertStats>;
  bulkCreate(alerts: Partial<IAlert>[]): Promise<IAlert[]>;
  deleteOldAlerts(olderThanDays: number): Promise<number>;
}
```

### Repository Implementation

Repository classes wrap existing models and provide consistent interfaces:

```typescript
export class AlertRepository implements IAlertRepository {
  async findPendingAlerts(limit: number): Promise<IAlert[]> {
    try {
      const result = await Alert.findBy<IAlert>(
        { status: 'pending' },
        { 
          limit, 
          orderBy: 'created_at', 
          orderDirection: 'asc' 
        }
      );
      return result.data;
    } catch (error) {
      logger.error('Error finding pending alerts', error);
      throw error;
    }
  }

  async createAlert(data: Partial<IAlert>): Promise<IAlert> {
    try {
      return await Alert.createAlert(data);
    } catch (error) {
      logger.error('Error creating alert', error, { data });
      throw error;
    }
  }

  // ... other methods
}
```

## Key Features

### 1. Clean Abstraction
- **Interface-Based Design**: All repositories implement well-defined interfaces
- **Consistent API**: Standardized method signatures across all repositories
- **Error Handling**: Comprehensive error handling with structured logging
- **Type Safety**: Full TypeScript support with generic type parameters

### 2. Enhanced Testability
- **Easy Mocking**: Repositories can be easily mocked for unit testing
- **Isolated Testing**: Business logic can be tested independently of database
- **Predictable Behavior**: No hidden dependencies or side effects

### 3. Performance Optimization
- **Efficient Queries**: Optimized database queries with proper indexing
- **Batch Operations**: Support for bulk operations to reduce database round trips
- **Connection Management**: Proper database connection handling and pooling
- **Query Monitoring**: Performance tracking and slow query detection

### 4. Comprehensive Logging
- **Operation Logging**: All database operations are logged with context
- **Error Tracking**: Detailed error logging with correlation IDs
- **Performance Metrics**: Query timing and performance monitoring
- **Debug Information**: Rich debugging context in development mode

## Available Repositories

### AlertRepository
**Purpose**: Manages alert data access and operations
**Key Methods**:
- `findPendingAlerts()` - Get alerts ready for processing
- `findFailedAlertsForRetry()` - Get failed alerts for retry logic
- `createAlert()` - Create new alert records
- `markAsSent()` / `markAsFailed()` - Update alert status
- `getStats()` - Get alert statistics and metrics
- `bulkCreate()` - Efficient bulk alert creation
- `deleteOldAlerts()` - Cleanup old alert records

### UserRepository (Planned)
**Purpose**: User data access and management
**Key Methods**:
- `findById()` - Get user by ID
- `findByEmail()` - Get user by email address
- `createUser()` - Create new user account
- `updateUser()` - Update user information
- `findWithPermissions()` - Get user with RBAC permissions

### ProductRepository (Planned)
**Purpose**: Product catalog data access
**Key Methods**:
- `findById()` - Get product by ID
- `search()` - Search products with filters
- `findByCategory()` - Get products by category
- `updateAvailability()` - Update product availability
- `getBestDeals()` - Get current best deals

### WatchRepository (Planned)
**Purpose**: Watch subscription data access
**Key Methods**:
- `findByUserId()` - Get user's watches
- `createWatch()` - Create new watch
- `updateWatch()` - Update watch settings
- `findActiveWatches()` - Get active watches for monitoring
- `getWatchStats()` - Get watch statistics

## Usage Patterns

### Service Integration

```typescript
export class AlertProcessingService {
  constructor(
    private alertRepository: IAlertRepository,
    private logger: ILogger
  ) {}

  async processPendingAlerts(limit: number = 100): Promise<ProcessingResult> {
    try {
      const pendingAlerts = await this.alertRepository.findPendingAlerts(limit);
      
      for (const alert of pendingAlerts) {
        await this.processAlert(alert);
      }

      return { processed: pendingAlerts.length };
    } catch (error) {
      this.logger.error('Failed to process pending alerts', error);
      throw error;
    }
  }
}
```

### Testing with Mocks

```typescript
describe('AlertProcessingService', () => {
  let service: AlertProcessingService;
  let mockAlertRepository: jest.Mocked<IAlertRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockAlertRepository = {
      findPendingAlerts: jest.fn(),
      createAlert: jest.fn(),
      markAsSent: jest.fn(),
      // ... other methods
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    service = new AlertProcessingService(mockAlertRepository, mockLogger);
  });

  it('should process pending alerts', async () => {
    // Arrange
    const mockAlerts = [{ id: '1', status: 'pending' }];
    mockAlertRepository.findPendingAlerts.mockResolvedValue(mockAlerts);

    // Act
    const result = await service.processPendingAlerts(10);

    // Assert
    expect(mockAlertRepository.findPendingAlerts).toHaveBeenCalledWith(10);
    expect(result.processed).toBe(1);
  });
});
```

## Error Handling

### Comprehensive Error Context

All repository methods include comprehensive error handling:

```typescript
async findById(id: string): Promise<IAlert | null> {
  try {
    return await Alert.findById<IAlert>(id);
  } catch (error) {
    logger.error('Error finding alert by ID', error, { id });
    throw error;
  }
}
```

### Error Types
- **Database Errors**: Connection issues, query failures, constraint violations
- **Validation Errors**: Invalid data format or missing required fields
- **Not Found Errors**: Requested resources don't exist
- **Permission Errors**: Access control violations

## Performance Considerations

### Query Optimization
- **Indexed Queries**: All queries use appropriate database indexes
- **Pagination Support**: Built-in pagination for large result sets
- **Batch Operations**: Efficient bulk operations for multiple records
- **Connection Pooling**: Proper database connection management

### Monitoring and Metrics
- **Query Timing**: Automatic timing of all database operations
- **Slow Query Detection**: Logging of queries exceeding performance thresholds
- **Error Rate Tracking**: Monitoring of database error rates
- **Resource Usage**: Memory and connection usage tracking

## Best Practices

### Repository Design
1. **Single Responsibility**: Each repository handles one entity type
2. **Interface First**: Always define interfaces before implementation
3. **Error Handling**: Comprehensive error handling with context
4. **Logging**: Structured logging for all operations
5. **Type Safety**: Use TypeScript generics for type safety

### Testing
1. **Mock Interfaces**: Always mock repository interfaces, not implementations
2. **Test Business Logic**: Focus tests on business logic, not database operations
3. **Integration Tests**: Separate integration tests for repository implementations
4. **Error Scenarios**: Test error handling and edge cases

### Performance
1. **Efficient Queries**: Use appropriate indexes and query patterns
2. **Batch Operations**: Prefer bulk operations for multiple records
3. **Connection Management**: Proper connection pooling and cleanup
4. **Monitoring**: Track performance metrics and optimize slow queries

## Migration Guide

### Converting Existing Services

1. **Create Repository Interface**:
```typescript
export interface IUserRepository {
  findById<T>(id: string): Promise<T | null>;
  findByEmail(email: string): Promise<IUser | null>;
  createUser(data: Partial<IUser>): Promise<IUser>;
}
```

2. **Implement Repository**:
```typescript
export class UserRepository implements IUserRepository {
  async findById<T>(id: string): Promise<T | null> {
    return User.findById<T>(id);
  }
  // ... other methods
}
```

3. **Update Service Constructor**:
```typescript
export class UserService {
  constructor(
    private userRepository: IUserRepository,
    private logger: ILogger
  ) {}
}
```

4. **Create Factory Function**:
```typescript
export const createUserService = (dependencies?: Partial<Dependencies>) => {
  const container = DependencyContainer.getInstance();
  return new UserService(
    dependencies?.userRepository || container.getUserRepository(),
    dependencies?.logger || container.getLogger()
  );
};
```

## Future Enhancements

### Planned Features
1. **Generic Repository Base Class**: Common functionality for all repositories
2. **Query Builder Integration**: Advanced query building capabilities
3. **Caching Layer**: Automatic caching for frequently accessed data
4. **Event Sourcing**: Event-driven data access patterns
5. **Multi-Database Support**: Support for multiple database backends

### Advanced Patterns
1. **Unit of Work**: Transaction management across multiple repositories
2. **Specification Pattern**: Complex query building with reusable specifications
3. **CQRS Integration**: Command and query responsibility segregation
4. **Repository Decorators**: Cross-cutting concerns like caching and logging

## Related Documentation

- [Dependency Injection System](dependency-injection.md) - How repositories integrate with DI
- [Enhanced Logging System](enhanced-logging.md) - Logging patterns used in repositories
- [Type Safety System](type-safety.md) - Type guards and validation utilities
- [Testing Strategy](testing-strategy.md) - Testing patterns for repositories
- [Database Configuration](../backend/src/config/database.ts) - Database setup and configuration

## Conclusion

The repository pattern implementation provides a clean, testable, and maintainable data access layer for BoosterBeacon. By abstracting database operations behind well-defined interfaces, the system achieves better separation of concerns, enhanced testability, and improved flexibility for future enhancements.

Key benefits include:
- **Clean Architecture**: Clear separation between business logic and data access
- **Enhanced Testability**: Easy mocking and isolated testing
- **Type Safety**: Full TypeScript support with comprehensive interfaces
- **Performance Optimization**: Efficient queries and proper resource management
- **Comprehensive Logging**: Detailed operation logging and error tracking
- **Future-Proof Design**: Extensible architecture for future enhancements