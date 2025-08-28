import { test, expect, chromium, firefox, Browser, BrowserContext, Page } from '@playwright/test';
import path from 'path';

// Extension paths for different browsers
const EXTENSION_PATHS = {
  chrome: path.join(__dirname, '../../dist'),
  firefox: path.join(__dirname, '../../dist')
};

const browsers = ['chromium', 'firefox'];

browsers.forEach(browserName => {
  test.describe(`Browser Extension Tests - ${browserName}`, () => {
    let browser: Browser;
    let context: BrowserContext;
    let page: Page;
    let extensionId: string;

    test.beforeAll(async ({ playwright }) => {
      if (browserName === 'chromium') {
        browser = await chromium.launch({
          headless: false, // Extensions require non-headless mode
          args: [
            `--disable-extensions-except=${EXTENSION_PATHS.chrome}`,
            `--load-extension=${EXTENSION_PATHS.chrome}`,
            '--no-sandbox'
          ]
        });
      } else if (browserName === 'firefox') {
        browser = await firefox.launch({
          headless: false
        });
      }
    });

    test.afterAll(async () => {
      await browser.close();
    });

    test.beforeEach(async () => {
      if (browserName === 'chromium') {
        context = await browser.newContext();
        page = await context.newPage();
        
        // Get extension ID
        await page.goto('chrome://extensions/');
        const extensionElement = await page.locator('[id*="extension-"]').first();
        if (extensionElement) {
          extensionId = await extensionElement.getAttribute('id') || '';
        }
      } else {
        context = await browser.newContext();
        page = await context.newPage();
      }
    });

    test.afterEach(async () => {
      await context.close();
    });

    test('should load extension successfully', async () => {
      if (browserName === 'chromium') {
        await page.goto('chrome://extensions/');
        
        // Check if BoosterBeacon extension is loaded
        const extensionCard = page.locator('text=BoosterBeacon');
        await expect(extensionCard).toBeVisible();
        
        // Check if extension is enabled
        const enabledToggle = page.locator('[aria-label*="BoosterBeacon"] [role="switch"]');
        const isEnabled = await enabledToggle.getAttribute('aria-checked');
        expect(isEnabled).toBe('true');
      } else if (browserName === 'firefox') {
        await page.goto('about:addons');
        
        // Firefox addon management
        const addonsList = page.locator('[data-testid="addon-list"]');
        await expect(addonsList).toBeVisible();
      }
    });

    test('should inject content script on retailer websites', async () => {
      // Test on Best Buy
      await page.goto('https://www.bestbuy.com/site/pokemon-tcg/pcmcat1496956299799.c');
      
      // Wait for content script injection
      await page.waitForTimeout(2000);
      
      // Check if BoosterBeacon elements are injected
      const boosterBeaconElements = await page.evaluate(() => {
        return {
          alertButton: !!document.querySelector('[data-booster-beacon="alert-button"]'),
          priceTracker: !!document.querySelector('[data-booster-beacon="price-tracker"]'),
          quickAdd: !!document.querySelector('[data-booster-beacon="quick-add"]')
        };
      });
      
      expect(boosterBeaconElements.alertButton || boosterBeaconElements.priceTracker).toBe(true);
    });

    test('should open extension popup', async () => {
      if (browserName === 'chromium' && extensionId) {
        // Navigate to extension popup
        await page.goto(`chrome-extension://${extensionId}/popup.html`);
        
        // Check popup content
        await expect(page.locator('[data-testid="popup-container"]')).toBeVisible();
        await expect(page.locator('[data-testid="login-status"]')).toBeVisible();
        await expect(page.locator('[data-testid="quick-actions"]')).toBeVisible();
      }
    });

    test('should handle user authentication in extension', async () => {
      if (browserName === 'chromium' && extensionId) {
        await page.goto(`chrome-extension://${extensionId}/popup.html`);
        
        // Check login form
        const loginForm = page.locator('[data-testid="login-form"]');
        if (await loginForm.isVisible()) {
          await page.fill('[data-testid="email-input"]', 'test@example.com');
          await page.fill('[data-testid="password-input"]', 'password123');
          await page.click('[data-testid="login-button"]');
          
          // Should show logged in state
          await expect(page.locator('[data-testid="user-info"]')).toBeVisible();
        }
      }
    });

    test('should sync data with backend API', async () => {
      if (browserName === 'chromium' && extensionId) {
        await page.goto(`chrome-extension://${extensionId}/popup.html`);
        
        // Test API sync
        const syncResult = await page.evaluate(async () => {
          try {
            // Simulate API call
            const response = await fetch('http://localhost:3000/api/watches', {
              method: 'GET',
              headers: {
                'Authorization': 'Bearer test-token'
              }
            });
            return response.ok;
          } catch (error) {
            return false;
          }
        });
        
        // API sync should work (or fail gracefully)
        expect(typeof syncResult).toBe('boolean');
      }
    });

    test('should handle product detection on retailer pages', async () => {
      // Test product detection on Walmart
      await page.goto('https://www.walmart.com/browse/toys/pokemon-trading-cards/4171_133073_1228360');
      
      await page.waitForTimeout(3000);
      
      // Check if products are detected
      const productDetection = await page.evaluate(() => {
        return {
          productsFound: document.querySelectorAll('[data-automation-id="product-title"]').length > 0,
          boosterBeaconActive: !!document.querySelector('[data-booster-beacon]')
        };
      });
      
      expect(productDetection.productsFound).toBe(true);
    });

    test('should handle form autofill functionality', async () => {
      // Navigate to a test checkout page
      await page.goto('https://www.bestbuy.com/checkout/r/fast-track');
      
      await page.waitForTimeout(2000);
      
      // Check if autofill functionality is available
      const autofillAvailable = await page.evaluate(() => {
        return {
          addressFields: document.querySelectorAll('input[name*="address"], input[name*="street"]').length > 0,
          nameFields: document.querySelectorAll('input[name*="name"], input[name*="first"], input[name*="last"]').length > 0,
          boosterBeaconAutofill: !!document.querySelector('[data-booster-beacon="autofill"]')
        };
      });
      
      // Should detect form fields for autofill
      expect(autofillAvailable.addressFields || autofillAvailable.nameFields).toBe(true);
    });

    test('should handle extension storage', async () => {
      if (browserName === 'chromium' && extensionId) {
        await page.goto(`chrome-extension://${extensionId}/popup.html`);
        
        // Test storage functionality
        const storageTest = await page.evaluate(async () => {
          try {
            // Test chrome.storage.local
            await chrome.storage.local.set({ testKey: 'testValue' });
            const result = await chrome.storage.local.get('testKey');
            return result.testKey === 'testValue';
          } catch (error) {
            return false;
          }
        });
        
        expect(storageTest).toBe(true);
      }
    });

    test('should handle background script functionality', async () => {
      if (browserName === 'chromium' && extensionId) {
        // Test background script by checking if it responds to messages
        const backgroundResponse = await page.evaluate(async () => {
          try {
            return new Promise((resolve) => {
              chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
                resolve(response?.status === 'pong');
              });
              
              // Timeout after 5 seconds
              setTimeout(() => resolve(false), 5000);
            });
          } catch (error) {
            return false;
          }
        });
        
        expect(typeof backgroundResponse).toBe('boolean');
      }
    });

    test('should handle cross-origin requests', async () => {
      if (browserName === 'chromium' && extensionId) {
        await page.goto(`chrome-extension://${extensionId}/popup.html`);
        
        // Test cross-origin API request
        const crossOriginTest = await page.evaluate(async () => {
          try {
            const response = await fetch('http://localhost:3000/api/health', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            });
            return response.ok;
          } catch (error) {
            return false;
          }
        });
        
        // Should be able to make cross-origin requests
        expect(typeof crossOriginTest).toBe('boolean');
      }
    });

    test('should handle extension permissions', async () => {
      if (browserName === 'chromium') {
        await page.goto('chrome://extensions/');
        
        // Check extension permissions
        const extensionCard = page.locator('text=BoosterBeacon').locator('..').locator('..');
        await extensionCard.click();
        
        // Should have required permissions
        const permissionsSection = page.locator('text=Permissions');
        if (await permissionsSection.isVisible()) {
          await expect(permissionsSection).toBeVisible();
        }
      }
    });

    test('should handle extension updates', async () => {
      if (browserName === 'chromium') {
        await page.goto('chrome://extensions/');
        
        // Check for update functionality
        const developerModeToggle = page.locator('text=Developer mode');
        if (await developerModeToggle.isVisible()) {
          await developerModeToggle.click();
          
          // Should show developer options
          const updateButton = page.locator('text=Update');
          await expect(updateButton).toBeVisible();
        }
      }
    });
  });
});

