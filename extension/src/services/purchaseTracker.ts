// Purchase tracking service for BoosterBeacon browser extension
// Tracks successful purchases and provides analytics

import { 
  RetailerId, 
  Product,
  STORAGE_KEYS
} from '../shared/types';
import { 
  getStorageData, 
  setStorageData,
  log, 
  sendExtensionMessage
} from '../shared/utils';
import { MessageType } from '../shared/types';

export interface Purchase {
  id: string;
  orderId: string;
  retailerId: RetailerId;
  items: PurchaseItem[];
  totalAmount: number;
  purchaseDate: number;
  shippingAddress: string;
  paymentMethod: string;
  status: PurchaseStatus;
  trackingInfo?: TrackingInfo;
  metadata: {
    alertId?: string; // If purchase was triggered by an alert
    automatedCheckout: boolean;
    checkoutDuration?: number; // Time from cart to completion
    source: 'manual' | 'alert' | 'extension';
  };
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface TrackingInfo {
  trackingNumber?: string;
  carrier?: string;
  estimatedDelivery?: number;
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled';
  lastUpdated: number;
}

export enum PurchaseStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export interface PurchaseAnalytics {
  totalPurchases: number;
  totalSpent: number;
  averageOrderValue: number;
  successfulAlerts: number;
  automatedPurchases: number;
  retailerBreakdown: { [key in RetailerId]?: number };
  monthlySpending: { [month: string]: number };
}

export class PurchaseTracker {
  private retailerId: RetailerId;
  private purchases: Purchase[] = [];

  constructor(retailerId: RetailerId) {
    this.retailerId = retailerId;
  }

  /**
   * Initialize the purchase tracker
   */
  async initialize(): Promise<void> {
    this.purchases = await this.loadPurchases();
    log('info', `Purchase tracker initialized for ${this.retailerId} with ${this.purchases.length} purchases`);
  }

  /**
   * Track a successful purchase
   */
  async trackPurchase(
    orderId: string,
    items: PurchaseItem[],
    totalAmount: number,
    metadata: Purchase['metadata']
  ): Promise<Purchase> {
    const purchase: Purchase = {
      id: this.generatePurchaseId(),
      orderId,
      retailerId: this.retailerId,
      items,
      totalAmount,
      purchaseDate: Date.now(),
      shippingAddress: await this.getShippingAddress(),
      paymentMethod: await this.getPaymentMethod(),
      status: PurchaseStatus.PENDING,
      metadata
    };

    // Add to local storage
    this.purchases.push(purchase);
    await this.savePurchases();

    // Send to backend for analytics
    await this.syncPurchaseWithBackend(purchase);

    log('info', `Purchase tracked: ${orderId} - $${totalAmount}`);
    return purchase;
  }

  /**
   * Detect and track purchase from confirmation page
   */
  async detectAndTrackPurchase(alertId?: string): Promise<Purchase | null> {
    try {
      // Check if we're on a confirmation page
      if (!this.isConfirmationPage()) {
        return null;
      }

      // Extract order information from the page
      const orderInfo = await this.extractOrderInfo();
      if (!orderInfo) {
        log('warn', 'Could not extract order information from confirmation page');
        return null;
      }

      // Check if this purchase was already tracked
      const existingPurchase = this.purchases.find(p => p.orderId === orderInfo.orderId);
      if (existingPurchase) {
        log('info', `Purchase ${orderInfo.orderId} already tracked`);
        return existingPurchase;
      }

      // Track the new purchase
      const purchase = await this.trackPurchase(
        orderInfo.orderId,
        orderInfo.items,
        orderInfo.totalAmount,
        {
          alertId,
          automatedCheckout: true,
          source: alertId ? 'alert' : 'extension'
        }
      );

      // Show success notification
      await this.showPurchaseNotification(purchase);

      return purchase;

    } catch (error) {
      log('error', 'Failed to detect and track purchase', error);
      return null;
    }
  }

  /**
   * Update purchase status
   */
  async updatePurchaseStatus(orderId: string, status: PurchaseStatus, trackingInfo?: TrackingInfo): Promise<void> {
    const purchase = this.purchases.find(p => p.orderId === orderId);
    if (!purchase) {
      log('warn', `Purchase not found: ${orderId}`);
      return;
    }

    purchase.status = status;
    if (trackingInfo) {
      purchase.trackingInfo = trackingInfo;
    }

    await this.savePurchases();
    await this.syncPurchaseWithBackend(purchase);

    log('info', `Purchase ${orderId} status updated to ${status}`);
  }

