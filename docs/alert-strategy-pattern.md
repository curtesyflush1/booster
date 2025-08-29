# Alert Processing Strategy Pattern

## Overview

BoosterBeacon implements a comprehensive strategy pattern for alert processing that enables extensible, maintainable, and type-safe handling of different alert types. This architectural pattern separates alert processing logic into specialized strategies, making it easy to add new alert types and customize processing behavior.

## Architecture

### Strategy Interface

All alert processing strategies implement the `AlertProcessingStrategy` interface:

```typescript
export interface AlertProcessingStrategy {
  calculatePriority(alertData: AlertGenerationData): Promise<AlertPriority>;
  determineDeliveryChannels(user: IUser, alert: IAlert): string[];
  validateSpecificRequirements(alertData: AlertGenerationData): Promise<boolean>;
  getAlertType(): AlertType;
  calculateUrgencyScore(alertData: AlertGenerationData): Promise<number>;
}
```

### Base Strategy Class

The `BaseAlertStrategy` provides common functionality shared across all strategies:

```typescript
export abstract class BaseAlertStrategy implements AlertProcessingStrategy {
  protected static readonly POPULARITY_THRESHOLD_HIGH = 500;
  protected static readonly POPULARITY_THRESHOLD_URGENT = 800;

  abstract calculatePriority(alertData: AlertGenerationData): Promise<AlertPriority>;
  abstract getAlertType(): AlertType;
  abstract calculateUrgencyScore(alertData: AlertGenerationData): Promise<number>;

  determineDeliveryChannels(user: IUser, alert: IAlert): string[] {
    const channels: string[] = [];
    const settings = user.notification_settings;

    // Web push is always available
    if (settings.web_push) {
      channels.push('web_push');
    }

    // Email is available for all users
    if (settings.email) {
      channels.push('email');
    }

    // SMS and Discord are Pro features
    if (user.subscription_tier === 'pro') {
      if (settings.sms) {
        channels.push('sms');
      }
      if (settings.discord && settings.discord_webhook) {
        channels.push('discord');
      }
    }

    return channels;
  }

  async validateSpecificRequirements(alertData: AlertGenerationData): Promise<boolean> {
    // Basic URL validation
    if (alertData.data.product_url) {
      try {
        new URL(alertData.data.product_url);
      } catch {
        return false;
      }
    }

    // Basic required fields
    return !!(
      alertData.data.product_name?.trim() &&
      alertData.data.retailer_name?.trim() &&
      alertData.data.product_url?.trim()
    );
  }

  protected urgencyToPriority(urgencyScore: number): AlertPriority {
    if (urgencyScore >= 90) return 'urgent';
    if (urgencyScore >= 70) return 'high';
    if (urgencyScore >= 40) return 'medium';
    return 'low';
  }

  protected async getPopularityUrgency(productId: string): Promise<number> {
    try {
      const { Product } = await import('../../models/Product');
      const product = await Product.findById(productId);
      const popularityScore = product?.popularity_score || 0;

      if (popularityScore > BaseAlertStrategy.POPULARITY_THRESHOLD_URGENT) return 80;
      if (popularityScore > BaseAlertStrategy.POPULARITY_THRESHOLD_HIGH) return 60;
      return 30;
    } catch (error) {
      return 30; // Default fallback
    }
  }
}
```

## Strategy Implementations

### RestockAlertStrategy

Handles product restock notifications with urgency based on product popularity and stock levels:

```typescript
export class RestockAlertStrategy extends BaseAlertStrategy {
  getAlertType(): AlertType {
    return 'restock';
  }

  async calculateUrgencyScore(alertData: AlertGenerationData): Promise<number> {
    let urgencyScore = 0;

    // Base urgency from product popularity
    urgencyScore += await this.getPopularityUrgency(alertData.productId);

    // Boost for limited stock information
    if (alertData.data.stock_level && alertData.data.stock_level < 10) {
      urgencyScore += 20; // Low stock adds urgency
    }

    // Boost for high-demand retailers
    const highDemandRetailers = ['best-buy', 'walmart', 'costco'];
    if (highDemandRetailers.includes(alertData.retailerId)) {
      urgencyScore += 10;
    }

    // Time-based urgency (new releases are more urgent)
    if (alertData.data.is_new_release) {
      urgencyScore += 15;
    }

    return Math.min(urgencyScore, 100);
  }

  async validateSpecificRequirements(alertData: AlertGenerationData): Promise<boolean> {
    const baseValid = await super.validateSpecificRequirements(alertData);
    if (!baseValid) return false;

    // Restock-specific validation
    if (alertData.data.stock_level !== undefined) {
      return typeof alertData.data.stock_level === 'number' && alertData.data.stock_level >= 0;
    }

    return true;
  }
}
```

