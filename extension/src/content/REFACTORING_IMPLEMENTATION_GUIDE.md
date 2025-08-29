# Content Script Refactoring Implementation Guide

## Overview

This guide provides a step-by-step approach to refactor the current 905-line ContentScript class into a maintainable, testable, and performant architecture.

## Implementation Priority

### Phase 1: Critical Improvements (High Priority) 🔴
**Timeline: 1-2 days**

1. **Extract UI Management Class**
   - Move all UI-related methods to `UIManager`
   - Extract floating button, product UI, and notification logic
   - **Benefits**: Immediate reduction in ContentScript complexity, easier UI testing

2. **Extract Message Handler Class**
   - Move message handling logic to dedicated `MessageHandler`
   - Implement async message handling utilities
   - **Benefits**: Cleaner message routing, better error handling

### Phase 2: Architecture Improvements (Medium Priority) 🟡
**Timeline: 2-3 days**

3. **Implement Strategy Pattern for Retailers**
   - Create retailer-specific strategy classes
   - Replace switch statements with strategy pattern
   - **Benefits**: Easy to add new retailers, better testability

4. **Add DOM Caching System**
   - Implement `DOMCache` with automatic invalidation
   - Replace direct DOM queries with cached versions
   - **Benefits**: Significant performance improvement, reduced DOM thrashing

5. **Centralize Error Management**
   - Implement `ErrorManager` singleton
   - Add error reporting and user-friendly notifications
   - **Benefits**: Consistent error handling, better debugging

### Phase 3: Quality Improvements (Low Priority) 🟢
**Timeline: 1-2 days**

6. **Configuration Management**
   - Centralize all retailer configurations
   - Create `ConfigManager` for settings
   - **Benefits**: Easier maintenance, configuration validation

7. **Dependency Injection**
   - Add constructor injection for better testability
   - Create service interfaces
   - **Benefits**: Better unit testing, loose coupling

## Step-by-Step Migration

### Step 1: Extract UI Manager (Day 1)

```typescript
// 1. Create UIManager class
class UIManager {
  constructor(
    private retailer: { id: RetailerId; name: string } | null,
    private productDetector: ProductDetector | null,
    private onAddToWatchList: (product: Product) => Promise<void>,
    private onQuickBuy: (product: Product) => Promise<void>
  ) {}

  // Move these methods from ContentScript:
  // - injectFloatingButton()
  // - injectProductUI()
  // - showNotification()
  // - showQuickActions()
  // - findProductContainer()
  // - setupProductUIEvents()
}

// 2. Update ContentScript to use UIManager
class ContentScript {
  private uiManager: UIManager;
  
  constructor() {
    this.uiManager = new UIManager(
      this.retailer,
      this.productDetector,
      this.addProductToWatchList.bind(this),
      this.executeQuickBuy.bind(this)
    );
  }
  
  private injectUI(): void {
    this.uiManager.injectFloatingButton();
    if (this.productDetector?.isProductPage()) {
      const product = this.productDetector.detectProduct();
      if (product) {
        this.uiManager.injectProductUI(product);
      }
    }
  }
}
```

### Step 2: Extract Message Handler (Day 1)

```typescript
// 1. Create MessageHandler class
class MessageHandler {
  constructor(private serviceCoordinator: ServiceCoordinator) {}
  
  handleMessage(message: ExtensionMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void): boolean {
    // Move message handling logic here
  }
}

// 2. Update ContentScript
class ContentScript {
  private messageHandler: MessageHandler;
  
  constructor() {
    this.messageHandler = new MessageHandler(this.serviceCoordinator);
    chrome.runtime.onMessage.addListener(this.messageHandler.handleMessage.bind(this.messageHandler));
  }
}
```

### Step 3: Implement Strategy Pattern (Day 2)

```typescript
// 1. Create retailer strategies
const strategy = RetailerStrategyFactory.createStrategy(this.retailer.id);

// 2. Update ProductDetector to use strategy
class ProductDetector {
  constructor(private strategy: RetailerStrategy) {}
  
  detectProduct(): Product | null {
    return this.strategy.detectProduct();
  }
}

// 3. Update ContentScript
this.productDetector = new ProductDetector(
  RetailerStrategyFactory.createStrategy(this.retailer.id)
);
```

### Step 4: Add DOM Caching (Day 3)

