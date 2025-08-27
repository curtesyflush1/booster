// Content script for BoosterBeacon browser extension
// Injected into retailer websites to provide product detection and checkout assistance

import { 
  ExtensionMessage, 
  MessageResponse,
  Product,
  MessageType,
  RetailerId
} from '../shared/types';
import { 
  getCurrentRetailer, 
  sendExtensionMessage, 
  log,
  debounce,
  generateId
} from '../shared/utils';
import { CheckoutAutomationService } from '../services/checkoutAutomation';
import { CredentialManager } from '../services/credentialManager';
import { FormAutofillService } from '../services/formAutofill';
import { CartManager } from '../services/cartManager';
import { PurchaseTracker } from '../services/purchaseTracker';

class ContentScript {
  private retailer = getCurrentRetailer();
  private productDetector: ProductDetector | null = null;
  private checkoutAssistant: CheckoutAssistant | null = null;
  private checkoutAutomation: CheckoutAutomationService | null = null;
  private credentialManager: CredentialManager | null = null;
  private formAutofill: FormAutofillService | null = null;
  private cartManager: CartManager | null = null;
  private purchaseTracker: PurchaseTracker | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    log('info', `Content script initializing on ${this.retailer?.name || 'unknown site'}`);
    
    if (!this.retailer) {
      log('warn', 'Not a supported retailer, content script will not activate');
      return;
    }
    
    // Set up message listener
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Initialize retailer-specific components
    this.productDetector = new ProductDetector(this.retailer.id as RetailerId);
    this.checkoutAssistant = new CheckoutAssistant(this.retailer.id as RetailerId);
    
    // Initialize automation services
    this.checkoutAutomation = new CheckoutAutomationService(this.retailer.id as RetailerId);
    this.credentialManager = CredentialManager.getInstance();
    this.formAutofill = new FormAutofillService(this.retailer.id as RetailerId);
    this.cartManager = new CartManager(this.retailer.id as RetailerId);
    this.purchaseTracker = new PurchaseTracker(this.retailer.id as RetailerId);
    
    // Initialize services
    await this.initializeServices();
    
    // Start monitoring the page
    this.startPageMonitoring();
    
    // Inject BoosterBeacon UI elements
    this.injectUI();
    
