// Tests for checkout automation service

import { CheckoutAutomationService, CheckoutData } from '../../src/services/checkoutAutomation';
import { RetailerId } from '../../src/shared/types';

// Mock the shared utilities
jest.mock('../../src/shared/utils', () => ({
  getStorageData: jest.fn(),
  setStorageData: jest.fn(),
  log: jest.fn(),
  debounce: jest.fn((fn) => fn),
  getCurrentRetailer: jest.fn()
}));

// Mock DOM methods
Object.defineProperty(window, 'location', {
  value: {
    href: 'https://www.bestbuy.com/site/test-product/123456.p',
  },
  writable: true,
});

// Mock document methods
Object.defineProperty(document, 'querySelector', {
  value: jest.fn(),
  writable: true,
});

Object.defineProperty(document, 'readyState', {
  value: 'complete',
  writable: true,
});

describe('CheckoutAutomationService', () => {
  let checkoutService: CheckoutAutomationService;
  const mockRetailerId: RetailerId = 'bestbuy';

  const mockCheckoutData: CheckoutData = {
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
      type: 'credit' as any,
      lastFour: '1234',
      expiryMonth: 12,
      expiryYear: 2025,
      brand: 'Visa'
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
  };

  beforeEach(() => {
    checkoutService = new CheckoutAutomationService(mockRetailerId);
    jest.clearAllMocks();
    
    // Mock storage data
    const { getStorageData } = require('../../src/shared/utils');
    getStorageData.mockImplementation((key: string) => {
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
        return Promise.resolve(mockCheckoutData);
      }
      return Promise.resolve(null);
    });
  });

  describe('initialization', () => {
    it('should initialize successfully with valid settings', async () => {
      await expect(checkoutService.initialize()).resolves.not.toThrow();
    });

    it('should throw error if retailer is disabled', async () => {
      const { getStorageData } = require('../../src/shared/utils');
      getStorageData.mockImplementation((key: string) => {
        if (key.includes('settings')) {
          return Promise.resolve({
            retailerSettings: {
              [mockRetailerId]: {
                enabled: false
              }
            }
          });
        }
        return Promise.resolve(null);
      });

      await expect(checkoutService.initialize()).rejects.toThrow('Checkout automation disabled');
    });
  });

  describe('executeCheckout', () => {
    beforeEach(async () => {
      await checkoutService.initialize();
    });

    it('should execute checkout successfully with all steps', async () => {
      // Mock DOM elements for successful checkout
      const mockAddToCartButton = { click: jest.fn() };
      const mockLoginButton = { click: jest.fn() };
      const mockCheckoutButton = { click: jest.fn() };
      const mockPlaceOrderButton = { click: jest.fn() };

      (document.querySelector as jest.Mock)
        .mockReturnValueOnce(mockAddToCartButton) // Add to cart button
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() }) // Username field
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() }) // Password field
        .mockReturnValueOnce(mockLoginButton) // Login button
        .mockReturnValueOnce(mockCheckoutButton) // Checkout button
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() }) // Shipping fields
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ textContent: 'Payment Section' }) // Payment section
        .mockReturnValueOnce(mockPlaceOrderButton) // Place order button
        .mockReturnValueOnce({ textContent: 'Total: $99.99' }) // Order summary
        .mockReturnValueOnce({ textContent: 'Order #12345' }); // Order confirmation

      // Mock window.confirm for order confirmation
      window.confirm = jest.fn().mockReturnValue(true);

      const result = await checkoutService.executeCheckout('https://example.com/product', 1);

      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();
      expect(result.steps).toHaveLength(6); // All checkout steps
      expect(mockAddToCartButton.click).toHaveBeenCalled();
      expect(mockLoginButton.click).toHaveBeenCalled();
      expect(mockCheckoutButton.click).toHaveBeenCalled();
      expect(mockPlaceOrderButton.click).toHaveBeenCalled();
    });

    it('should handle missing add to cart button', async () => {
      (document.querySelector as jest.Mock).mockReturnValue(null);

      const result = await checkoutService.executeCheckout('https://example.com/product', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Add to cart button not found');
    });

    it('should handle checkout without login when credentials not available', async () => {
      // Mock checkout data without credentials
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
        if (key.includes('checkout_data')) {
          return Promise.resolve({
            ...mockCheckoutData,
            retailerCredentials: undefined
          });
        }
        return Promise.resolve(null);
      });

      await checkoutService.initialize();

      // Mock DOM elements for checkout without login
      const mockAddToCartButton = { click: jest.fn() };
      const mockCheckoutButton = { click: jest.fn() };
      const mockPlaceOrderButton = { click: jest.fn() };

      (document.querySelector as jest.Mock)
        .mockReturnValueOnce(mockAddToCartButton)
        .mockReturnValueOnce(mockCheckoutButton)
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() }) // Shipping fields
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ textContent: 'Payment Section' })
        .mockReturnValueOnce(mockPlaceOrderButton)
        .mockReturnValueOnce({ textContent: 'Total: $99.99' })
        .mockReturnValueOnce({ textContent: 'Order #12345' });

      window.confirm = jest.fn().mockReturnValue(true);

      const result = await checkoutService.executeCheckout('https://example.com/product', 1);

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(5); // Checkout steps without login
    });

    it('should handle user cancellation during order confirmation', async () => {
      const mockAddToCartButton = { click: jest.fn() };
      const mockCheckoutButton = { click: jest.fn() };

      (document.querySelector as jest.Mock)
        .mockReturnValueOnce(mockAddToCartButton)
        .mockReturnValueOnce(mockCheckoutButton)
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() }) // Shipping fields
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ textContent: 'Payment Section' })
        .mockReturnValueOnce({ click: jest.fn() }) // Place order button
        .mockReturnValueOnce({ textContent: 'Total: $99.99' }); // Order summary

      // User cancels the order
      window.confirm = jest.fn().mockReturnValue(false);

      const result = await checkoutService.executeCheckout('https://example.com/product', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Order cancelled by user');
    });

    it('should handle high-value order safety check', async () => {
      const mockAddToCartButton = { click: jest.fn() };
      const mockCheckoutButton = { click: jest.fn() };

      (document.querySelector as jest.Mock)
        .mockReturnValueOnce(mockAddToCartButton)
        .mockReturnValueOnce(mockCheckoutButton)
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() }) // Shipping fields
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ value: '', focus: jest.fn(), dispatchEvent: jest.fn() })
        .mockReturnValueOnce({ textContent: 'Payment Section' })
        .mockReturnValueOnce({ click: jest.fn() }) // Place order button
        .mockReturnValueOnce({ textContent: 'Total: $1500.00' }); // High-value order

      const result = await checkoutService.executeCheckout('https://example.com/product', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds safety limit');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await checkoutService.initialize();
    });

    it('should handle concurrent checkout attempts', async () => {
      const mockButton = { click: jest.fn() };
      (document.querySelector as jest.Mock).mockReturnValue(mockButton);

      // Start first checkout
      const firstCheckout = checkoutService.executeCheckout('https://example.com/product', 1);
      
      // Try to start second checkout immediately
      const secondCheckout = checkoutService.executeCheckout('https://example.com/product', 1);

      const [firstResult, secondResult] = await Promise.all([firstCheckout, secondCheckout]);

      // One should succeed, one should fail due to concurrent execution
      const results = [firstResult, secondResult];
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      expect(successCount).toBeLessThanOrEqual(1);
      expect(errorCount).toBeGreaterThanOrEqual(1);
    });

    it('should handle missing checkout data', async () => {
      const { getStorageData } = require('../../src/shared/utils');
      getStorageData.mockImplementation((key: string) => {
        if (key.includes('settings')) {
          return Promise.resolve({
            retailerSettings: {
              [mockRetailerId]: { enabled: true }
            }
          });
        }
        return Promise.resolve(null); // No checkout data
      });

      await checkoutService.initialize();

      const result = await checkoutService.executeCheckout('https://example.com/product', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Checkout data not configured');
    });
  });

  describe('retailer-specific functionality', () => {
    it('should use correct selectors for Best Buy', async () => {
      await checkoutService.initialize();

      const mockButton = { click: jest.fn() };
      (document.querySelector as jest.Mock).mockReturnValue(mockButton);

      await checkoutService.executeCheckout('https://example.com/product', 1);

      // Verify that Best Buy specific selectors were used
      expect(document.querySelector).toHaveBeenCalledWith(
        expect.stringContaining('.add-to-cart-button')
      );
    });

    it('should handle different retailers', async () => {
      const walmartService = new CheckoutAutomationService('walmart');
      
      const { getStorageData } = require('../../src/shared/utils');
      getStorageData.mockImplementation((key: string) => {
        if (key.includes('settings')) {
          return Promise.resolve({
            retailerSettings: {
              walmart: { enabled: true, autoLogin: false, autoFill: true }
            }
          });
        }
        if (key.includes('checkout_data')) {
          return Promise.resolve(mockCheckoutData);
        }
        return Promise.resolve(null);
      });

      await walmartService.initialize();

      const mockButton = { click: jest.fn() };
      (document.querySelector as jest.Mock).mockReturnValue(mockButton);

      await walmartService.executeCheckout('https://example.com/product', 1);

      // Verify that Walmart specific selectors were used
      expect(document.querySelector).toHaveBeenCalledWith(
        expect.stringContaining('[data-automation-id="add-to-cart-button"]')
      );
    });
  });
});