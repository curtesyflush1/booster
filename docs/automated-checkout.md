# Automated Checkout System

The BoosterBeacon browser extension includes a comprehensive automated checkout system that enables end-to-end purchase automation for Pokémon TCG products across multiple retailers. This system prioritizes security, user safety, and retailer compliance while providing a seamless checkout experience.

## Overview

The automated checkout system consists of several interconnected services that work together to provide a complete purchase automation solution:

- **CheckoutAutomationService**: Main orchestration service for end-to-end checkout flows
- **CredentialManager**: Secure storage and management of retailer login credentials
- **FormAutofillService**: Intelligent form detection and auto-fill functionality
- **CartManager**: Cart state management and product addition automation
- **PurchaseTracker**: Order confirmation detection and purchase analytics

## Architecture

### Service Architecture

```
CheckoutAutomationService (Main Orchestrator)
├── CredentialManager (Secure credential storage)
├── FormAutofillService (Form auto-fill)
├── CartManager (Cart operations)
├── PurchaseTracker (Order tracking)
└── Retailer Strategies
    ├── BestBuyStrategy
    ├── WalmartStrategy (planned)
    ├── CostcoStrategy (planned)
    └── SamsClubStrategy (planned)
```

### Data Flow

1. **Product Detection**: Content script detects Pokémon TCG products on retailer sites
2. **User Action**: User clicks "Quick Buy" or automation is triggered by alert
3. **Credential Retrieval**: Secure retrieval of retailer credentials if needed
4. **Cart Addition**: Automatic product addition to cart with quantity selection
5. **Login Process**: Automated login using stored credentials (if required)
6. **Checkout Navigation**: Navigation to checkout page with cart verification
7. **Form Auto-fill**: Intelligent filling of shipping and billing information
8. **Order Review**: Safety checks and user confirmation for high-value orders
9. **Order Placement**: Final order submission with error handling
10. **Purchase Tracking**: Order confirmation detection and analytics recording

## Security Features

### Credential Management

#### Encryption
- **Algorithm**: AES-GCM encryption using Web Crypto API
- **Key Generation**: Cryptographically secure random key generation
- **Key Storage**: Unique encryption keys per user stored in extension storage
- **Data Protection**: All sensitive credentials encrypted before storage

#### Security Measures
- **No Plaintext Storage**: Credentials never stored in plaintext
- **Secure Key Derivation**: Keys derived from cryptographically secure random sources
- **Automatic Key Rotation**: Support for key rotation and credential updates
- **Secure Deletion**: Proper cleanup of sensitive data from memory

### Data Privacy

#### What We Store
- **Encrypted Credentials**: Retailer usernames and encrypted passwords
- **Shipping Addresses**: User-provided shipping and billing addresses
- **Purchase History**: Order confirmations and purchase analytics (local only)
- **User Preferences**: Automation settings and safety configurations

#### What We Don't Store
- **Credit Card Numbers**: No payment card data is ever stored
- **CVV Codes**: Security codes are never captured or stored
- **Bank Information**: No banking or financial account details
- **Personal Documents**: No identification or personal documents

### Safety Controls

#### Order Value Limits
- **Default Limit**: $1000 maximum order value without confirmation
- **User Configurable**: Users can set custom limits or disable limits
- **High-Value Confirmation**: Required user confirmation for orders exceeding limits
- **Emergency Stop**: Immediate automation disable functionality

#### User Confirmation
- **Order Summary**: Detailed order review before final submission
- **Price Verification**: Real-time price and total verification
- **User Approval**: Explicit user approval required for order placement
- **Cancel Option**: Easy cancellation at any step of the process

## Retailer Support

### Best Buy

#### Features
- **Official API Integration**: Uses Best Buy's official product and cart APIs
- **SKU-based Detection**: Accurate product identification using SKU numbers
- **Price Monitoring**: Real-time price and availability tracking
- **Cart Integration**: Official add-to-cart API with quantity selection
- **Member Benefits**: Support for Best Buy membership benefits and pricing

