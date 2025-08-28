# Dependency Injection System

BoosterBeacon implements a comprehensive dependency injection (DI) system that significantly improves testability, maintainability, and flexibility of the backend services. This document provides an overview of the DI system and how to use it effectively.

## Overview

The dependency injection system replaces static method calls and direct imports with constructor-injected dependencies, making services more testable and flexible. This architectural improvement enables:

- **Enhanced Testability**: Easy mocking of dependencies for isolated unit testing
- **Better Maintainability**: Clear separation of concerns and explicit dependencies
- **Improved Flexibility**: Ability to swap implementations for different environments
- **Type Safety**: Full TypeScript support with comprehensive interfaces

## Architecture Components

### 1. Dependency Container (`DependencyContainer`)

The central container manages all service dependencies and provides singleton access:

```typescript
import { DependencyContainer } from '../container/DependencyContainer';

const container = DependencyContainer.getInstance();
const userRepository = container.getUserRepository();
const logger = container.getLogger();
```

### 2. Repository Pattern

Repository classes wrap existing models and provide clean interfaces for data access:

```typescript
// UserRepository wraps the User model
export class UserRepository implements IUserRepository {
  async findById<T>(id: string): Promise<T | null> {
    return User.findById<T>(id);
  }
  
  async findByEmail(email: string): Promise<IUser | null> {
    return User.findByEmail(email);
  }
}
```

### 3. Service Factory (`ServiceFactory`)

Provides convenient service creation with proper dependency injection:

```typescript
import { serviceFactory } from '../services/ServiceFactory';

const authService = serviceFactory.createAuthService();
const adminService = serviceFactory.createAdminSystemService();
```

### 4. Factory Functions

Individual services provide factory functions for easy instantiation:

```typescript
import { createAuthService } from '../services/authService';
import { createAdminSystemService } from '../services/adminSystemService';

const authService = createAuthService();
const adminService = createAdminSystemService();
```

## Migrated Services

The following core services have been successfully migrated to the DI pattern:

### AuthService
- **Dependencies**: `IUserRepository`, `ILogger`
- **Features**: JWT token management, user authentication, password reset
- **Factory**: `createAuthService()`

### AdminSystemService
- **Dependencies**: `ISystemRepository`, `ILogger`
- **Features**: System health monitoring, metrics collection, dashboard statistics
- **Factory**: `createAdminSystemService()`

### CredentialService
- **Dependencies**: `IUserRepository`, `ILogger`
- **Features**: Encrypted retailer credential storage and management
- **Factory**: `createCredentialService()`

### QuietHoursService
- **Dependencies**: `IUserRepository`, `ILogger`
- **Features**: User quiet hours management and validation
- **Factory**: `createQuietHoursService()`

## Usage Patterns

### Production Usage

```typescript
// Using factory functions (recommended)
import { createAuthService } from '../services/authService';

const authService = createAuthService();
const result = await authService.register(userData);

// Using service factory
import { serviceFactory } from '../services/ServiceFactory';

const authService = serviceFactory.createAuthService();
const result = await authService.register(userData);
```

### Testing Usage

```typescript
describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    // Create mocks
    mockUserRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      createUser: jest.fn(),
      // ... other methods
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    // Inject mocks
    authService = new AuthService(mockUserRepository, mockLogger);
  });

  it('should register a new user', async () => {
    // Arrange
    mockUserRepository.findByEmail.mockResolvedValue(null);
    mockUserRepository.createUser.mockResolvedValue(mockUser);

    // Act
    const result = await authService.register(userData);

    // Assert
    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
    expect(result.user.id).toBe('user-123');
  });
});
```

## Benefits Achieved

### 1. Improved Testability
- **Easy Mocking**: Dependencies can be easily mocked without complex static method mocking
- **Isolated Testing**: Business logic can be tested in isolation from database/external services
- **Predictable Tests**: No hidden dependencies or side effects