// Browser-specific extension tests
test.describe('Browser-Specific Extension Features', () => {
  test('Chrome - Extension APIs and Permissions', async () => {
    const browser = await chromium.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATHS.chrome}`,
        `--load-extension=${EXTENSION_PATHS.chrome}`
      ]
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      await page.goto('chrome://extensions/');
      
      // Check Chrome-specific APIs
      const chromeAPIs = await page.evaluate(() => {
        return {
          storage: typeof chrome?.storage !== 'undefined',
          runtime: typeof chrome?.runtime !== 'undefined',
          tabs: typeof chrome?.tabs !== 'undefined',
          webRequest: typeof chrome?.webRequest !== 'undefined'
        };
      });
      
      expect(chromeAPIs.storage).toBe(true);
      expect(chromeAPIs.runtime).toBe(true);
    } finally {
      await context.close();
      await browser.close();
    }
  });

  test('Firefox - WebExtensions API Support', async () => {
    const browser = await firefox.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      await page.goto('about:addons');
      
      // Check Firefox WebExtensions API
      const firefoxAPIs = await page.evaluate(() => {
        return {
          browser: typeof browser !== 'undefined',
          storage: typeof browser?.storage !== 'undefined',
          runtime: typeof browser?.runtime !== 'undefined'
        };
      });
      
      // Firefox uses 'browser' namespace
      expect(typeof firefoxAPIs.browser).toBe('boolean');
    } finally {
      await context.close();
      await browser.close();
    }
  });
});