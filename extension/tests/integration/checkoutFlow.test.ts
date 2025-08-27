// Integration tests for complete checkout flow

import { CheckoutAutomationService } from '../../src/services/checkoutAutomation';
import { CredentialManager } from '../../src/services/credentialManager';
import { FormAutofillService } from '../../src/services/formAutofill';
import { CartManager } from '../../src/services/cartManager';
import { PurchaseTracker } from '../../src/services/purchaseTracker';
import { RetailerId, Product } from '../../src/shared/types';

// Mock all utilities
jest.mock('../../src/shared/utils', () => ({
  getStorageData: jest.fn(),
  setStorageData: jest.fn(),
  removeStorageData: jest.fn(),
  sendExtensionMessage: jest.fn(),
  log: jest.fn(),
  debounce: jest.fn((fn) => fn),
  getCurrentRetailer: jest.fn(),
  generateId: jest.fn(() => 'mock-id')
}));

// Mock Web Crypto API
const mockCrypto = {
  getRandomValues: jest.fn((arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
  subtle: {
    importKey: jest.fn().mockResolvedValue('mock-crypto-key'),
    encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    decrypt: jest.fn().mockResolvedValue(new TextEncoder().encode('testpassword'))
  }
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
});

// Mock DOM and browser APIs
Object.defineProperty(window, 'location', {
  value: { href: 'https://www.bestbuy.com/site/test-product/123456.p' },
  writable: true,
});

Object.defineProperty(document, 'querySelector', {
  value: jest.fn(),
  writable: true,
});

Object.defineProperty(document, 'querySelectorAll', {
  value: jest.fn(),
  writable: true,
});

Object.defineProperty(document, 'readyState', {
  value: 'complete',
  writable: true,
});

global.TextEncoder = class {
  encode(str: string) {
    return new Uint8Array(str.split('').map(c => c.charCodeAt(0)));
  }
};

global.TextDecoder = class {
  decode(arr: Uint8Array) {
    return String.fromCharCode(...arr);
  }
};

global.btoa = jest.fn((str) => Buffer.from(str, 'binary').toString('base64'));
global.atob = jest.fn((str) => Buffer.from(str, 'base64').toString('binary'));

describe('Checkout Flow Integration', () => {
  const mockRetailerId: RetailerId = 'bestbuy';
  const mockProduct: Product = {
    id: 'test-product-1',
    name: 'Test Pokémon Product',
    sku: 'TEST123',
    upc: '123456789012',
    category: 'pokemon-tcg',
    set: 'Test Set',
    price: 99.99,
    imageUrl: 'https://example.com/image.jpg'
  };

  let credentialManager: CredentialManager;
  let formAutofill: FormAutofillService;
  let cartManager: CartManager;
  let checkoutAutomation: CheckoutAutomationService;
  let purchaseTracker: PurchaseTracker;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize services
    credentialManager = CredentialManager.getInstance();
    formAutofill = new FormAutofillService(mockRetailerId);
    cartManager = new CartManager(mockRetailerId);
    checkoutAutomation = new CheckoutAutomationService(mockRetailerId);
    purchaseTracker = new PurchaseTracker(mockRetailerId);

    // Mock storage responses
    const { getStorageData, setStorageData } = require('../../src/shared/utils');
    
    getStorageData.mockImplementation((key: string) => {
      if (key.includes('encryption_key')) {
        return Promise.resolve('mock-encryption-key-12345678901234567890123456789012');
      }
      if (key.includes('settings')) {
        return Promise.resolve({
          retailerSettings: {
            [mockRetailerId]: {
              enabled: true,
              autoLogin: true,
              autoFill: true
            }
          }
        });
      }
      if (key.includes('checkout_data')) {
        return Promise.resolve({
          shippingAddress: {
            firstName: 'John',
            lastName: 'Doe',
            street: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zipCode: '12345',
            country: 'US'
          },
          paymentMethod: {
            type: 'credit',
            lastFour: '1234',
            expiryMonth: 12,
            expiryYear: 2025
          },
          retailerCredentials: {
            username: 'testuser@example.com',
            password: 'testpassword'
          },
          preferences: {
            expeditedShipping: false,
            savePaymentMethod: true,
            createAccount: false
          }
        });
      }
      if (key.includes('autofill')) {
        return Promise.resolve({
          shippingAddress: {
            firstName: 'John',
            lastName: 'Doe',
            street: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zipCode: '12345',
            country: 'US'
          },
          contactInfo: {
            email: 'testuser@example.com',
            phone: '555-123-4567'
          },
          preferences: {
            savePaymentMethod: true,
            createAccount: false,
            subscribeToNewsletter: false
          }
        });
      }
      if (key.includes('credentials_')) {
        return Promise.resolve({
          retailerId: mockRetailerId,
          username: 'testuser@example.com',
          encryptedPassword: 'encrypted-password-data',
          lastUpdated: Date.now(),
          isValid: true
        });
      }
      if (key.includes('cart_')) {
        return Promise.resolve({
          items: [],
          totalItems: 0,
          totalValue: 0,
          lastUpdated: Date.now()
        });
      }
      if (key.includes('purchases')) {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });

    setStorageData.mockResolvedValue(true);
  });

  describe('Complete Automated Checkout Flow', () => {
    it('should execute full checkout flow successfully', async () => {
      // Initialize all services
      await credentialManager.initialize();
      await formAutofill.initialize();
      await cartManager.initialize();
      await purchaseTracker.initialize();

      // Mock DOM elements for successful flow
      const mockElements = {
        addToCartButton: { click: jest.fn(), scrollIntoView: jest.fn() },
        quantityInput: { value: '1', focus: jest.fn(), dispatchEvent: jest.fn() },
        usernameField: { value: '', focus: jest.fn(), dispatchEvent: jest.fn() },
        passwordField: { value: '', focus: jest.fn(), dispatchEvent: jest.fn() },
        loginButton: { click: jest.fn() },
        checkoutButton: { click: jest.fn() },
        shippingFields: Array(6).fill(null).map(() => ({ 
          value: '', 
          focus: jest.fn(), 
          dispatchEvent: jest.fn() 
        })),
        paymentSection: { textContent: 'Payment Section' },
        placeOrderButton: { click: jest.fn() },
        orderSummary: { textContent: 'Total: $99.99' },
        orderConfirmation: { textContent: 'Order #TEST12345' },
        cartCount: { textContent: '1' }
      };

      (document.querySelector as jest.Mock)
        .mockReturnValueOnce(mockElements.addToCartButton)
        .mockReturnValueOnce(mockElements.quantityInput)
        .mockReturnValueOnce(mockElements.cartCount)
        .mockReturnValueOnce(mockElements.usernameField)
        .mockReturnValueOnce(mockElements.passwordField)
        .mockReturnValueOnce(mockElements.loginButton)
        .mockReturnValueOnce(mockElements.checkoutButton)
        .mockReturnValueOnce(mockElements.shippingFields[0])
        .mockReturnValueOnce(mockElements.shippingFields[1])
        .mockReturnValueOnce(mockElements.shippingFields[2])
        .mockReturnValueOnce(mockElements.shippingFields[3])
        .mockReturnValueOnce(mockElements.shippingFields[4])
        .mockReturnValueOnce(mockElements.shippingFields[5])
        .mockReturnValueOnce(mockElements.paymentSection)
        .mockReturnValueOnce(mockElements.placeOrderButton)
        .mockReturnValueOnce(mockElements.orderSummary)
        .mockReturnValueOnce(mockElements.orderConfirmation);

      // Mock confirmation dialog
      window.confirm = jest.fn().mockReturnValue(true);

      // Step 1: Add product to cart
      const cartResult = await cartManager.addToCart(mockProduct, 1);
      expect(cartResult.success).toBe(true);

      // Step 2: Execute automated checkout
      const checkoutResult = await checkoutAutomation.executeCheckout(
        'https://www.bestbuy.com/site/test-product/123456.p',
        1
      );

      expect(checkoutResult.success).toBe(true);
      expect(checkoutResult.orderId).toBeDefined();
      expect(checkoutResult.steps).toHaveLength(6);

      // Verify all steps were completed
      const stepNames = checkoutResult.steps.map(step => step.name);
      expect(stepNames).toContain('add_to_cart');
      expect(stepNames).toContain('login');
      expect(stepNames).toContain('navigate_checkout');
      expect(stepNames).toContain('fill_shipping');
      expect(stepNames).toContain('fill_payment');
      expect(stepNames).toContain('place_order');

      // Verify all steps completed successfully
      checkoutResult.steps.forEach(step => {
        expect(step.status).toBe('completed');
      });
    });

    it('should handle checkout flow without login', async () => {
      // Mock settings without auto-login
      const { getStorageData } = require('../../src/shared/utils');
      getStorageData.mockImplementation((key: string) => {
        if (key.includes('settings')) {
          return Promise.resolve({
            retailerSettings: {
              [mockRetailerId]: {
                enabled: true,
                autoLogin: false,
                autoFill: true
              }
            }
          });
        }
        // Return other mock data as before
        return getStorageData.mockImplementation.call(this, key);
      });

      await checkoutAutomation.initialize();

      const mockElements = {
        addToCartButton: { click: jest.fn(), scrollIntoView: jest.fn() },
        checkoutButton: { click: jest.fn() },
        shippingFields: Array(6).fill(null).map(() => ({ 
          value: '', 
          focus: jest.fn(), 
          dispatchEvent: jest.fn() 
        })),
        paymentSection: { textContent: 'Payment Section' },
        placeOrderButton: { click: jest.fn() },
        orderSummary: { textContent: 'Total: $99.99' },
        orderConfirmation: { textContent: 'Order #TEST12345' }
      };

      (document.querySelector as jest.Mock)
        .mockReturnValueOnce(mockElements.addToCartButton)
        .mockReturnValueOnce(mockElements.checkoutButton)
        .mockReturnValueOnce(mockElements.shippingFields[0])
        .mockReturnValueOnce(mockElements.shippingFields[1])
        .mockReturnValueOnce(mockElements.shippingFields[2])
        .mockReturnValueOnce(mockElements.shippingFields[3])
        .mockReturnValueOnce(mockElements.shippingFields[4])
        .mockReturnValueOnce(mockElements.shippingFields[5])
        .mockReturnValueOnce(mockElements.paymentSection)
        .mockReturnValueOnce(mockElements.placeOrderButton)
        .mockReturnValueOnce(mockElements.orderSummary)
        .mockReturnValueOnce(mockElements.orderConfirmation);

      window.confirm = jest.fn().mockReturnValue(true);

      const result = await checkoutAutomation.executeCheckout(
        'https://www.bestbuy.com/site/test-product/123456.p',
        1
      );

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(5); // No login step
      
      const stepNames = result.steps.map(step => step.name);
      expect(stepNames).not.toContain('login');
    });

    it('should handle form autofill integration', async () => {
      await formAutofill.initialize();

      // Mock form elements
      const mockFormElements = {
        firstName: { value: '', focus: jest.fn(), dispatchEvent: jest.fn(), blur: jest.fn() },
        lastName: { value: '', focus: jest.fn(), dispatchEvent: jest.fn(), blur: jest.fn() },
        email: { value: '', focus: jest.fn(), dispatchEvent: jest.fn(), blur: jest.fn() }
      };

      (document.querySelector as jest.Mock)
        .mockReturnValueOnce(mockFormElements.firstName)
        .mockReturnValueOnce(mockFormElements.lastName)
        .mockReturnValueOnce(mockFormElements.email);

      const result = await formAutofill.fillAllForms();

      expect(result['contact']?.success).toBe(true);
      expect(result['contact']?.fieldsFilled).toBeGreaterThan(0);
    });

    it('should track purchases after successful checkout', async () => {
      await purchaseTracker.initialize();

      // Mock confirmation page elements
      (document.querySelector as jest.Mock)
        .mockReturnValueOnce({ textContent: 'Order #TEST12345' }) // Order ID
        .mockReturnValueOnce({ textContent: 'Total: $99.99' }) // Total
        .mockReturnValueOnce({ textContent: 'Test Product' }) // Product name
        .mockReturnValueOnce({ textContent: '$99.99' }) // Product price
        .mockReturnValueOnce({ textContent: '1' }); // Quantity

      (document.querySelectorAll as jest.Mock)
        .mockReturnValue([
          {
            querySelector: jest.fn()
              .mockReturnValueOnce({ textContent: 'Test Product' })
              .mockReturnValueOnce({ textContent: '$99.99' })
              .mockReturnValueOnce({ textContent: '1' })
          }
        ]);

      // Mock URL to look like confirmation page
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.bestbuy.com/checkout/confirmation/12345' },
        writable: true,
      });

      const purchase = await purchaseTracker.detectAndTrackPurchase('alert-123');

      expect(purchase).toBeDefined();
      expect(purchase?.orderId).toBe('Order #TEST12345');
      expect(purchase?.totalAmount).toBe(99.99);
      expect(purchase?.metadata.alertId).toBe('alert-123');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle credential manager errors gracefully', async () => {
      // Mock credential manager to throw error
      mockCrypto.subtle.encrypt.mockRejectedValueOnce(new Error('Encryption failed'));

      await credentialManager.initialize();

      await expect(
        credentialManager.storeCredentials(mockRetailerId, 'user@test.com', 'password')
      ).rejects.toThrow('Failed to store credentials securely');
    });

    it('should handle missing form elements in autofill', async () => {
      await formAutofill.initialize();

      // Mock querySelector to return null (missing elements)
      (document.querySelector as jest.Mock).mockReturnValue(null);

      const result = await formAutofill.fillAllForms();

      // Should handle missing elements gracefully
      expect(result).toBeDefined();
    });

    it('should handle cart management errors', async () => {
      await cartManager.initialize();

      // Mock missing add to cart button
      (document.querySelector as jest.Mock).mockReturnValue(null);

      const result = await cartManager.addToCart(mockProduct, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Add to cart button not found');
    });
  });

  describe('Service Coordination', () => {
    it('should coordinate between all services for complete flow', async () => {
      // Initialize all services
      await Promise.all([
        credentialManager.initialize(),
        formAutofill.initialize(),
        cartManager.initialize(),
        purchaseTracker.initialize()
      ]);

      // Verify all services are properly initialized
      expect(await credentialManager.hasCredentials(mockRetailerId)).toBe(true);
      
      const credentials = await credentialManager.getCredentials(mockRetailerId);
      expect(credentials).toBeDefined();
      expect(credentials?.username).toBe('testuser@example.com');

      const cartState = await cartManager.getCartState();
      expect(cartState).toBeDefined();
      expect(cartState.items).toEqual([]);

      const analytics = await purchaseTracker.getAnalytics();
      expect(analytics).toBeDefined();
      expect(analytics.totalPurchases).toBe(0);
    });

    it('should handle service dependencies correctly', async () => {
      // Test that checkout automation depends on other services
      await checkoutAutomation.initialize();

      // Should be able to access settings and checkout data
      expect(checkoutAutomation).toBeDefined();
    });
  });
});