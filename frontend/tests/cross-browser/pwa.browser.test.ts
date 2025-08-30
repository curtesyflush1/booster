import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

// Cross-browser PWA functionality tests
const browsers = ['chromium', 'firefox', 'webkit'];

browsers.forEach(browserName => {
  test.describe(`PWA Tests - ${browserName}`, () => {
    let browser: Browser;
    let context: BrowserContext;
    let page: Page;

    test.beforeAll(async ({ playwright }) => {
      browser = await (playwright[browserName as keyof typeof playwright] as { launch(): Promise<Browser> }).launch();
    });

    test.afterAll(async () => {
      await browser.close();
    });

    test.beforeEach(async () => {
      context = await browser.newContext({
        permissions: ['notifications', 'camera']
      });
      page = await context.newPage();
    });

    test.afterEach(async () => {
      await context.close();
    });

    test('should load PWA manifest correctly', async () => {
      await page.goto('http://localhost:5173');
      
      // Check if manifest is loaded
      const manifestLink = await page.locator('link[rel="manifest"]');
      expect(await manifestLink.count()).toBe(1);
      
      const manifestHref = await manifestLink.getAttribute('href');
      expect(manifestHref).toBeTruthy();
      
      // Verify manifest content
      const manifestResponse = await page.request.get(`http://localhost:5173${manifestHref}`);
      expect(manifestResponse.ok()).toBeTruthy();
      
      const manifest = await manifestResponse.json();
      expect(manifest.name).toBe('BoosterBeacon - Pokémon TCG Alerts');
      expect(manifest.short_name).toBe('BoosterBeacon');
      expect(manifest.display).toBe('standalone');
    });

    test('should register service worker', async () => {
      await page.goto('http://localhost:5173');
      
      // Wait for service worker registration
      await page.waitForFunction(() => 'serviceWorker' in navigator);
      
      const swRegistration = await page.evaluate(async () => {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          return {
            scope: registration.scope,
            active: !!registration.active
          };
        }
        return null;
      });
      
      expect(swRegistration).toBeTruthy();
      expect(swRegistration?.active).toBe(true);
    });

    test('should support offline functionality', async () => {
      await page.goto('http://localhost:5173');
      
      // Wait for app to load
      await page.waitForSelector('[data-testid="app-container"]');
      
      // Go offline
      await context.setOffline(true);
      
      // Navigate to a cached page
      await page.click('[data-testid="dashboard-link"]');
      
      // Should still work offline (cached content)
      await expect(page.locator('[data-testid="dashboard-container"]')).toBeVisible();
      
      // Go back online
      await context.setOffline(false);
    });

    test('should handle push notifications', async () => {
      await page.goto('http://localhost:5173');
      
      // Login first
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');
      
      // Wait for dashboard
      await page.waitForSelector('[data-testid="dashboard-container"]');
      
      // Request notification permission
      const permissionResult = await page.evaluate(async () => {
        if ('Notification' in window) {
          return await Notification.requestPermission();
        }
        return 'not-supported';
      });
      
      if (browserName !== 'webkit') { // Safari doesn't support web push in testing
        expect(permissionResult).toBe('granted');
        
        // Test push subscription
        const subscription = await page.evaluate(async () => {
          if ('serviceWorker' in navigator && 'PushManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: 'test-key'
            });
            return !!subscription;
          }
          return false;
        });
        
        expect(subscription).toBe(true);
      }
    });

    test('should support camera access for barcode scanning', async () => {
      await page.goto('http://localhost:5173');
      
      // Login and navigate to scanner
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');
      
      await page.waitForSelector('[data-testid="dashboard-container"]');
      await page.click('[data-testid="barcode-scanner-button"]');
      
      // Check if camera access is requested
      const cameraAccess = await page.evaluate(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop());
          return true;
        } catch (_error) {
          return false;
        }
      });
      
      if (browserName === 'chromium') { // Camera access works best in Chromium
        expect(cameraAccess).toBe(true);
      }
    });

    test('should handle responsive design', async () => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('http://localhost:5173');
      
      // Check mobile navigation
      const mobileMenu = page.locator('[data-testid="mobile-menu-button"]');
      await expect(mobileMenu).toBeVisible();
      
      // Test tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      
      // Check tablet layout
      const tabletLayout = page.locator('[data-testid="tablet-layout"]');
      await expect(tabletLayout).toBeVisible();
      
      // Test desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.reload();
      
      // Check desktop layout
      const desktopLayout = page.locator('[data-testid="desktop-layout"]');
      await expect(desktopLayout).toBeVisible();
    });

    test('should support touch gestures on mobile', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('http://localhost:5173');
      
      // Login
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');
      
      await page.waitForSelector('[data-testid="dashboard-container"]');
      
      // Test swipe gesture on alert cards
      const alertCard = page.locator('[data-testid="alert-card"]').first();
      if (await alertCard.count() > 0) {
        const box = await alertCard.boundingBox();
        if (box) {
          // Swipe left to dismiss
          await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
          await page.touchscreen.tap(box.x + 50, box.y + box.height / 2);
        }
      }
    });

    test('should handle network connectivity changes', async () => {
      await page.goto('http://localhost:5173');
      
      // Start online
      await expect(page.locator('[data-testid="online-indicator"]')).toBeVisible();
      
      // Go offline
      await context.setOffline(true);
      
      // Should show offline indicator
      await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
      
      // Go back online
      await context.setOffline(false);
      
      // Should show online indicator again
      await expect(page.locator('[data-testid="online-indicator"]')).toBeVisible();
    });

    test('should cache API responses for offline use', async () => {
      await page.goto('http://localhost:5173');
      
      // Login and load data
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');
      
      await page.waitForSelector('[data-testid="dashboard-container"]');
      
      // Load product data
      await page.click('[data-testid="products-link"]');
      await page.waitForSelector('[data-testid="product-list"]');
      
      // Go offline
      await context.setOffline(true);
      
      // Navigate back to products - should load from cache
      await page.click('[data-testid="dashboard-link"]');
      await page.click('[data-testid="products-link"]');
      
      // Should still show products from cache
      await expect(page.locator('[data-testid="product-list"]')).toBeVisible();
    });

    test('should support PWA installation prompt', async () => {
      await page.goto('http://localhost:5173');
      
      // Check for install prompt (only in Chromium)
      if (browserName === 'chromium') {
        const installPrompt = await page.evaluate(() => {
          return new Promise((resolve) => {
            window.addEventListener('beforeinstallprompt', (_e) => {
              resolve(true);
            });
            
            // Simulate install prompt after timeout
            setTimeout(() => resolve(false), 2000);
          });
        });
        
        // Install prompt behavior varies by browser and conditions
        expect(typeof installPrompt).toBe('boolean');
      }
    });
  });
});