    this.isInitialized = true;
    log('info', 'Content script initialized successfully');
  }

  private async initializeServices(): Promise<void> {
    try {
      await this.credentialManager?.initialize();
      await this.formAutofill?.initialize();
      await this.cartManager?.initialize();
      await this.purchaseTracker?.initialize();
      
      log('info', 'All automation services initialized');
    } catch (error) {
      log('warn', 'Some services failed to initialize', error);
    }
  }

  private handleMessage(
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ): boolean {
    log('info', `Content script received message: ${message.type}`);
    
    switch (message.type) {
      case MessageType.PING:
        sendResponse({ success: true, data: 'pong' });
        break;
      
      case MessageType.EXECUTE_ADD_TO_CART:
        this.executeAddToCart(message.payload)
          .then(sendResponse)
          .catch(error => sendResponse({ 
            success: false, 
            error: { code: 'EXECUTION_ERROR', message: error.message } 
          }));
        return true;
      
      case MessageType.FILL_CHECKOUT_FORM:
        this.fillCheckoutForm(message.payload)
          .then(sendResponse)
          .catch(error => sendResponse({ 
            success: false, 
            error: { code: 'FORM_FILL_ERROR', message: error.message } 
          }));
        return true;
      
      case 'EXECUTE_AUTOMATED_CHECKOUT':
        this.executeAutomatedCheckout(message.payload)
          .then(sendResponse)
          .catch(error => sendResponse({ 
            success: false, 
            error: { code: 'CHECKOUT_ERROR', message: error.message } 
          }));
        return true;
      
      case 'FILL_ALL_FORMS':
        this.fillAllForms()
          .then(sendResponse)
          .catch(error => sendResponse({ 
            success: false, 
            error: { code: 'AUTOFILL_ERROR', message: error.message } 
          }));
        return true;
      
      default:
        sendResponse({ 
          success: false, 
          error: { code: 'UNKNOWN_MESSAGE_TYPE', message: 'Unknown message type' } 
        });
    }
    
    return false;
  }

  private startPageMonitoring(): void {
    // Monitor for product pages
    this.productDetector?.startMonitoring();
    
    // Monitor for checkout pages
    this.checkoutAssistant?.startMonitoring();
    
    // Track page views
    this.trackPageView();
  }

  private async trackPageView(): Promise<void> {
    const pageData = {
      url: window.location.href,
      title: document.title,
      retailer: this.retailer?.id,
      isProductPage: this.productDetector?.isProductPage() || false,
      isCheckoutPage: this.checkoutAssistant?.isCheckoutPage() || false
    };
    
    await sendExtensionMessage({
      type: MessageType.TRACK_PAGE_VIEW,
      payload: pageData
    });
  }

  private injectUI(): void {
    // Inject BoosterBeacon floating action button
    this.injectFloatingButton();
    
    // Inject product-specific UI if on a product page
    if (this.productDetector?.isProductPage()) {
      this.injectProductUI();
    }
  }

  private injectFloatingButton(): void {
    const existingButton = document.getElementById('booster-beacon-fab');
    if (existingButton) return;
    
    const fab = document.createElement('div');
    fab.id = 'booster-beacon-fab';
    fab.className = 'booster-beacon-fab';
    fab.innerHTML = `
      <div class="bb-fab-icon">🔔</div>
      <div class="bb-fab-tooltip">BoosterBeacon</div>
    `;
    
    fab.addEventListener('click', () => {
      this.showQuickActions();
    });
    
    document.body.appendChild(fab);
  }

  private injectProductUI(): void {
    const product = this.productDetector?.detectProduct();
    if (!product) return;
    
    const productUI = document.createElement('div');
    productUI.id = 'booster-beacon-product-ui';
    productUI.className = 'booster-beacon-product-ui';
    productUI.innerHTML = `
      <div class="bb-product-header">
        <span class="bb-logo">BoosterBeacon</span>
        <button class="bb-close-btn">×</button>
      </div>
      <div class="bb-product-info">
        <h4>${product.name}</h4>
        <p class="bb-price">$${product.price}</p>
      </div>
      <div class="bb-actions">
        <button class="bb-btn bb-btn-primary" id="bb-add-watch">
          Add to Watch List
        </button>
        <button class="bb-btn bb-btn-secondary" id="bb-quick-buy">
          Quick Buy
        </button>
      </div>
    `;
    
    // Position the UI near the product information
    const productContainer = this.findProductContainer();
    if (productContainer) {
      productContainer.appendChild(productUI);
    } else {
      document.body.appendChild(productUI);
    }
    
    // Add event listeners
    this.setupProductUIEvents(productUI, product);
  }

  private findProductContainer(): Element | null {
    // Retailer-specific selectors for product containers
    const selectors = {
      bestbuy: '.pricing-price__range, .sr-product-details',
      walmart: '.price-group, .product-details',
      costco: '.product-price, .product-info-main',
      samsclub: '.price, .product-details'
    };
    
    const selector = selectors[this.retailer?.id as keyof typeof selectors];
    return selector ? document.querySelector(selector) : null;
  }

  private setupProductUIEvents(ui: Element, product: Product): void {
    const addWatchBtn = ui.querySelector('#bb-add-watch');
    const quickBuyBtn = ui.querySelector('#bb-quick-buy');
    const closeBtn = ui.querySelector('.bb-close-btn');
    
    addWatchBtn?.addEventListener('click', async () => {
      await this.addProductToWatchList(product);
    });
    
    quickBuyBtn?.addEventListener('click', async () => {
      await this.executeQuickBuy(product);
    });
    
    closeBtn?.addEventListener('click', () => {
      ui.remove();
    });
  }

  private async addProductToWatchList(product: Product): Promise<void> {
    try {
      const response = await sendExtensionMessage({
        type: MessageType.ADD_TO_CART, // This will be updated when watch API is implemented
        payload: { product, action: 'add_watch' }
      });
      
      if (response.success) {
        this.showNotification('Product added to watch list!', 'success');
      } else {
        this.showNotification('Failed to add product to watch list', 'error');
      }
    } catch (error) {
      log('error', 'Failed to add product to watch list', error);
      this.showNotification('An error occurred', 'error');
    }
  }

  private async executeQuickBuy(product: Product): Promise<void> {
    try {
      // First add to cart
      const addToCartResponse = await sendExtensionMessage({
        type: MessageType.ADD_TO_CART,
        payload: { product, action: 'quick_buy' }
      });
      
      if (!addToCartResponse.success) {
        this.showNotification('Failed to add product to cart', 'error');
        return;
      }

      this.showNotification('Product added to cart! Starting checkout...', 'info');

      // Then execute automated checkout if enabled
      const automatedCheckoutResponse = await sendExtensionMessage({
        type: 'EXECUTE_AUTOMATED_CHECKOUT' as MessageType,
        payload: { 
          productUrl: window.location.href,
          quantity: 1,
          source: 'quick_buy'
        }
      });

      if (automatedCheckoutResponse.success) {
        this.showNotification('Purchase completed successfully!', 'success');
      } else {
        this.showNotification('Added to cart. Please complete checkout manually.', 'info');
      }
    } catch (error) {
      log('error', 'Failed to execute quick buy', error);
      this.showNotification('An error occurred during quick buy', 'error');
    }
  }

  private async executeAddToCart(payload: any): Promise<MessageResponse> {
    try {
      log('info', 'Executing automated add to cart', payload);
      
      if (!this.cartManager) {
        throw new Error('Cart manager not initialized');
      }

      const product = payload.product as Product;
      const quantity = payload.quantity || 1;
      
      const result = await this.cartManager.addToCart(product, quantity);
      
      if (result.success) {
        return { 
          success: true, 
          data: { 
            message: 'Product added to cart successfully',
            cartItem: result.cartItem,
            cartUrl: result.cartUrl
          } 
        };
      } else {
        throw new Error(result.error || 'Failed to add to cart');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add to cart';
      log('error', 'Add to cart failed', error);
      return { 
        success: false, 
        error: { code: 'ADD_TO_CART_ERROR', message: errorMessage } 
      };
    }
  }

  private async fillCheckoutForm(payload: any): Promise<MessageResponse> {
    try {
      log('info', 'Filling checkout form', payload);
      
      if (!this.formAutofill) {
        throw new Error('Form autofill service not initialized');
      }

      const formType = payload.formType || 'all';
      let results;

      switch (formType) {
        case 'shipping':
          results = { shipping: await this.formAutofill.fillShippingForm() };
          break;
        case 'billing':
          results = { billing: await this.formAutofill.fillBillingForm() };
          break;
        case 'contact':
          results = { contact: await this.formAutofill.fillContactForm() };
          break;
        case 'payment':
          results = { payment: await this.formAutofill.fillPaymentForm() };
          break;
        default:
          results = await this.formAutofill.fillAllForms();
      }

      return { 
        success: true, 
        data: { 
          message: 'Forms filled successfully',
          results
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fill checkout form';
      log('error', 'Form filling failed', error);
      return { 
        success: false, 
        error: { code: 'FORM_FILL_ERROR', message: errorMessage } 
      };
    }
  }

  private async executeAutomatedCheckout(payload: any): Promise<MessageResponse> {
    try {
      log('info', 'Executing automated checkout', payload);
      
      if (!this.checkoutAutomation) {
        throw new Error('Checkout automation service not initialized');
      }

      const productUrl = payload.productUrl;
      const quantity = payload.quantity || 1;
      
      const result = await this.checkoutAutomation.executeCheckout(productUrl, quantity);
      
      if (result.success && result.orderId) {
        // Track the successful purchase
        await this.trackPurchaseFromCheckout(result.orderId, payload.alertId);
      }

      return { 
        success: result.success, 
        data: { 
          message: result.success ? 'Checkout completed successfully' : 'Checkout failed',
          orderId: result.orderId,
          steps: result.steps
        },
        error: result.error ? { code: 'CHECKOUT_ERROR', message: result.error } : undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Automated checkout failed';
      log('error', 'Automated checkout failed', error);
      return { 
        success: false, 
        error: { code: 'CHECKOUT_ERROR', message: errorMessage } 
      };
    }
  }

  private async fillAllForms(): Promise<MessageResponse> {
    try {
      log('info', 'Filling all available forms');
      
      if (!this.formAutofill) {
        throw new Error('Form autofill service not initialized');
      }

      const results = await this.formAutofill.fillAllForms();
      
      return { 
        success: true, 
        data: { 
          message: 'All forms processed',
          results
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fill forms';
      log('error', 'Form autofill failed', error);
      return { 
        success: false, 
        error: { code: 'AUTOFILL_ERROR', message: errorMessage } 
      };
    }
  }

  private async trackPurchaseFromCheckout(orderId: string, alertId?: string): Promise<void> {
    try {
      if (!this.purchaseTracker) {
        log('warn', 'Purchase tracker not available');
        return;
      }

      // Try to detect and track the purchase
      const purchase = await this.purchaseTracker.detectAndTrackPurchase(alertId);
      
      if (purchase) {
        log('info', `Purchase tracked successfully: ${purchase.orderId}`);
      } else {
        log('warn', 'Could not automatically track purchase');
      }
    } catch (error) {
      log('error', 'Failed to track purchase', error);
    }
  }

  private showQuickActions(): void {
    // Show a quick actions menu
    const existingMenu = document.getElementById('bb-quick-actions');
    if (existingMenu) {
      existingMenu.remove();
      return;
    }
    
    const menu = document.createElement('div');
    menu.id = 'bb-quick-actions';
    menu.className = 'bb-quick-actions';
    menu.innerHTML = `
      <div class="bb-menu-header">BoosterBeacon</div>
      <div class="bb-menu-item" data-action="open-popup">Open Extension</div>
      <div class="bb-menu-item" data-action="sync-data">Sync Data</div>
      <div class="bb-menu-item" data-action="settings">Settings</div>
    `;
    
    menu.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset['action'];
      
      if (action) {
        this.handleQuickAction(action);
        menu.remove();
      }
    });
    
    document.body.appendChild(menu);
    
    // Remove menu when clicking outside
    setTimeout(() => {
      document.addEventListener('click', (e) => {
        if (!menu.contains(e.target as Node)) {
          menu.remove();
        }
      }, { once: true });
    }, 100);
  }

  private async handleQuickAction(action: string): Promise<void> {
    switch (action) {
      case 'open-popup':
        // This would open the extension popup
        break;
      
      case 'sync-data':
        await sendExtensionMessage({ type: MessageType.SYNC_DATA });
        this.showNotification('Data synced!', 'success');
        break;
      
      case 'settings':
        // This would open the settings page
        break;
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const notification = document.createElement('div');
    notification.className = `bb-notification bb-notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Product detection utility class
class ProductDetector {
  constructor(private retailerId: string) {}

  startMonitoring(): void {
    // Monitor for product page changes
    const observer = new MutationObserver(debounce(() => {
      if (this.isProductPage()) {
        this.onProductPageDetected();
      }
    }, 1000));
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  isProductPage(): boolean {
    // Retailer-specific product page detection
    const productSelectors = {
      bestbuy: '.sku-title, .sr-product-title',
      walmart: '.product-title, [data-testid="product-title"]',
      costco: '.product-h1, .product-title',
      samsclub: '.product-title, .item-title'
    };
    
    const selector = productSelectors[this.retailerId as keyof typeof productSelectors];
    return selector ? !!document.querySelector(selector) : false;
  }

  detectProduct(): Product | null {
    if (!this.isProductPage()) return null;
    
    // Retailer-specific product information extraction
    switch (this.retailerId) {
      case 'bestbuy':
        return this.detectBestBuyProduct();
      case 'walmart':
        return this.detectWalmartProduct();
      case 'costco':
        return this.detectCostcoProduct();
      case 'samsclub':
        return this.detectSamsClubProduct();
      default:
        return null;
    }
  }

  private detectBestBuyProduct(): Product | null {
    const titleEl = document.querySelector('.sku-title, .sr-product-title');
    const priceEl = document.querySelector('.pricing-price__range .sr-only, .visuallyhidden');
    const skuEl = document.querySelector('.product-data-value');
    
    if (!titleEl) return null;
    
    return {
      id: generateId(),
      name: titleEl.textContent?.trim() || '',
      sku: skuEl?.textContent?.trim() || '',
      upc: '',
      category: 'pokemon-tcg',
      set: '',
      price: this.extractPrice(priceEl?.textContent || ''),
      imageUrl: ''
    };
  }

  private detectWalmartProduct(): Product | null {
    const titleEl = document.querySelector('.product-title, [data-testid="product-title"]');
    const priceEl = document.querySelector('[data-testid="price-current"], .price-current');
    
    if (!titleEl) return null;
    
    return {
      id: generateId(),
      name: titleEl.textContent?.trim() || '',
      sku: '',
      upc: '',
      category: 'pokemon-tcg',
      set: '',
      price: this.extractPrice(priceEl?.textContent || ''),
      imageUrl: ''
    };
  }

  private detectCostcoProduct(): Product | null {
    const titleEl = document.querySelector('.product-h1, .product-title');
    const priceEl = document.querySelector('.product-price .price, .price-current');
    
    if (!titleEl) return null;
    
    return {
      id: generateId(),
      name: titleEl.textContent?.trim() || '',
      sku: '',
      upc: '',
      category: 'pokemon-tcg',
      set: '',
      price: this.extractPrice(priceEl?.textContent || ''),
      imageUrl: ''
    };
  }

  private detectSamsClubProduct(): Product | null {
    const titleEl = document.querySelector('.product-title, .item-title');
    const priceEl = document.querySelector('.price, .price-current');
    
    if (!titleEl) return null;
    
    return {
      id: generateId(),
      name: titleEl.textContent?.trim() || '',
      sku: '',
      upc: '',
      category: 'pokemon-tcg',
      set: '',
      price: this.extractPrice(priceEl?.textContent || ''),
      imageUrl: ''
    };
  }

  private extractPrice(priceText: string): number {
    const match = priceText.match(/\$?(\d+(?:\.\d{2})?)/);
    return match && match[1] ? parseFloat(match[1]) : 0;
  }

  private onProductPageDetected(): void {
    log('info', 'Product page detected');
    // Trigger product UI injection or updates
  }
}

// Checkout assistance utility class
class CheckoutAssistant {
  constructor(private retailerId: string) {}

  startMonitoring(): void {
    // Monitor for checkout page changes
    const observer = new MutationObserver(debounce(() => {
      if (this.isCheckoutPage()) {
        this.onCheckoutPageDetected();
      }
    }, 1000));
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  isCheckoutPage(): boolean {
    // Retailer-specific checkout page detection
    const checkoutSelectors = {
      bestbuy: '.checkout, [data-testid="checkout"]',
      walmart: '.checkout, .cart-page',
      costco: '.checkout, .cart',
      samsclub: '.checkout, .cart-page'
    };
    
    const selector = checkoutSelectors[this.retailerId as keyof typeof checkoutSelectors];
    return selector ? !!document.querySelector(selector) : false;
  }

  private onCheckoutPageDetected(): void {
    log('info', 'Checkout page detected');
    // This will be expanded in the next task for automated checkout
  }
}

// Initialize content script
new ContentScript();