```typescript
// 1. Create DOMCache instance
const domCache = new DOMCache(5000); // 5 second cache

// 2. Update ProductDetector to use cache
class ProductDetector {
  constructor(private strategy: RetailerStrategy, private domCache: DOMCache) {}
  
  isProductPage(): boolean {
    const selectors = this.strategy.getProductSelectors();
    return !!this.domCache.querySelector(selectors.title);
  }
}
```

### Step 5: Add Error Management (Day 4)

```typescript
// 1. Replace try-catch blocks with ErrorManager
try {
  await this.executeAddToCart(payload);
} catch (error) {
  ErrorManager.getInstance().handleError(
    error as Error,
    { component: 'ContentScript', method: 'executeAddToCart' },
    'medium',
    true
  );
}

// 2. Use error handling decorator
class ServiceCoordinator {
  @withErrorHandling
  async executeAddToCart(payload: any): Promise<MessageResponse> {
    // Implementation - errors automatically handled
  }
}
```

### Step 6: Add Configuration Management (Day 5)

```typescript
// 1. Replace hardcoded values with config
const config = ConfigManager.getInstance();
const selectors = config.getProductSelectors(this.retailer.id);
const delays = config.getRetailerDelays(this.retailer.id);

// 2. Use configuration for features
if (config.supportsAutomation(this.retailer.id)) {
  // Enable automation
} else {
  // Manual mode only
}
```

## Testing Strategy

### Unit Tests
```typescript
describe('UIManager', () => {
  let uiManager: UIManager;
  let mockProductDetector: jest.Mocked<ProductDetector>;
  
  beforeEach(() => {
    mockProductDetector = {
      detectProduct: jest.fn().mockReturnValue(mockProduct)
    } as any;
    
    uiManager = new UIManager(
      { id: 'bestbuy', name: 'Best Buy' },
      mockProductDetector,
      jest.fn(),
      jest.fn()
    );
  });
  
  it('should inject floating button', () => {
    uiManager.injectFloatingButton();
    expect(document.getElementById('booster-beacon-fab')).toBeTruthy();
  });
});
```

### Integration Tests
```typescript
describe('ContentScript Integration', () => {
  it('should handle product page detection and UI injection', async () => {
    // Mock retailer page
    document.body.innerHTML = '<h1 class="sku-title">Pokemon Cards</h1>';
    
    const contentScript = new ContentScript();
    await contentScript.initialize();
    
    expect(document.getElementById('booster-beacon-fab')).toBeTruthy();
    expect(document.getElementById('booster-beacon-product-ui')).toBeTruthy();
  });
});
```

## Performance Benchmarks

### Before Refactoring
- DOM queries per page load: ~50-100
- Memory usage: ~2-5MB
- Initialization time: ~200-500ms

### After Refactoring (Expected)
- DOM queries per page load: ~10-20 (with caching)
- Memory usage: ~1-3MB (with proper cleanup)
- Initialization time: ~100-200ms

## Rollback Plan

1. **Keep original file as backup**: `content.ts.backup`
2. **Feature flags**: Use configuration to enable/disable new components
3. **Gradual migration**: Implement one component at a time
4. **Monitoring**: Add performance metrics to track improvements

## Success Metrics

- [ ] Reduce ContentScript class from 905 lines to <200 lines
- [ ] Achieve 90%+ test coverage for all new components
- [ ] Improve DOM query performance by 50%+
- [ ] Reduce memory usage by 30%+
- [ ] Zero regression in existing functionality

## Risk Mitigation

1. **Scope Isolation**: Ensure all refactored code maintains IIFE isolation
2. **Backward Compatibility**: Maintain all existing message types and APIs
3. **Error Handling**: Ensure errors don't break the extension
4. **Performance**: Monitor for any performance regressions

## Next Steps

1. **Day 1**: Implement UIManager and MessageHandler extraction
2. **Day 2**: Add Strategy pattern for retailers
3. **Day 3**: Implement DOM caching system
4. **Day 4**: Add centralized error management
5. **Day 5**: Implement configuration management
6. **Day 6**: Add comprehensive tests
7. **Day 7**: Performance testing and optimization

This refactoring will transform the content script from a monolithic 905-line class into a well-structured, maintainable, and testable architecture while maintaining all existing functionality.