#### Implementation
```typescript
class BestBuyStrategy implements CheckoutStrategy {
  getLoginUrl(): string {
    return 'https://www.bestbuy.com/identity/signin';
  }
  
  getLoginSelectors(): LoginSelectors {
    return {
      username: '#fld-e',
      password: '#fld-p1',
      submitButton: '.cia-form__controls button[type="submit"]'
    };
  }
  
  async findAddToCartButton(): Promise<Element | null> {
    const selectors = [
      '.add-to-cart-button',
      '.btn-primary[data-track="Add to Cart"]'
    ];
    
    for (const selector of selectors) {
      const element = await this.domHelper.findElement(selector, 2000);
      if (element) return element;
    }
    
    return null;
  }
}
```

### Walmart

#### Features
- **Affiliate Integration**: Uses Walmart affiliate APIs where available
- **Product Detection**: Advanced product title and price parsing
- **Cart Management**: Add-to-cart functionality with option selection
- **Shipping Options**: Support for various shipping methods and speeds
- **Pickup Options**: Store pickup and curbside delivery support

### Costco

#### Features
- **Member Authentication**: Secure Costco membership login
- **Bulk Pricing**: Support for Costco's bulk pricing and quantities
- **Member Benefits**: Integration with Costco member-specific pricing
- **Warehouse Pickup**: Support for warehouse pickup options
- **Executive Benefits**: Executive member rebate and benefit tracking

### Sam's Club

#### Features
- **Club Member Login**: Secure Sam's Club membership authentication
- **Plus Member Benefits**: Support for Plus member pricing and benefits
- **Bulk Quantities**: Handling of bulk product quantities and pricing
- **Curbside Pickup**: Integration with Sam's Club curbside pickup
- **Scan & Go**: Support for Scan & Go mobile checkout integration

## Form Auto-fill System

### Intelligent Form Detection

#### Retailer-Specific Selectors
```typescript
private getRetailerSelectors() {
  const selectors = {
    bestbuy: {
      shipping: {
        firstName: '[name="firstName"], #firstName',
        lastName: '[name="lastName"], #lastName',
        street: '[name="street"], #street',
        city: '[name="city"], #city',
        state: '[name="state"], #state',
        zipCode: '[name="zipCode"], #zipCode'
      }
    },
    walmart: {
      shipping: {
        firstName: '[name="firstName"], [data-testid="firstName"]',
        lastName: '[name="lastName"], [data-testid="lastName"]',
        street: '[name="addressLineOne"], [data-testid="addressLineOne"]'
      }
    }
  };
  return selectors[this.retailerId];
}
```

#### Fallback Detection
- **Multiple Selectors**: Each field has multiple selector options for reliability
- **Dynamic Detection**: Real-time form structure analysis for layout changes
- **Fuzzy Matching**: Intelligent field matching based on labels and attributes
- **Error Recovery**: Graceful handling of missing or changed form elements

### Human-like Interaction

#### Typing Simulation
```typescript
private async fillTextInput(input: HTMLInputElement, value: string): Promise<boolean> {
  input.focus();
  input.value = '';
  
  // Type character by character to simulate human input
  for (const char of value) {
    input.value += char;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await this.delay(50); // Small delay between characters
  }
  
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.blur();
  
  return true;
}
```

#### Event Handling
- **Focus Events**: Proper focus and blur events for form validation
- **Input Events**: Real-time input events for dynamic form validation
- **Change Events**: Form change events for state updates
- **Keyboard Events**: Simulated keyboard events for accessibility compliance

## Cart Management

### Automatic Cart Operations

