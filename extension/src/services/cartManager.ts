// Cart management service for BoosterBeacon browser extension
// Handles automatic add-to-cart functionality and cart monitoring

import { 
  RetailerId, 
  Product,
  STORAGE_KEYS
} from '../shared/types';
import { 
  getStorageData, 
  setStorageData,
  log, 
  getCurrentRetailer 
} from '../shared/utils';

export interface CartItem {
  productId: string;
  productName: string;
  sku?: string;
  price: number;
  quantity: number;
  retailerId: RetailerId;
  addedAt: number;
  cartUrl?: string;
}

export interface CartState {
  items: CartItem[];
  totalItems: number;
  totalValue: number;
  lastUpdated: number;
}

export interface AddToCartResult {
  success: boolean;
  cartItem?: CartItem;
  error?: string;
  cartUrl?: string;
}

export class CartManager {
  private retailerId: RetailerId;
  private cartState: CartState | null = null;

  constructor(retailerId: RetailerId) {
    this.retailerId = retailerId;
  }

  /**
   * Initialize the cart manager
   */
  async initialize(): Promise<void> {
    this.cartState = await this.loadCartState();
    log('info', `Cart manager initialized for ${this.retailerId}`);
  }

  /**
   * Add a product to the cart automatically
   */
  async addToCart(product: Product, quantity: number = 1): Promise<AddToCartResult> {
    try {
      log('info', `Adding ${product.name} to cart (quantity: ${quantity})`);

      // Check if we're on the correct product page
      if (!this.isProductPage(product)) {
        // Navigate to product page first
        await this.navigateToProduct(product);
      }

      // Wait for page to load
      await this.waitForPageLoad();

      // Set quantity if different from default
      if (quantity > 1) {
        await this.setQuantity(quantity);
      }

      // Find and click add to cart button
      const addToCartButton = await this.findAddToCartButton();
      if (!addToCartButton) {
        throw new Error('Add to cart button not found');
      }

      // Check if product is in stock
      if (!await this.isProductInStock()) {
        throw new Error('Product is out of stock');
      }

      // Click the add to cart button
      await this.clickAddToCartButton(addToCartButton);

      // Wait for cart update
      await this.waitForCartUpdate();

      // Verify item was added
      const cartItem = await this.verifyItemAdded(product, quantity);
      if (!cartItem) {
        throw new Error('Failed to verify item was added to cart');
      }

      // Update local cart state
      await this.updateCartState(cartItem);

      // Get cart URL for quick access
      const cartUrl = await this.getCartUrl();

      log('info', `Successfully added ${product.name} to cart`);

      return {
        success: true,
        cartItem,
        cartUrl
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log('error', `Failed to add ${product.name} to cart: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Remove an item from the cart
   */
  async removeFromCart(productId: string): Promise<boolean> {
    try {
      // Navigate to cart page
      await this.navigateToCart();

      // Find remove button for the specific product
      const removeButton = await this.findRemoveButton(productId);
      if (!removeButton) {
        throw new Error('Remove button not found');
      }

      // Click remove button
      (removeButton as HTMLElement).click();

      // Wait for cart update
      await this.waitForCartUpdate();

      // Update local cart state
      await this.removeFromCartState(productId);

      log('info', `Removed product ${productId} from cart`);
      return true;

    } catch (error) {
      log('error', `Failed to remove product from cart: ${error}`);
      return false;
    }
  }

  /**
   * Get current cart state
   */
  async getCartState(): Promise<CartState> {
    if (!this.cartState) {
      this.cartState = await this.loadCartState();
    }
    return this.cartState;
  }

  /**
   * Refresh cart state from the website
   */
  async refreshCartState(): Promise<CartState> {
    try {
      // Navigate to cart page to get current state
      await this.navigateToCart();
      
      // Parse cart items from the page
      const items = await this.parseCartItems();
      
      // Calculate totals
      const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
      const totalValue = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      this.cartState = {
        items,
        totalItems,
        totalValue,
        lastUpdated: Date.now()
      };
      
      // Save updated state
      await this.saveCartState();
      
      log('info', `Cart state refreshed: ${totalItems} items, $${totalValue.toFixed(2)}`);
      return this.cartState;

    } catch (error) {
      log('error', 'Failed to refresh cart state', error);
      return this.cartState || { items: [], totalItems: 0, totalValue: 0, lastUpdated: Date.now() };
    }
  }

  /**
   * Clear all items from cart
   */
  async clearCart(): Promise<boolean> {
    try {
      await this.navigateToCart();
      
      // Find and click clear cart button or remove all items
      const clearButton = await this.findClearCartButton();
      if (clearButton) {
        (clearButton as HTMLElement).click();
        await this.waitForCartUpdate();
      } else {
        // Remove items one by one
        const items = await this.parseCartItems();
        for (const item of items) {
          await this.removeFromCart(item.productId);
        }
      }

      // Reset local cart state
      this.cartState = {
        items: [],
        totalItems: 0,
        totalValue: 0,
        lastUpdated: Date.now()
      };
      
      await this.saveCartState();
      
      log('info', 'Cart cleared successfully');
      return true;

    } catch (error) {
      log('error', 'Failed to clear cart', error);
      return false;
    }
  }

  /**
   * Navigate to cart page
   */
  async navigateToCart(): Promise<void> {
    const cartUrl = this.getCartPageUrl();
    if (window.location.href !== cartUrl) {
      window.location.href = cartUrl;
      await this.waitForPageLoad();
    }
  }

  // Private helper methods

  private async navigateToProduct(product: Product): Promise<void> {
    // This would need product URL - in a real implementation, 
    // this would be stored with the product data
    const productUrl = this.constructProductUrl(product);
    window.location.href = productUrl;
    await this.waitForPageLoad();
  }

  private constructProductUrl(product: Product): string {
    // Construct product URL based on retailer and product data
    const baseUrls = {
      bestbuy: 'https://www.bestbuy.com/site/',
      walmart: 'https://www.walmart.com/ip/',
      costco: 'https://www.costco.com/product/',
      samsclub: 'https://www.samsclub.com/p/'
    };
    
    // This is a simplified implementation - real URLs would be more complex
    return `${baseUrls[this.retailerId]}${product.sku || product.id}`;
  }

  private isProductPage(product: Product): boolean {
    // Check if current page matches the product
    const url = window.location.href;
    return url.includes(product.sku || product.id);
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

  private async setQuantity(quantity: number): Promise<void> {
    const quantitySelector = this.getQuantitySelector();
    const quantityField = document.querySelector(quantitySelector) as HTMLInputElement;
    
    if (quantityField) {
      quantityField.value = quantity.toString();
      quantityField.dispatchEvent(new Event('change', { bubbles: true }));
      await this.delay(500);
    }
  }

  private async findAddToCartButton(): Promise<Element | null> {
    const selector = this.getAddToCartSelector();
    return this.waitForElement(selector, 5000);
  }

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
    
    // If no clear indicators, assume in stock if add to cart button exists
    return !!(await this.findAddToCartButton());
  }

  private async clickAddToCartButton(button: Element): Promise<void> {
    // Scroll button into view
    button.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.delay(500);
    
    // Click the button
    (button as HTMLElement).click();
  }

  private async waitForCartUpdate(): Promise<void> {
    // Wait for cart update indicators
    const updateSelectors = this.getCartUpdateSelectors();
    
    // Wait for loading indicator to appear and disappear
    await this.delay(1000);
    
    // Wait for success message or cart count update
    await this.waitForElement(updateSelectors.success, 3000);
  }

  private async verifyItemAdded(product: Product, quantity: number): Promise<CartItem | null> {
    // Check cart count or navigate to cart to verify
    const cartCount = await this.getCartItemCount();
    
    if (cartCount > 0) {
      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        price: product.price,
        quantity,
        retailerId: this.retailerId,
        addedAt: Date.now()
      };
    }
    
    return null;
  }

  private async getCartItemCount(): Promise<number> {
    const countSelector = this.getCartCountSelector();
    const countElement = document.querySelector(countSelector);
    
    if (countElement) {
      const countText = countElement.textContent || '0';
      return parseInt(countText.replace(/\D/g, ''), 10) || 0;
    }
    
    return 0;
  }

  private async getCartUrl(): Promise<string> {
    return this.getCartPageUrl();
  }

  private getCartPageUrl(): string {
    const cartUrls = {
      bestbuy: 'https://www.bestbuy.com/cart',
      walmart: 'https://www.walmart.com/cart',
      costco: 'https://www.costco.com/CheckoutCartDisplayView',
      samsclub: 'https://www.samsclub.com/cart'
    };
    return cartUrls[this.retailerId];
  }

  private async parseCartItems(): Promise<CartItem[]> {
    const items: CartItem[] = [];
    const itemSelectors = this.getCartItemSelectors();
    
    const itemElements = document.querySelectorAll(itemSelectors.container);
    
    for (const element of Array.from(itemElements)) {
      try {
        const nameElement = element.querySelector(itemSelectors.name);
        const priceElement = element.querySelector(itemSelectors.price);
        const quantityElement = element.querySelector(itemSelectors.quantity);
        
        if (nameElement && priceElement) {
          const item: CartItem = {
            productId: this.extractProductId(element),
            productName: nameElement.textContent?.trim() || '',
            price: this.extractPrice(priceElement.textContent || ''),
            quantity: this.extractQuantity(quantityElement?.textContent || '1'),
            retailerId: this.retailerId,
            addedAt: Date.now()
          };
          
          items.push(item);
        }
      } catch (error) {
        log('warn', 'Failed to parse cart item', error);
      }
    }
    
    return items;
  }

  private extractProductId(element: Element): string {
    // Try to extract product ID from data attributes or URLs
    const dataId = element.getAttribute('data-product-id') || 
                   element.getAttribute('data-sku') ||
                   element.getAttribute('data-item-id');
    
    if (dataId) return dataId;
    
    // Fallback: generate ID from product name
    const nameElement = element.querySelector(this.getCartItemSelectors().name);
    const name = nameElement?.textContent?.trim() || '';
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  private extractPrice(priceText: string): number {
    const match = priceText.match(/\$?(\d+(?:\.\d{2})?)/);
    return match ? parseFloat(match[1]) : 0;
  }

  private extractQuantity(quantityText: string): number {
    const match = quantityText.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }

  private async findRemoveButton(productId: string): Promise<Element | null> {
    // This would need to find the remove button for a specific product
    const removeSelector = this.getRemoveButtonSelector() || '';
    return document.querySelector(removeSelector);
  }

  private async findClearCartButton(): Promise<Element | null> {
    const clearSelector = this.getClearCartSelector() || '';
    return document.querySelector(clearSelector);
  }

  private async waitForElement(selector: string, timeout: number): Promise<Element | null> {
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

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Retailer-specific selector methods

  private getAddToCartSelector(): string {
    const selectors = {
      bestbuy: '.add-to-cart-button, .btn-primary[data-track="Add to Cart"]',
      walmart: '[data-automation-id="add-to-cart-button"]',
      costco: '.add-to-cart-btn, .btn-add-to-cart',
      samsclub: '[data-testid="add-to-cart-button"]'
    };
    return selectors[this.retailerId];
  }

  private getQuantitySelector(): string {
    const selectors = {
      bestbuy: '.quantity-input, input[name="quantity"]',
      walmart: '[data-automation-id="quantity-stepper-input"]',
      costco: '.quantity-input, input[name="qty"]',
      samsclub: '[data-testid="quantity-input"]'
    };
    return selectors[this.retailerId];
  }

  private getCartCountSelector(): string {
    const selectors = {
      bestbuy: '.cart-count, .cart-item-count',
      walmart: '[data-automation-id="cart-count"]',
      costco: '.cart-count, .minicart-quantity',
      samsclub: '[data-testid="cart-count"]'
    };
    return selectors[this.retailerId];
  }

  private getStockSelectors() {
    return {
      inStock: {
        bestbuy: ['.fulfillment-add-to-cart-button', '.btn-primary:not([disabled])'],
        walmart: ['[data-automation-id="add-to-cart-button"]:not([disabled])'],
        costco: ['.add-to-cart-btn:not([disabled])'],
        samsclub: ['[data-testid="add-to-cart-button"]:not([disabled])']
      }[this.retailerId],
      outOfStock: {
        bestbuy: ['.btn-disabled', '.sold-out', '.unavailable'],
        walmart: ['.out-of-stock', '[data-automation-id="out-of-stock"]'],
        costco: ['.out-of-stock', '.unavailable'],
        samsclub: ['.out-of-stock', '[data-testid="out-of-stock"]']
      }[this.retailerId]
    };
  }

  private getCartUpdateSelectors() {
    const selectors = {
      bestbuy: {
        success: '.cart-success-message, .added-to-cart'
      },
      walmart: {
        success: '[data-automation-id="cart-success-message"]'
      },
      costco: {
        success: '.cart-success, .added-to-cart'
      },
      samsclub: {
        success: '[data-testid="cart-success-message"]'
      }
    };
    return selectors[this.retailerId];
  }

  private getCartItemSelectors() {
    const selectors = {
      bestbuy: {
        container: '.cart-item, .line-item',
        name: '.product-title, .item-title',
        price: '.item-price, .price',
        quantity: '.quantity-input, .qty'
      },
      walmart: {
        container: '[data-automation-id="cart-item"]',
        name: '[data-automation-id="product-title"]',
        price: '[data-automation-id="product-price"]',
        quantity: '[data-automation-id="quantity"]'
      },
      costco: {
        container: '.cart-item, .line-item',
        name: '.product-title, .item-name',
        price: '.item-price, .price',
        quantity: '.quantity, .qty'
      },
      samsclub: {
        container: '[data-testid="cart-item"]',
        name: '[data-testid="product-title"]',
        price: '[data-testid="product-price"]',
        quantity: '[data-testid="quantity"]'
      }
    };
    return selectors[this.retailerId];
  }

  private getRemoveButtonSelector(): string {
    const selectors = {
      bestbuy: '.remove-item, .btn-remove',
      walmart: '[data-automation-id="remove-item"]',
      costco: '.remove-item, .btn-remove',
      samsclub: '[data-testid="remove-item"]'
    };
    return selectors[this.retailerId];
  }

  private getClearCartSelector(): string {
    const selectors = {
      bestbuy: '.clear-cart, .remove-all',
      walmart: '[data-automation-id="clear-cart"]',
      costco: '.clear-cart, .empty-cart',
      samsclub: '[data-testid="clear-cart"]'
    };
    return selectors[this.retailerId];
  }

  // Cart state management

  private async loadCartState(): Promise<CartState> {
    const storageKey = `${STORAGE_KEYS.USER}_cart_${this.retailerId}`;
    const saved = await getStorageData<CartState>(storageKey);
    
    return saved || {
      items: [],
      totalItems: 0,
      totalValue: 0,
      lastUpdated: Date.now()
    };
  }

  private async saveCartState(): Promise<void> {
    if (this.cartState) {
      const storageKey = `${STORAGE_KEYS.USER}_cart_${this.retailerId}`;
      await setStorageData(storageKey, this.cartState);
    }
  }

  private async updateCartState(newItem: CartItem): Promise<void> {
    if (!this.cartState) {
      this.cartState = await this.loadCartState();
    }

    // Check if item already exists
    const existingIndex = this.cartState.items.findIndex(item => item.productId === newItem.productId);
    
    if (existingIndex >= 0) {
      // Update existing item
      this.cartState.items[existingIndex] = newItem;
    } else {
      // Add new item
      this.cartState.items.push(newItem);
    }

    // Recalculate totals
    this.cartState.totalItems = this.cartState.items.reduce((sum, item) => sum + item.quantity, 0);
    this.cartState.totalValue = this.cartState.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    this.cartState.lastUpdated = Date.now();

    await this.saveCartState();
  }

  private async removeFromCartState(productId: string): Promise<void> {
    if (!this.cartState) return;

    this.cartState.items = this.cartState.items.filter(item => item.productId !== productId);
    
    // Recalculate totals
    this.cartState.totalItems = this.cartState.items.reduce((sum, item) => sum + item.quantity, 0);
    this.cartState.totalValue = this.cartState.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    this.cartState.lastUpdated = Date.now();

    await this.saveCartState();
  }
}