### 2. Better Maintainability
- **Clear Dependencies**: All dependencies are explicit in constructor
- **Separation of Concerns**: Business logic separated from infrastructure concerns
- **Easier Refactoring**: Changes to dependencies don't require changing service logic

### 3. Enhanced Flexibility
- **Swappable Implementations**: Can easily swap database implementations, loggers, etc.
- **Environment-Specific Behavior**: Different implementations for dev/test/prod
- **Feature Flags**: Can inject different implementations based on configuration

### 4. Performance Benefits
- **Connection Pooling**: Can inject optimized database connections
- **Caching**: Can inject caching layers transparently
- **Monitoring**: Can inject performance monitoring wrappers

## Migration Status

### Phase 1: Core Infrastructure ✅ **COMPLETED**
- [x] Create dependency interfaces
- [x] Implement repository wrappers
- [x] Create dependency container
- [x] Build service factory

### Phase 2: Service Refactoring ✅ **COMPLETED**
- [x] Refactor AuthService
- [x] Refactor CredentialService  
- [x] Refactor QuietHoursService
- [x] Refactor AdminSystemService
- [x] Update controllers to use factory functions

### Phase 3: Remaining Services (In Progress)
- [ ] Refactor AlertProcessingService
- [ ] Refactor AlertDeliveryService
- [ ] Refactor MLPredictionService
- [ ] Refactor AdminAuditService
- [ ] Refactor AdminMLService
- [ ] Refactor RBACInitializationService

### Phase 4: Advanced Features (Future)
- [ ] Add service lifecycle management
- [ ] Implement service discovery
- [ ] Add configuration-based dependency injection
- [ ] Create service health monitoring

## Best Practices

### 1. Interface Design
- Keep interfaces focused and cohesive
- Use generic types where appropriate
- Avoid exposing implementation details

### 2. Service Construction
- Validate dependencies in constructor
- Fail fast if required dependencies are missing
- Use factory functions for convenience

### 3. Testing
- Always inject mocks in tests
- Test business logic, not infrastructure
- Use type-safe mocks with proper interfaces

### 4. Error Handling
- Handle dependency failures gracefully
- Provide meaningful error messages
- Log dependency-related issues appropriately

## Example: Creating a New Service with DI

```typescript
// 1. Define repository interface
export interface IProductRepository {
  findById<T>(id: string): Promise<T | null>;
  search(criteria: SearchCriteria): Promise<Product[]>;
}

// 2. Implement repository
export class ProductRepository implements IProductRepository {
  async findById<T>(id: string): Promise<T | null> {
    return Product.findById<T>(id);
  }
  
  async search(criteria: SearchCriteria): Promise<Product[]> {
    return Product.search(criteria);
  }
}

// 3. Create service with DI
export class ProductService {
  constructor(
    private productRepository: IProductRepository,
    private logger: ILogger
  ) {}

  async getProduct(id: string): Promise<Product | null> {
    try {
      const product = await this.productRepository.findById<Product>(id);
      this.logger.info('Product retrieved', { productId: id });
      return product;
    } catch (error) {
      this.logger.error('Failed to get product', { productId: id, error });
      throw error;
    }
  }
}

// 4. Create factory function
export const createProductService = (dependencies?: Partial<IServiceDependencies>) => {
  const container = DependencyContainer.getInstance();
  return new ProductService(
    dependencies?.productRepository || container.getProductRepository(),
    dependencies?.logger || container.getLogger()
  );
};
```

## Related Documentation

- [Complete DI Implementation Guide](../backend/docs/DEPENDENCY_INJECTION.md) - Detailed technical documentation
- [Testing Strategy](testing-strategy.md) - How DI improves testing
- [API Reference](api-reference.md) - Updated endpoint documentation
- [Authentication Security](authentication-security.md) - AuthService DI implementation

## Conclusion

The dependency injection system significantly improves the BoosterBeacon backend architecture by making services more testable, maintainable, and flexible. The migration maintains backward compatibility while providing a clear path for future enhancements and better development practices.