# Dependency Injection Implementation

This document describes the dependency injection system implemented to improve testability and maintainability of the BoosterBeacon backend services.

## Overview

The dependency injection (DI) system replaces static method calls with constructor-injected dependencies, making services more testable and flexible.

## Architecture

### Before (Static Dependencies)
```typescript
// Services directly used static model methods
export class AuthService {
  static async register(userData: IUserRegistration) {
    const user = await User.findByEmail(userData.email); // Static dependency
    // ...
  }
}
```

### After (Dependency Injection)
```typescript
// Services receive dependencies via constructor
export class AuthService {
  constructor(
    private userRepository: IUserRepository,
    private logger: ILogger
  ) {}

  async register(userData: IUserRegistration) {
    const user = await this.userRepository.findByEmail(userData.email); // Injected dependency
    // ...
  }
}
```

## Core Components

### 1. Dependency Interfaces (`src/types/dependencies.ts`)

Defines contracts for all injectable dependencies:

```typescript
export interface IUserRepository {
  findById<T>(id: string): Promise<T | null>;
  findByEmail(email: string): Promise<any | null>;
  createUser(userData: any): Promise<any>;
  // ... other methods
}

export interface ILogger {
  info(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  // ... other methods
}
```

### 2. Repository Implementations (`src/repositories/`)

Wrapper classes that implement repository interfaces:

```typescript
export class UserRepository implements IUserRepository {
  async findById<T>(id: string): Promise<T | null> {
    return User.findById<T>(id); // Delegates to existing model
  }
  // ... other methods
}
```

### 3. Dependency Container (`src/container/DependencyContainer.ts`)

Manages dependency creation and injection:

```typescript
export class DependencyContainer {
  private dependencies: IServiceDependencies;

  getDependencies(): IServiceDependencies {
    return this.dependencies;
  }

  setDependencies(dependencies: Partial<IServiceDependencies>): void {
    this.dependencies = { ...this.dependencies, ...dependencies };
  }
}
```

### 4. Service Factory (`src/services/ServiceFactory.ts`)

Provides convenient service creation with proper dependencies:

```typescript
export class ServiceFactory {
  createAuthService(dependencies?: Partial<IServiceDependencies>): AuthService {
    const deps = this.container.getDependencies();
    return new AuthService(
      dependencies?.userRepository || deps.userRepository,
      dependencies?.logger || deps.logger
    );
  }
}
```

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

// Direct instantiation
import { DependencyContainer } from '../container/DependencyContainer';

const container = DependencyContainer.getInstance();
const authService = new AuthService(
  container.getUserRepository(),
  container.getLogger()
);
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
    expect(mockUserRepository.createUser).toHaveBeenCalledWith(userData);
  });
});
```

## Benefits

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

## Migration Strategy

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
- [ ] Refactor other services as needed

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

## Examples

### AdminSystemService Refactoring Example

The AdminSystemService was successfully refactored from static methods to dependency injection:

**Before (Static Dependencies):**
```typescript
export class AdminSystemService {
  static async getSystemHealth(): Promise<ISystemHealthMetrics[]> {
    const knex = BaseModel.getKnex(); // Direct static dependency
    const healthChecks = await knex('system_health').select('*');
    // ...
  }
}
```

**After (Dependency Injection):**
```typescript
export class AdminSystemService {
  constructor(
    private systemRepository: ISystemRepository,
    private logger: ILogger
  ) {}

  async getSystemHealth(): Promise<ISystemHealthMetrics[]> {
    const healthChecks = await this.systemRepository.getSystemHealth(); // Injected dependency
    // ...
  }
}

// Factory function for easy instantiation
export const createAdminSystemService = (dependencies?: Partial<{ systemRepository: ISystemRepository; logger: ILogger }>) => {
  const container = DependencyContainer.getInstance();
  return new AdminSystemService(
    dependencies?.systemRepository || container.getSystemRepository(),
    dependencies?.logger || container.getLogger()
  );
};
```

**Benefits Achieved:**
- **Testability**: Can easily mock SystemRepository and Logger for unit tests
- **Separation of Concerns**: Business logic separated from data access
- **Flexibility**: Can swap repository implementations for different environments
- **Type Safety**: All dependencies are explicitly typed and validated

### Creating a New Service with DI

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

// 4. Add to dependency container
// Update IServiceDependencies interface and DependencyContainer

// 5. Create factory function
export const createProductService = (dependencies?: Partial<IServiceDependencies>) => {
  const container = DependencyContainer.getInstance();
  return new ProductService(
    dependencies?.productRepository || container.getProductRepository(),
    dependencies?.logger || container.getLogger()
  );
};
```

### Testing the New Service

```typescript
describe('ProductService', () => {
  let productService: ProductService;
  let mockProductRepository: jest.Mocked<IProductRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockProductRepository = {
      findById: jest.fn(),
      search: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    productService = new ProductService(mockProductRepository, mockLogger);
  });

  it('should get product by id', async () => {
    // Arrange
    const mockProduct = { id: 'prod-123', name: 'Test Product' };
    mockProductRepository.findById.mockResolvedValue(mockProduct);

    // Act
    const result = await productService.getProduct('prod-123');

    // Assert
    expect(result).toEqual(mockProduct);
    expect(mockProductRepository.findById).toHaveBeenCalledWith('prod-123');
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Product retrieved',
      { productId: 'prod-123' }
    );
  });
});
```

## Conclusion

The dependency injection system significantly improves the testability and maintainability of the BoosterBeacon backend. By making dependencies explicit and injectable, we can:

- Write better, more focused unit tests
- Easily swap implementations for different environments
- Maintain cleaner separation of concerns
- Enable better debugging and monitoring capabilities

The implementation maintains backward compatibility while providing a clear migration path for existing services.