### PriceDropAlertStrategy

Handles price drop notifications with urgency based on discount percentage and price thresholds:

```typescript
export class PriceDropAlertStrategy extends BaseAlertStrategy {
  private static readonly SIGNIFICANT_DROP_THRESHOLD = 20; // 20% price drop
  private static readonly MAJOR_DROP_THRESHOLD = 40; // 40% price drop

  getAlertType(): AlertType {
    return 'price_drop';
  }

  async calculateUrgencyScore(alertData: AlertGenerationData): Promise<number> {
    let urgencyScore = 0;

    // Base urgency from product popularity
    urgencyScore += await this.getPopularityUrgency(alertData.productId);

    // Calculate price drop percentage
    const dropPercentage = this.calculatePriceDropPercentage(alertData);
    
    if (dropPercentage >= PriceDropAlertStrategy.MAJOR_DROP_THRESHOLD) {
      urgencyScore += 40; // Major price drop
    } else if (dropPercentage >= PriceDropAlertStrategy.SIGNIFICANT_DROP_THRESHOLD) {
      urgencyScore += 25; // Significant price drop
    } else if (dropPercentage >= 10) {
      urgencyScore += 15; // Moderate price drop
    }

    // Boost for historically high-priced items
    if (alertData.data.original_price && alertData.data.original_price > 100) {
      urgencyScore += 10;
    }

    // Boost for limited-time sales
    if (alertData.data.is_limited_time) {
      urgencyScore += 15;
    }

    return Math.min(urgencyScore, 100);
  }

  async validateSpecificRequirements(alertData: AlertGenerationData): Promise<boolean> {
    const baseValid = await super.validateSpecificRequirements(alertData);
    if (!baseValid) return false;

    // Price drop specific validation
    const { price, original_price } = alertData.data;

    // Must have both current and original price
    if (typeof price !== 'number' || typeof original_price !== 'number') {
      return false;
    }

    // Current price must be less than original price
    if (price >= original_price) {
      return false;
    }

    // Prices must be positive
    return price > 0 && original_price > 0;
  }

  private calculatePriceDropPercentage(alertData: AlertGenerationData): number {
    const { price, original_price } = alertData.data;
    
    if (!price || !original_price || original_price <= 0) {
      return 0;
    }

    return ((original_price - price) / original_price) * 100;
  }
}
```

## Strategy Factory

The `AlertProcessorFactory` manages strategy instances and provides type-safe access:

```typescript
export class AlertProcessorFactory {
  private static strategies: Map<AlertType, AlertProcessingStrategy> = new Map();

  static initialize(): void {
    this.strategies.set('restock', new RestockAlertStrategy());
    this.strategies.set('price_drop', new PriceDropAlertStrategy());
    // Add more strategies as needed
  }

  static getProcessor(type: AlertType): AlertProcessingStrategy {
    if (this.strategies.size === 0) {
      this.initialize();
    }

    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new Error(`No strategy found for alert type: ${type}`);
    }

    return strategy;
  }

  static registerStrategy(type: AlertType, strategy: AlertProcessingStrategy): void {
    this.strategies.set(type, strategy);
  }

  static getAvailableTypes(): AlertType[] {
    if (this.strategies.size === 0) {
      this.initialize();
    }
    return Array.from(this.strategies.keys());
  }
}
```

## Integration with Alert Processing Service

The strategy pattern integrates seamlessly with the main alert processing service:

```typescript
export class AlertProcessingService {
  static async generateAlert(alertData: AlertGenerationData): Promise<AlertProcessingResult> {
    try {
      // Use strategy pattern to determine priority
      const strategy = AlertProcessorFactory.getProcessor(alertData.type);
      const priority = alertData.priority || await strategy.calculatePriority(alertData);

      // Create the alert with calculated priority
      const alert = await Alert.createAlert({
        user_id: alertData.userId,
        product_id: alertData.productId,
        retailer_id: alertData.retailerId,
        type: alertData.type,
        priority,
        data: alertData.data,
        status: 'pending'
      });

      // Process the alert using strategy-determined channels
      const processingResult = await this.processAlert(alert.id);
      
      return {
        alertId: alert.id,
        status: processingResult.success ? 'processed' : 'failed',
        deliveryChannels: processingResult.deliveryChannels
      };
    } catch (error) {
      logger.error('Failed to generate alert', error, { alertData });
      throw error;
    }
  }

  static async processAlert(alertId: string): Promise<AlertProcessResult> {
    const alert = await Alert.findById<IAlert>(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    const user = await CachedUserService.getUserWithPreferences(alert.user_id);
    if (!user) {
      await Alert.markAsFailed(alertId, 'User not found');
      return { success: false, reason: 'User not found' };
    }

    // Use strategy pattern to determine delivery channels
    const strategy = AlertProcessorFactory.getProcessor(alert.type as any);
    const deliveryChannels = strategy.determineDeliveryChannels(user, alert);

    if (deliveryChannels.length === 0) {
      await Alert.markAsFailed(alertId, 'No delivery channels available');
      return { success: false, reason: 'No delivery channels available' };
    }

    // Deliver the alert
    const deliveryResult = await AlertDeliveryService.deliverAlert(alert, user, deliveryChannels);
    
    if (deliveryResult.success) {
      await Alert.markAsSent(alertId, deliveryResult.successfulChannels);
      return {
        success: true,
        deliveryChannels: deliveryResult.successfulChannels
      };
    } else {
      await Alert.markAsFailed(alertId, deliveryResult.error || 'Delivery failed');
      return {
        success: false,
        reason: deliveryResult.error || 'Delivery failed'
      };
    }
  }
}
```

## Key Features

### 1. Extensibility
- **Easy Strategy Addition**: New alert types can be added by implementing the strategy interface
- **Plugin Architecture**: Strategies can be registered dynamically at runtime
- **Type Safety**: Full TypeScript support with compile-time type checking
- **Factory Management**: Centralized strategy management and instantiation

### 2. Customizable Processing
- **Priority Calculation**: Each strategy implements custom priority logic
- **Delivery Channel Selection**: Strategy-specific channel determination
- **Validation Rules**: Custom validation for each alert type
- **Urgency Scoring**: Sophisticated urgency calculation algorithms

### 3. Performance Optimization
- **Strategy Caching**: Strategies are instantiated once and reused
- **Efficient Processing**: Optimized algorithms for priority and urgency calculation
- **Parallel Processing**: Strategies can be processed in parallel for bulk operations
- **Resource Management**: Proper cleanup and resource management

### 4. Comprehensive Testing
- **Strategy Isolation**: Each strategy can be tested independently
- **Mock Support**: Easy mocking for unit testing
- **Integration Testing**: End-to-end testing with real alert data
- **Performance Testing**: Load testing for strategy performance

## Alert Types and Priorities

### Supported Alert Types
- **`restock`**: Product becomes available after being out of stock
- **`price_drop`**: Product price decreases below threshold
- **`low_stock`**: Product stock level drops below threshold
- **`pre_order`**: Product becomes available for pre-order

### Priority Levels
- **`urgent`**: Requires immediate attention (90+ urgency score)
- **`high`**: High priority processing (70-89 urgency score)
- **`medium`**: Standard priority processing (40-69 urgency score)
- **`low`**: Low priority processing (0-39 urgency score)

### Urgency Factors
- **Product Popularity**: Based on historical demand and user interest
- **Price Thresholds**: Significant price drops increase urgency
- **Stock Levels**: Low stock increases urgency for restock alerts
- **Retailer Demand**: High-demand retailers get priority
- **Time Sensitivity**: New releases and limited-time offers
- **User Preferences**: Pro users get higher priority processing

## Usage Examples

### Creating a New Strategy

```typescript
export class LowStockAlertStrategy extends BaseAlertStrategy {
  getAlertType(): AlertType {
    return 'low_stock';
  }

  async calculateUrgencyScore(alertData: AlertGenerationData): Promise<number> {
    let urgencyScore = 0;

    // Base urgency from product popularity
    urgencyScore += await this.getPopularityUrgency(alertData.productId);

    // Critical urgency for very low stock
    if (alertData.data.stock_level && alertData.data.stock_level <= 3) {
      urgencyScore += 50; // Critical stock level
    } else if (alertData.data.stock_level && alertData.data.stock_level <= 10) {
      urgencyScore += 30; // Low stock level
    }

    // Boost for high-value items
    if (alertData.data.price && alertData.data.price > 200) {
      urgencyScore += 15;
    }

    return Math.min(urgencyScore, 100);
  }

  async validateSpecificRequirements(alertData: AlertGenerationData): Promise<boolean> {
    const baseValid = await super.validateSpecificRequirements(alertData);
    if (!baseValid) return false;

    // Must have stock level information
    return typeof alertData.data.stock_level === 'number' && alertData.data.stock_level >= 0;
  }
}

// Register the new strategy
AlertProcessorFactory.registerStrategy('low_stock', new LowStockAlertStrategy());
```