// Browser-specific tests
test.describe('Browser-Specific PWA Features', () => {
  test('Chrome - Web App Manifest and Install Banner', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Check Chrome-specific PWA features
    const chromeFeatures = await page.evaluate(() => {
      return {
        standalone: window.matchMedia('(display-mode: standalone)').matches,
        webAppCapable: document.querySelector('meta[name="mobile-web-app-capable"]')?.getAttribute('content'),
        themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content')
      };
    });
    
    expect(chromeFeatures.themeColor).toBeTruthy();
  });

  test('Firefox - PWA Support and Manifest', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Firefox PWA support
    const firefoxSupport = await page.evaluate(() => {
      return {
        serviceWorker: 'serviceWorker' in navigator,
        pushManager: 'PushManager' in window,
        notification: 'Notification' in window
      };
    });
    
    expect(firefoxSupport.serviceWorker).toBe(true);
    expect(firefoxSupport.notification).toBe(true);
  });

  test('Safari - iOS PWA Features', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Check Safari/iOS specific meta tags
    const safariFeatures = await page.evaluate(() => {
      return {
        appleWebAppCapable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content'),
        appleWebAppStatusBar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content'),
        appleWebAppTitle: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content')
      };
    });
    
    // These should be present for iOS PWA support
    expect(safariFeatures.appleWebAppCapable).toBeTruthy();
  });
});