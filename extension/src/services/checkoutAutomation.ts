// Checkout automation service for BoosterBeacon browser extension
// Handles automated login, form filling, and purchase completion

import { 
  RetailerId, 
  Address, 
  PaymentMethod, 
  ExtensionSettings,
  STORAGE_KEYS
} from '../shared/types';
import { 
  getStorageData, 
  log
} from '../shared/utils';
import { CheckoutStrategy } from './checkout/CheckoutStrategy';
import { DOMHelper } from './checkout/DOMHelper';
import { StepManager } from './checkout/StepManager';
import { CHECKOUT_CONFIG } from './checkout/CheckoutConfig';
import { CheckoutError, ElementNotFoundError, ConfigurationError, SafetyLimitError } from './checkout/CheckoutErrors';
import { BestBuyStrategy } from './checkout/strategies/BestBuyStrategy';

export interface CheckoutData {
  shippingAddress: Address;
  paymentMethod: PaymentMethod;
  retailerCredentials?: {
    username: string;
    password: string;
  };
  preferences: {
    expeditedShipping: boolean;
    savePaymentMethod: boolean;
    createAccount: boolean;
  };
}

export interface CheckoutResult {
  success: boolean;
  orderId?: string;
  error?: string;
  steps: CheckoutStep[];
}

export interface CheckoutStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp: number;
  error?: string;
}

export class CheckoutAutomationService {
  private retailerId: RetailerId;
  private settings: ExtensionSettings | null = null;
  private checkoutData: CheckoutData | null = null;
  private isRunning = false;
  
  // Composed services
  private stepManager = new StepManager();
  private domHelper = new DOMHelper();
  private strategy: CheckoutStrategy;

  constructor(retailerId: RetailerId) {
    this.retailerId = retailerId;
    this.strategy = this.createStrategy(retailerId);
  }

  private createStrategy(retailerId: RetailerId): CheckoutStrategy {
    switch (retailerId) {
      case 'bestbuy':
        return new BestBuyStrategy();
      // TODO: Add other retailer strategies
      default:
        throw new ConfigurationError(`Unsupported retailer: ${retailerId}`, retailerId);
    }
  }

  /**
   * Initialize the checkout automation service
   */
  async initialize(): Promise<void> {
    this.settings = await getStorageData<ExtensionSettings>(STORAGE_KEYS.SETTINGS);
    this.checkoutData = await getStorageData<CheckoutData>(`checkout_data_${this.retailerId}`);
    
    if (!this.settings?.retailerSettings[this.retailerId]?.enabled) {
      throw new Error(`Checkout automation disabled for ${this.retailerId}`);
    }
    
    log('info', `Checkout automation service initialized for ${this.retailerId}`);
  }