#### Product Addition
```typescript
async addToCart(product: Product, quantity: number = 1): Promise<AddToCartResult> {
  try {
    // Navigate to product page if needed
    if (!this.isProductPage(product)) {
      await this.navigateToProduct(product);
    }

    // Wait for page load and set quantity
    await this.waitForPageLoad();
    if (quantity > 1) {
      await this.setQuantity(quantity);
    }

    // Find and click add to cart button
    const addToCartButton = await this.findAddToCartButton();
    if (!addToCartButton) {
      throw new Error('Add to cart button not found');
    }

    // Check stock availability
    if (!await this.isProductInStock()) {
      throw new Error('Product is out of stock');
    }

    // Add to cart and verify
    await this.clickAddToCartButton(addToCartButton);
    await this.waitForCartUpdate();
    
    const cartItem = await this.verifyItemAdded(product, quantity);
    if (!cartItem) {
      throw new Error('Failed to verify item was added to cart');
    }

    return { success: true, cartItem };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

#### Cart State Management
- **Real-time Monitoring**: Continuous monitoring of cart contents and totals
- **State Synchronization**: Sync between extension storage and retailer cart
- **Multi-product Support**: Handling of multiple products in single cart
- **Error Recovery**: Automatic retry for failed cart operations

### Stock Availability Checking

#### Availability Detection
```typescript
private async isProductInStock(): Promise<boolean> {
  const stockSelectors = this.getStockSelectors();
  
  // Check for out of stock indicators
  for (const selector of stockSelectors.outOfStock) {
    if (document.querySelector(selector)) {
      return false;
    }
  }
  
  // Check for in stock indicators
  for (const selector of stockSelectors.inStock) {
    if (document.querySelector(selector)) {
      return true;
    }
  }
  
  // Default to checking if add to cart button exists
  return !!(await this.findAddToCartButton());
}
```

## Purchase Tracking

### Order Confirmation Detection

#### Confirmation Page Detection
```typescript
private isConfirmationPage(): boolean {
  const confirmationSelectors = this.getConfirmationPageSelectors();
  
  for (const selector of confirmationSelectors) {
    if (document.querySelector(selector)) {
      return true;
    }
  }

  // Also check URL patterns
  const confirmationUrlPatterns = this.getConfirmationUrlPatterns();
  const currentUrl = window.location.href.toLowerCase();
  
  return confirmationUrlPatterns.some(pattern => currentUrl.includes(pattern));
}
```

#### Order Information Extraction
```typescript
private async extractOrderInfo(): Promise<{
  orderId: string;
  items: PurchaseItem[];
  totalAmount: number;
} | null> {
  try {
    const selectors = this.getOrderInfoSelectors();
    
    // Extract order ID
    const orderIdElement = document.querySelector(selectors.orderId);
    const orderId = orderIdElement?.textContent?.trim();
    
    // Extract total amount
    const totalElement = document.querySelector(selectors.total);
    const totalAmount = this.extractPrice(totalElement?.textContent || '');
    
    // Extract order items
    const items = await this.extractOrderItems();

    return { orderId, items, totalAmount };
  } catch (error) {
    return null;
  }
}
```

### Analytics and Reporting

#### Purchase Analytics
```typescript
interface PurchaseAnalytics {
  totalPurchases: number;
  totalSpent: number;
  averageOrderValue: number;
  successfulAlerts: number;
  automatedPurchases: number;
  retailerBreakdown: { [key in RetailerId]?: number };
  monthlySpending: { [month: string]: number };
}
```

#### Performance Metrics
- **Checkout Success Rate**: Percentage of successful automated checkouts
- **Average Checkout Time**: Time from cart to order confirmation
- **Error Rate by Step**: Detailed breakdown of where failures occur
- **Retailer Performance**: Success rates and timing by retailer

## Error Handling and Recovery

### Error Classification

#### Transient Errors
- **Network Timeouts**: Temporary network connectivity issues
- **Page Load Delays**: Slow page loading or element rendering
- **Rate Limiting**: Temporary rate limit responses from retailers
- **Server Errors**: Temporary server-side issues (5xx responses)

#### Permanent Errors
- **Invalid Credentials**: Incorrect or expired login credentials
- **Out of Stock**: Product no longer available for purchase
- **Payment Issues**: Payment method declined or invalid
- **Account Issues**: Account suspended or restricted

### Recovery Strategies

#### Retry Logic
```typescript
private async executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries && this.isRetryableError(error)) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        await this.delay(delay);
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}
```

#### Circuit Breaker Pattern
- **Failure Threshold**: Open circuit after consecutive failures
- **Recovery Timeout**: Automatic recovery attempts after timeout
- **Health Monitoring**: Continuous monitoring of service health
- **Graceful Degradation**: Fallback to manual checkout when needed

## Testing

### Test Coverage

#### Unit Tests
- **Service Logic**: Individual service functionality and edge cases
- **Utility Functions**: Helper functions and data processing
- **Error Handling**: Error scenarios and recovery logic
- **Security Functions**: Encryption and credential management

#### Integration Tests
```typescript
describe('Complete Automated Checkout Flow', () => {
  it('should execute full checkout flow successfully', async () => {
    // Mock DOM elements for successful flow
    const mockElements = setupMockElements();
    
    // Execute checkout
    const result = await checkoutAutomation.executeCheckout(
      'https://www.bestbuy.com/site/test-product/123456.p',
      1
    );

    expect(result.success).toBe(true);
    expect(result.orderId).toBeDefined();
    expect(result.steps).toHaveLength(6);
    
    // Verify all steps completed successfully
    result.steps.forEach(step => {
      expect(step.status).toBe('completed');
    });
  });
});
```

#### Mock Services
- **Retailer Responses**: Simulated retailer API and page responses
- **DOM Elements**: Mock DOM structures for different retailers
- **Network Conditions**: Simulated network delays and failures
- **User Interactions**: Automated user action simulation

### Test Scenarios

#### Happy Path Testing
- **Complete Checkout Flow**: End-to-end successful purchase
- **Multi-product Cart**: Multiple items in single checkout
- **Different Retailers**: Cross-retailer functionality testing
- **Various Product Types**: Different Pokémon TCG product categories

#### Error Scenario Testing
- **Network Failures**: Connection timeouts and network errors
- **Invalid Credentials**: Expired or incorrect login credentials
- **Out of Stock**: Product availability changes during checkout
- **Payment Failures**: Payment method issues and declines
- **Form Changes**: Retailer form structure modifications

#### Security Testing
- **Credential Encryption**: Encryption and decryption functionality
- **Data Sanitization**: Input validation and sanitization
- **XSS Prevention**: Cross-site scripting attack prevention
- **CSRF Protection**: Cross-site request forgery protection

## Configuration

### User Configuration

#### Safety Settings
```typescript
interface SafetySettings {
  maxOrderValue: number;          // Maximum order value without confirmation
  requireConfirmation: boolean;   // Always require user confirmation
  enableAutomation: boolean;      // Global automation enable/disable
  retailerSettings: {             // Per-retailer settings
    [retailerId: string]: {
      enabled: boolean;
      autoLogin: boolean;
      autoFill: boolean;
      maxOrderValue?: number;
    };
  };
}
```

#### Auto-fill Configuration
```typescript
interface AutofillData {
  shippingAddress: Address;
  billingAddress?: Address;
  contactInfo: {
    email: string;
    phone: string;
  };
  preferences: {
    savePaymentMethod: boolean;
    createAccount: boolean;
    subscribeToNewsletter: boolean;
  };
}
```

### System Configuration

#### Timeout Settings
- **Page Load Timeout**: Maximum time to wait for page loads (30 seconds)
- **Element Wait Timeout**: Maximum time to wait for elements (5 seconds)
- **Form Fill Timeout**: Maximum time for form filling operations (10 seconds)
- **Checkout Timeout**: Maximum time for complete checkout (5 minutes)

#### Retry Configuration
- **Max Retries**: Maximum number of retry attempts (3)
- **Base Delay**: Initial delay between retries (1 second)
- **Backoff Multiplier**: Exponential backoff multiplier (2x)
- **Max Delay**: Maximum delay between retries (30 seconds)

## Compliance and Ethics

### Retailer Terms of Service

#### Compliance Measures
- **Official APIs First**: Preference for official APIs over web scraping
- **Rate Limiting**: Respectful request rates to avoid overloading servers
- **User Agent Identification**: Honest identification in HTTP headers
- **Robots.txt Respect**: Adherence to robots.txt directives where applicable

#### Ethical Automation
- **No Scalping**: Designed for individual collectors, not resellers
- **Fair Access**: Doesn't provide unfair advantage over other customers
- **Transparent Operation**: Clear disclosure of automation to users
- **User Control**: Users maintain full control over automation decisions

### Privacy Compliance

#### Data Minimization
- **Necessary Data Only**: Only collect data required for functionality
- **Local Processing**: Process data locally when possible
- **Secure Transmission**: Encrypt all data transmission
- **User Consent**: Clear opt-in for all data collection and processing

#### User Rights
- **Data Access**: Users can view all stored data
- **Data Export**: Users can export their data
- **Data Deletion**: Users can delete all stored data
- **Opt-out**: Users can disable all automation and data collection

## Deployment and Monitoring

### Deployment Process

#### Extension Updates
- **Automatic Updates**: Browser extension auto-update mechanism
- **Gradual Rollout**: Phased deployment to detect issues early
- **Rollback Capability**: Quick rollback for critical issues
- **Version Compatibility**: Backward compatibility with older versions

#### Configuration Updates
- **Remote Configuration**: Update selectors and settings without extension updates
- **A/B Testing**: Test different configurations with user subsets
- **Emergency Disable**: Remote disable capability for critical issues
- **Performance Monitoring**: Real-time monitoring of automation success rates

### Monitoring and Analytics

#### Success Metrics
- **Checkout Success Rate**: Percentage of successful automated checkouts
- **Time to Completion**: Average time from start to order confirmation
- **Error Rate by Step**: Detailed breakdown of failure points
- **User Satisfaction**: User feedback and rating metrics

#### Performance Monitoring
- **Response Times**: API and page load response times
- **Memory Usage**: Extension memory consumption monitoring
- **CPU Usage**: Processing overhead measurement
- **Network Usage**: Data transfer and bandwidth monitoring

#### Error Tracking
- **Error Classification**: Categorization of errors by type and severity
- **Error Frequency**: Tracking of error occurrence rates
- **Recovery Success**: Success rate of error recovery attempts
- **User Impact**: Assessment of error impact on user experience

## Future Enhancements

### Planned Features

#### Machine Learning Integration
- **Purchase Prediction**: ML-powered purchase decision recommendations
- **Price Optimization**: Optimal timing for purchases based on price patterns
- **Success Rate Optimization**: ML-driven improvement of checkout success rates
- **Personalization**: Personalized automation based on user behavior

#### Advanced Automation
- **Multi-tab Coordination**: Coordinated checkout across multiple retailer tabs
- **Bulk Operations**: Mass purchase operations for multiple products
- **Scheduled Purchases**: Time-based automated purchasing
- **Conditional Logic**: Complex rule-based automation decisions

#### Enhanced Security
- **Biometric Authentication**: Fingerprint or face recognition for high-value orders
- **Hardware Security**: Integration with hardware security modules
- **Zero-knowledge Architecture**: Enhanced privacy with zero-knowledge proofs
- **Blockchain Integration**: Immutable purchase history and verification

### Long-term Vision

#### Ecosystem Integration
- **Mobile App Integration**: Seamless integration with mobile applications
- **Smart Home Integration**: Voice-activated purchase commands
- **Social Features**: Community-driven automation and sharing
- **Marketplace Integration**: Integration with secondary marketplaces

#### Advanced Analytics
- **Predictive Analytics**: Advanced prediction of product availability and pricing
- **Market Analysis**: Comprehensive market trend analysis and reporting
- **ROI Optimization**: Investment return optimization for collectors
- **Portfolio Management**: Complete collection portfolio management

---

**Made with ❤️ for Pokémon TCG collectors**

This automated checkout system represents a significant advancement in collector tools, providing secure, efficient, and ethical automation while maintaining user control and retailer compliance.
## Backend Orchestration (Scaffolded)

### End-to-End Flow
- A restock event generates an alert tied to a user/watch.
- If the watch has `auto_purchase.enabled` and constraints match (retailer, price cap), a job is enqueued.
- The prioritized queue dispatches to `PurchaseOrchestrator`, which calls a pluggable `BrowserApiService` to perform cart/purchase.
- Results are recorded in the `transactions` table for analytics and validation.

### Dev/Test Endpoints
- Simulate a restock alert:
  - `POST /api/admin/test-alert/restock`
  - Body: `{ userId, productId, retailerSlug, watchId?, price?, productUrl? }`
- Fetch recent transactions:
  - `GET /api/admin/purchases/transactions/recent?limit=50`

### Configuration
- Optional remote browser integration:
  - `BROWSER_API_URL`, `BROWSER_API_TOKEN`, `BROWSER_API_TIMEOUT_MS`

Note: When Browser API env vars are not set, the service simulates outcomes for development.