  /**
   * Get purchase analytics
   */
  async getAnalytics(): Promise<PurchaseAnalytics> {
    const analytics: PurchaseAnalytics = {
      totalPurchases: this.purchases.length,
      totalSpent: this.purchases.reduce((sum, p) => sum + p.totalAmount, 0),
      averageOrderValue: 0,
      successfulAlerts: this.purchases.filter(p => p.metadata.alertId).length,
      automatedPurchases: this.purchases.filter(p => p.metadata.automatedCheckout).length,
      retailerBreakdown: {},
      monthlySpending: {}
    };

    // Calculate average order value
    if (analytics.totalPurchases > 0) {
      analytics.averageOrderValue = analytics.totalSpent / analytics.totalPurchases;
    }

    // Calculate retailer breakdown
    for (const purchase of this.purchases) {
      analytics.retailerBreakdown[purchase.retailerId] = 
        (analytics.retailerBreakdown[purchase.retailerId] || 0) + purchase.totalAmount;
    }

    // Calculate monthly spending
    for (const purchase of this.purchases) {
      const monthKey = new Date(purchase.purchaseDate).toISOString().slice(0, 7); // YYYY-MM
      analytics.monthlySpending[monthKey] = 
        (analytics.monthlySpending[monthKey] || 0) + purchase.totalAmount;
    }

    return analytics;
  }

  /**
   * Get all purchases
   */
  async getAllPurchases(): Promise<Purchase[]> {
    return [...this.purchases];
  }

  /**
   * Get purchases by date range
   */
  async getPurchasesByDateRange(startDate: number, endDate: number): Promise<Purchase[]> {
    return this.purchases.filter(p => 
      p.purchaseDate >= startDate && p.purchaseDate <= endDate
    );
  }

  /**
   * Get purchases by status
   */
  async getPurchasesByStatus(status: PurchaseStatus): Promise<Purchase[]> {
    return this.purchases.filter(p => p.status === status);
  }

  /**
   * Delete a purchase record
   */
  async deletePurchase(purchaseId: string): Promise<boolean> {
    const index = this.purchases.findIndex(p => p.id === purchaseId);
    if (index === -1) {
      return false;
    }

    this.purchases.splice(index, 1);
    await this.savePurchases();
    
    log('info', `Purchase ${purchaseId} deleted`);
    return true;
  }

  // Private helper methods