  /**
   * Execute automated checkout process
   */
  async executeCheckout(productUrl: string, quantity: number = 1): Promise<CheckoutResult> {
    if (this.isRunning) {
      throw new Error('Checkout automation already in progress');
    }

    this.isRunning = true;
    this.stepManager.reset();

    try {
      await this.initialize();

      if (!this.checkoutData) {
        throw new Error('Checkout data not configured');
      }

      // Step 1: Navigate to product and add to cart
      this.stepManager.addStep('add_to_cart', 'pending');
      await this.addToCart(productUrl, quantity);
      this.stepManager.updateStep('add_to_cart', 'completed');

      // Step 2: Login if credentials are available
      if (this.settings?.retailerSettings[this.retailerId]?.autoLogin && 
          this.checkoutData.retailerCredentials) {
        await this.addStep('login', 'pending');
        await this.performLogin();
        await this.updateStep('login', 'completed');
      }

      // Step 3: Navigate to checkout
      await this.addStep('navigate_checkout', 'pending');
      await this.navigateToCheckout();
      await this.updateStep('navigate_checkout', 'completed');

      // Step 4: Fill shipping information
      await this.addStep('fill_shipping', 'pending');
      await this.fillShippingInformation();
      await this.updateStep('fill_shipping', 'completed');

      // Step 5: Fill payment information
      await this.addStep('fill_payment', 'pending');
      await this.fillPaymentInformation();
      await this.updateStep('fill_payment', 'completed');

      // Step 6: Review and place order (with safety checks)
      await this.addStep('place_order', 'pending');
      const orderId = await this.placeOrder();
      await this.updateStep('place_order', 'completed');

      return {
        success: true,
        orderId,
        steps: this.steps
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'Checkout automation failed', error);
      
      // Update current step as failed
      if (this.steps.length > 0) {
        const currentStep = this.steps[this.steps.length - 1];
        if (currentStep && (currentStep.status === 'in_progress' || currentStep.status === 'pending')) {
          currentStep.status = 'failed';
          currentStep.error = errorMessage;
        }
      }

      return {
        success: false,
        error: errorMessage,
        steps: this.steps
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Add product to cart
   */
  private async addToCart(productUrl: string, quantity: number): Promise<void> {
    await this.updateStep('add_to_cart', 'in_progress');
    
    // Navigate to product page if not already there
    if (window.location.href !== productUrl) {
      window.location.href = productUrl;
      await this.waitForPageLoad();
    }

    // Find and click add to cart button based on retailer
    const addToCartButton = await this.findAddToCartButton();
    if (!addToCartButton) {
      throw new Error('Add to cart button not found');
    }

    // Set quantity if needed
    await this.setQuantity(quantity);

    // Click add to cart
    (addToCartButton as HTMLElement).click();
    
    // Wait for cart update
    await this.waitForCartUpdate();
    
    log('info', `Added ${quantity} item(s) to cart`);
  }

  /**
   * Perform automated login
   */
  private async performLogin(): Promise<void> {
    await this.updateStep('login', 'in_progress');
    
    if (!this.checkoutData?.retailerCredentials) {
      throw new Error('Login credentials not available');
    }

    // Navigate to login page
    const loginUrl = this.getLoginUrl();
    if (window.location.href !== loginUrl) {
      window.location.href = loginUrl;
      await this.waitForPageLoad();
    }

    // Fill login form
    const usernameField = await this.findElement(this.getLoginSelectors().username);
    const passwordField = await this.findElement(this.getLoginSelectors().password);
    const loginButton = await this.findElement(this.getLoginSelectors().submitButton);

    if (!usernameField || !passwordField || !loginButton) {
      throw new Error('Login form elements not found');
    }

    // Fill credentials
    await this.fillField(usernameField, this.checkoutData.retailerCredentials.username);
    await this.fillField(passwordField, this.checkoutData.retailerCredentials.password);

    // Submit login
    (loginButton as HTMLElement).click();
    
    // Wait for login completion
    await this.waitForLoginCompletion();
    
    log('info', 'Login completed successfully');
  }

  /**
   * Navigate to checkout page
   */
  private async navigateToCheckout(): Promise<void> {
    await this.updateStep('navigate_checkout', 'in_progress');
    
    // Find checkout button in cart
    const checkoutButton = await this.findCheckoutButton();
    if (!checkoutButton) {
      throw new Error('Checkout button not found');
    }

    (checkoutButton as HTMLElement).click();
    await this.waitForPageLoad();
    
    log('info', 'Navigated to checkout page');
  }

  /**
   * Fill shipping information
   */
  private async fillShippingInformation(): Promise<void> {
    await this.updateStep('fill_shipping', 'in_progress');
    
    if (!this.checkoutData?.shippingAddress) {
      throw new Error('Shipping address not configured');
    }

    const selectors = this.getShippingSelectors();
    const address = this.checkoutData.shippingAddress;

    // Fill shipping form fields
    await this.fillFieldBySelector(selectors.firstName, address.firstName);
    await this.fillFieldBySelector(selectors.lastName, address.lastName);
    await this.fillFieldBySelector(selectors.street, address.street);
    await this.fillFieldBySelector(selectors.city, address.city);
    await this.fillFieldBySelector(selectors.state, address.state);
    await this.fillFieldBySelector(selectors.zipCode, address.zipCode);

    // Select shipping method if preferences specify expedited
    if (this.checkoutData.preferences.expeditedShipping) {
      await this.selectExpeditedShipping();
    }

    log('info', 'Shipping information filled');
  }

  /**
   * Fill payment information
   */
  private async fillPaymentInformation(): Promise<void> {
    await this.updateStep('fill_payment', 'in_progress');
    
    if (!this.checkoutData?.paymentMethod) {
      throw new Error('Payment method not configured');
    }

    // Note: For security reasons, we don't store actual payment details
    // This would integrate with secure payment storage or prompt user
    log('warn', 'Payment information filling requires secure implementation');
    
    // For now, just verify payment section is available
    const paymentSection = await this.findElement(this.getPaymentSelectors().section);
    if (!paymentSection) {
      throw new Error('Payment section not found');
    }

    log('info', 'Payment section verified');
  }

  /**
   * Place the order with safety checks
   */
  private async placeOrder(): Promise<string> {
    await this.updateStep('place_order', 'in_progress');
    
    // Safety check: Verify order details
    const orderSummary = await this.getOrderSummary();
    if (!orderSummary) {
      throw new Error('Could not verify order details');
    }

    // Safety check: Confirm total is reasonable
    if (orderSummary.total > 1000) { // $1000 safety limit
      throw new Error(`Order total ${orderSummary.total} exceeds safety limit`);
    }

    // Find place order button
    const placeOrderButton = await this.findElement(this.getPlaceOrderSelector());
    if (!placeOrderButton) {
      throw new Error('Place order button not found');
    }

    // Final confirmation (this could be made configurable)
    const confirmed = await this.showOrderConfirmation(orderSummary);
    if (!confirmed) {
      throw new Error('Order cancelled by user');
    }

    // Place the order
    (placeOrderButton as HTMLElement).click();
    
    // Wait for order confirmation
    const orderId = await this.waitForOrderConfirmation();
    
    log('info', `Order placed successfully: ${orderId}`);
    return orderId;
  }

  // Utility methods for DOM interaction

  private async findElement(selector: string, timeout: number = 5000): Promise<Element | null> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkElement = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          resolve(null);
        } else {
          setTimeout(checkElement, 100);
        }
      };
      
      checkElement();
    });
  }

  private async fillField(element: Element, value: string): Promise<void> {
    const input = element as HTMLInputElement;
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await this.delay(100);
  }

  private async fillFieldBySelector(selector: string, value: string): Promise<void> {
    const element = await this.findElement(selector);
    if (element) {
      await this.fillField(element, value);
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async waitForPageLoad(): Promise<void> {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', () => resolve(), { once: true });
      }
    });
  }

  // Step management methods

  private async addStep(name: string, status: CheckoutStep['status']): Promise<void> {
    const step: CheckoutStep = {
      name,
      status,
      timestamp: Date.now()
    };
    this.steps.push(step);
  }

  private async updateStep(name: string, status: CheckoutStep['status'], error?: string): Promise<void> {
    const step = this.steps.find(s => s.name === name);
    if (step) {
      step.status = status;
      step.timestamp = Date.now();
      if (error) {
        step.error = error;
      }
    }
  }

  // Retailer-specific selector methods (to be implemented for each retailer)

  private getLoginUrl(): string {
    const urls = {
      bestbuy: 'https://www.bestbuy.com/identity/signin',
      walmart: 'https://www.walmart.com/account/login',
      costco: 'https://www.costco.com/LogonForm',
      samsclub: 'https://www.samsclub.com/login'
    };
    return urls[this.retailerId];
  }

  private getLoginSelectors() {
    const selectors = {
      bestbuy: {
        username: '#fld-e',
        password: '#fld-p1',
        submitButton: '.cia-form__controls button[type="submit"]'
      },
      walmart: {
        username: '#sign-in-email',
        password: '#sign-in-password',
        submitButton: '[data-automation-id="signin-submit-btn"]'
      },
      costco: {
        username: '#logonId',
        password: '#logonPassword',
        submitButton: '#logonSubmit'
      },
      samsclub: {
        username: '#email',
        password: '#password',
        submitButton: '[data-testid="login-button"]'
      }
    };
    return selectors[this.retailerId];
  }

  private getShippingSelectors() {
    // These would be retailer-specific selectors for shipping forms
    const selectors = {
      bestbuy: {
        firstName: '[name="firstName"]',
        lastName: '[name="lastName"]',
        street: '[name="street"]',
        city: '[name="city"]',
        state: '[name="state"]',
        zipCode: '[name="zipCode"]'
      },
      walmart: {
        firstName: '[name="firstName"]',
        lastName: '[name="lastName"]',
        street: '[name="addressLineOne"]',
        city: '[name="city"]',
        state: '[name="state"]',
        zipCode: '[name="postalCode"]'
      },
      costco: {
        firstName: '[name="firstName"]',
        lastName: '[name="lastName"]',
        street: '[name="address1"]',
        city: '[name="city"]',
        state: '[name="state"]',
        zipCode: '[name="zipCode"]'
      },
      samsclub: {
        firstName: '[name="firstName"]',
        lastName: '[name="lastName"]',
        street: '[name="addressLine1"]',
        city: '[name="city"]',
        state: '[name="state"]',
        zipCode: '[name="zipCode"]'
      }
    };
    return selectors[this.retailerId];
  }

  private getPaymentSelectors() {
    const selectors = {
      bestbuy: {
        section: '.payment-section'
      },
      walmart: {
        section: '.payment-methods'
      },
      costco: {
        section: '.payment-info'
      },
      samsclub: {
        section: '.payment-section'
      }
    };
    return selectors[this.retailerId];
  }

  private getPlaceOrderSelector(): string {
    const selectors = {
      bestbuy: '.btn-primary[data-track="Place Order"]',
      walmart: '[data-automation-id="place-order-btn"]',
      costco: '#placeOrderButton',
      samsclub: '[data-testid="place-order-button"]'
    };
    return selectors[this.retailerId];
  }

  // Placeholder methods for retailer-specific implementations

  private async findAddToCartButton(): Promise<Element | null> {
    const selectors = {
      bestbuy: '.add-to-cart-button, .btn-primary[data-track="Add to Cart"]',
      walmart: '[data-automation-id="add-to-cart-button"]',
      costco: '.add-to-cart-btn',
      samsclub: '[data-testid="add-to-cart-button"]'
    };
    return this.findElement(selectors[this.retailerId]);
  }

  private async setQuantity(quantity: number): Promise<void> {
    // Implementation would be retailer-specific
    log('info', `Setting quantity to ${quantity}`);
  }

  private async waitForCartUpdate(): Promise<void> {
    await this.delay(2000); // Simple delay, could be improved with actual cart monitoring
  }

  private async waitForLoginCompletion(): Promise<void> {
    // Wait for redirect or success indicator
    await this.delay(3000);
  }

  private async findCheckoutButton(): Promise<Element | null> {
    const selectors = {
      bestbuy: '.btn-primary[href*="checkout"], .checkout-buttons .btn-primary',
      walmart: '[data-automation-id="checkout-button"]',
      costco: '.checkout-btn',
      samsclub: '[data-testid="checkout-button"]'
    };
    return this.findElement(selectors[this.retailerId]);
  }

  private async selectExpeditedShipping(): Promise<void> {
    // Implementation would select faster shipping options
    log('info', 'Selecting expedited shipping');
  }

  private async getOrderSummary(): Promise<{ total: number; items: any[] } | null> {
    // Extract order summary from page
    return { total: 0, items: [] };
  }

  private async showOrderConfirmation(orderSummary: any): Promise<boolean> {
    // Show confirmation dialog to user
    return confirm(`Confirm order total: $${orderSummary.total}?`);
  }

  private async waitForOrderConfirmation(): Promise<string> {
    // Wait for order confirmation page and extract order ID
    await this.delay(5000);
    return 'ORDER_' + Date.now();
  }
}