### Testing Strategies

```typescript
describe('PriceDropAlertStrategy', () => {
  let strategy: PriceDropAlertStrategy;

  beforeEach(() => {
    strategy = new PriceDropAlertStrategy();
  });

  it('should calculate high urgency for major price drops', async () => {
    const alertData: AlertGenerationData = {
      userId: 'user-123',
      productId: 'product-456',
      retailerId: 'best-buy',
      type: 'price_drop',
      data: {
        product_name: 'Test Product',
        retailer_name: 'Best Buy',
        product_url: 'https://example.com/product',
        price: 60,
        original_price: 100
      }
    };

    const urgencyScore = await strategy.calculateUrgencyScore(alertData);
    expect(urgencyScore).toBeGreaterThan(50); // 40% drop should be high urgency
  });

  it('should validate price drop requirements', async () => {
    const validData: AlertGenerationData = {
      userId: 'user-123',
      productId: 'product-456',
      retailerId: 'walmart',
      type: 'price_drop',
      data: {
        product_name: 'Test Product',
        retailer_name: 'Walmart',
        product_url: 'https://example.com/product',
        price: 80,
        original_price: 100
      }
    };

    const isValid = await strategy.validateSpecificRequirements(validData);
    expect(isValid).toBe(true);
  });

  it('should reject invalid price data', async () => {
    const invalidData: AlertGenerationData = {
      userId: 'user-123',
      productId: 'product-456',
      retailerId: 'walmart',
      type: 'price_drop',
      data: {
        product_name: 'Test Product',
        retailer_name: 'Walmart',
        product_url: 'https://example.com/product',
        price: 100, // Price higher than original
        original_price: 80
      }
    };

    const isValid = await strategy.validateSpecificRequirements(invalidData);
    expect(isValid).toBe(false);
  });
});
```

## Best Practices

### Strategy Design
1. **Single Responsibility**: Each strategy handles one alert type
2. **Consistent Interface**: All strategies implement the same interface
3. **Validation First**: Always validate input data before processing
4. **Error Handling**: Comprehensive error handling with fallbacks
5. **Performance**: Optimize urgency calculations for speed

### Testing
1. **Unit Testing**: Test each strategy in isolation
2. **Integration Testing**: Test strategy integration with alert processing
3. **Performance Testing**: Verify strategy performance under load
4. **Edge Cases**: Test boundary conditions and error scenarios

### Maintenance
1. **Documentation**: Document strategy logic and urgency factors
2. **Monitoring**: Track strategy performance and success rates
3. **Versioning**: Version strategies for backward compatibility
4. **Metrics**: Collect metrics on strategy effectiveness

## Future Enhancements

### Planned Features
1. **Machine Learning Integration**: AI-powered urgency calculation
2. **Dynamic Thresholds**: Adaptive thresholds based on user behavior
3. **A/B Testing**: Strategy performance comparison and optimization
4. **Custom Strategies**: User-defined custom alert processing strategies

### Advanced Patterns
1. **Strategy Composition**: Combining multiple strategies for complex alerts
2. **Strategy Chains**: Sequential processing through multiple strategies
3. **Conditional Strategies**: Dynamic strategy selection based on context
4. **Strategy Decorators**: Cross-cutting concerns like caching and logging

## Related Documentation

- [Alert System Architecture](alert-system.md) - Overall alert system design
- [Repository Pattern](repository-pattern.md) - Data access layer integration
- [Caching System](caching-system.md) - Performance optimization with caching
- [Enhanced Logging](enhanced-logging.md) - Logging patterns in strategies
- [Type Safety System](type-safety.md) - Type validation and safety

## Conclusion

The alert processing strategy pattern provides a flexible, extensible, and maintainable approach to handling different types of alerts in BoosterBeacon. By separating alert processing logic into specialized strategies, the system achieves better code organization, easier testing, and simplified maintenance.

Key benefits include:
- **Extensibility**: Easy addition of new alert types
- **Maintainability**: Clear separation of concerns
- **Type Safety**: Full TypeScript support with compile-time checking
- **Performance**: Optimized processing algorithms
- **Testability**: Isolated testing of individual strategies
- **Flexibility**: Customizable processing logic per alert type