  private generatePurchaseId(): string {
    return `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

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
      if (!orderId) {
        throw new Error('Order ID not found');
      }

      // Extract total amount
      const totalElement = document.querySelector(selectors.total);
      const totalText = totalElement?.textContent?.trim() || '';
      const totalAmount = this.extractPrice(totalText);
      if (totalAmount === 0) {
        throw new Error('Total amount not found');
      }

      // Extract items
      const items = await this.extractOrderItems();

      return {
        orderId,
        items,
        totalAmount
      };

    } catch (error) {
      log('error', 'Failed to extract order info', error);
      return null;
    }
  }

  private async extractOrderItems(): Promise<PurchaseItem[]> {
    const items: PurchaseItem[] = [];
    const selectors = this.getOrderItemSelectors();
    
    const itemElements = document.querySelectorAll(selectors.container);
    
    for (const element of Array.from(itemElements)) {
      try {
        const nameElement = element.querySelector(selectors.name);
        const priceElement = element.querySelector(selectors.price);
        const quantityElement = element.querySelector(selectors.quantity);
        
        if (nameElement && priceElement) {
          const productName = nameElement.textContent?.trim() || '';
          const unitPrice = this.extractPrice(priceElement.textContent || '');
          const quantity = this.extractQuantity(quantityElement?.textContent || '1');
          
          const item: PurchaseItem = {
            productId: this.generateProductId(productName),
            productName,
            quantity,
            unitPrice,
            totalPrice: unitPrice * quantity
          };
          
          items.push(item);
        }
      } catch (error) {
        log('warn', 'Failed to extract order item', error);
      }
    }
    
    return items;
  }

  private extractPrice(priceText: string): number {
    const match = priceText.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (match) {
      return parseFloat(match[1].replace(/,/g, ''));
    }
    return 0;
  }

  private extractQuantity(quantityText: string): number {
    const match = quantityText.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }

  private generateProductId(productName: string): string {
    return productName.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 50);
  }

  private async getShippingAddress(): Promise<string> {
    // Try to extract from confirmation page or use stored address
    const addressElement = document.querySelector(this.getShippingAddressSelector());
    return addressElement?.textContent?.trim() || 'Address not available';
  }

  private async getPaymentMethod(): Promise<string> {
    // Try to extract from confirmation page or use stored method
    const paymentElement = document.querySelector(this.getPaymentMethodSelector());
    const paymentText = paymentElement?.textContent?.trim() || '';
    
    // Extract last 4 digits or payment type
    const match = paymentText.match(/\*+(\d{4})|([A-Za-z]+)/);
    return match ? (match[1] ? `****${match[1]}` : match[2]) : 'Payment method not available';
  }

  private async showPurchaseNotification(purchase: Purchase): Promise<void> {
    await sendExtensionMessage({
      type: MessageType.SHOW_NOTIFICATION,
      payload: {
        title: 'Purchase Tracked!',
        message: `Order ${purchase.orderId} - $${purchase.totalAmount.toFixed(2)}`,
        type: 'success'
      }
    });
  }

  private async syncPurchaseWithBackend(purchase: Purchase): Promise<void> {
    try {
      // Send purchase data to BoosterBeacon backend for analytics
      await sendExtensionMessage({
        type: MessageType.SYNC_DATA,
        payload: {
          type: 'purchase',
          data: purchase
        }
      });
    } catch (error) {
      log('warn', 'Failed to sync purchase with backend', error);
    }
  }

  // Retailer-specific selector methods

  private getConfirmationPageSelectors(): string[] {
    const selectors = {
      bestbuy: [
        '.order-confirmation',
        '.thank-you-page',
        '.order-complete'
      ],
      walmart: [
        '[data-testid="order-confirmation"]',
        '.order-success',
        '.thank-you'
      ],
      costco: [
        '.order-confirmation',
        '.order-complete',
        '.thank-you-page'
      ],
      samsclub: [
        '[data-testid="order-confirmation"]',
        '.order-success',
        '.confirmation-page'
      ]
    };
    return selectors[this.retailerId];
  }

  private getConfirmationUrlPatterns(): string[] {
    const patterns = {
      bestbuy: ['confirmation', 'order-complete', 'thank-you'],
      walmart: ['confirmation', 'order-placed', 'thank-you'],
      costco: ['orderconfirmation', 'order-complete'],
      samsclub: ['confirmation', 'order-success', 'thank-you']
    };
    return patterns[this.retailerId];
  }

  private getOrderInfoSelectors() {
    const selectors = {
      bestbuy: {
        orderId: '.order-number, .confirmation-number',
        total: '.order-total, .total-amount'
      },
      walmart: {
        orderId: '[data-testid="order-number"]',
        total: '[data-testid="order-total"]'
      },
      costco: {
        orderId: '.order-number, .confirmation-number',
        total: '.order-total, .total-price'
      },
      samsclub: {
        orderId: '[data-testid="order-number"]',
        total: '[data-testid="order-total"]'
      }
    };
    return selectors[this.retailerId];
  }

  private getOrderItemSelectors() {
    const selectors = {
      bestbuy: {
        container: '.order-item, .line-item',
        name: '.product-title, .item-name',
        price: '.item-price, .price',
        quantity: '.quantity, .qty'
      },
      walmart: {
        container: '[data-testid="order-item"]',
        name: '[data-testid="product-title"]',
        price: '[data-testid="item-price"]',
        quantity: '[data-testid="quantity"]'
      },
      costco: {
        container: '.order-item, .line-item',
        name: '.product-title, .item-name',
        price: '.item-price, .price',
        quantity: '.quantity, .qty'
      },
      samsclub: {
        container: '[data-testid="order-item"]',
        name: '[data-testid="product-title"]',
        price: '[data-testid="item-price"]',
        quantity: '[data-testid="quantity"]'
      }
    };
    return selectors[this.retailerId];
  }

  private getShippingAddressSelector(): string {
    const selectors = {
      bestbuy: '.shipping-address, .delivery-address',
      walmart: '[data-testid="shipping-address"]',
      costco: '.shipping-address, .delivery-info',
      samsclub: '[data-testid="shipping-address"]'
    };
    return selectors[this.retailerId];
  }

  private getPaymentMethodSelector(): string {
    const selectors = {
      bestbuy: '.payment-method, .payment-info',
      walmart: '[data-testid="payment-method"]',
      costco: '.payment-method, .payment-info',
      samsclub: '[data-testid="payment-method"]'
    };
    return selectors[this.retailerId];
  }

  // Storage methods

  private async loadPurchases(): Promise<Purchase[]> {
    const storageKey = `${STORAGE_KEYS.USER}_purchases`;
    const saved = await getStorageData<Purchase[]>(storageKey);
    return saved || [];
  }

  private async savePurchases(): Promise<void> {
    const storageKey = `${STORAGE_KEYS.USER}_purchases`;
    await setStorageData(storageKey, this.purchases);
  }

  /**
   * Export purchase data for backup
   */
  async exportPurchases(): Promise<string> {
    const exportData = {
      version: '1.0',
      timestamp: Date.now(),
      purchases: this.purchases
    };
    return btoa(JSON.stringify(exportData));
  }

  /**
   * Import purchase data from backup
   */
  async importPurchases(exportedData: string): Promise<void> {
    try {
      const data = JSON.parse(atob(exportedData));
      
      if (data.version !== '1.0') {
        throw new Error('Unsupported backup version');
      }
      
      this.purchases = data.purchases || [];
      await this.savePurchases();
      
      log('info', `Imported ${this.purchases.length} purchases`);
    } catch (error) {
      log('error', 'Failed to import purchases', error);
      throw new Error('Invalid backup data');
    }
  }

  /**
   * Clear all purchase data
   */
  async clearAllPurchases(): Promise<void> {
    this.purchases = [];
    await this.savePurchases();
    log('info', 'All purchase data cleared');
  }
}
