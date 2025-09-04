// Strategy Pattern Implementation for Retailer-Specific Logic
import { RetailerId, Product } from '../shared/types';
import { debounce, log } from '../shared/utils';

export interface RetailerStrategy {
  detectProduct(): Product | null;
  getProductSelectors(): ProductSelectors;
  getCheckoutSelectors(): CheckoutSelectors;
  getProductContainer(): Element | null;
  isProductPage(): boolean;
  isCheckoutPage(): boolean;
}

interface ProductSelectors {
  title: string;
  price: string;
  sku?: string;
  image?: string;
}

interface CheckoutSelectors {
  page: string;
  cartButton?: string;
  checkoutButton?: string;
}

// Base Strategy with Common Logic
export abstract class BaseRetailerStrategy implements RetailerStrategy {
  protected extractPrice(priceText: string): number {
    const match = priceText.match(/\$?(\d+(?:\.\d{2})?)/);
    return match && match[1] ? parseFloat(match[1]) : 0;
  }

  protected generateProductId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  abstract detectProduct(): Product | null;
  abstract getProductSelectors(): ProductSelectors;
  abstract getCheckoutSelectors(): CheckoutSelectors;
  abstract getProductContainer(): Element | null;

  isProductPage(): boolean {
    const selectors = this.getProductSelectors();
    return !!document.querySelector(selectors.title);
  }

  isCheckoutPage(): boolean {
    const selectors = this.getCheckoutSelectors();
    return !!document.querySelector(selectors.page);
  }
}

// Best Buy Strategy
class BestBuyStrategy extends BaseRetailerStrategy {
  getProductSelectors(): ProductSelectors {
    return {
      title: '.sku-title, .sr-product-title',
      price: '.pricing-price__range .sr-only, .visuallyhidden',
      sku: '.product-data-value',
      image: '.primary-image img'
    };
  }

  getCheckoutSelectors(): CheckoutSelectors {
    return {
      page: '.checkout, [data-testid="checkout"]',
      cartButton: '.add-to-cart-button',
      checkoutButton: '.btn-primary[data-testid="checkout-button"]'
    };
  }

  getProductContainer(): Element | null {
    return document.querySelector('.pricing-price__range, .sr-product-details');
  }

  detectProduct(): Product | null {
    const selectors = this.getProductSelectors();
    const titleEl = document.querySelector(selectors.title);
    const priceEl = document.querySelector(selectors.price);
    const skuEl = document.querySelector(selectors.sku || '');
    
    if (!titleEl) return null;
    
    return {
      id: this.generateProductId(),
      name: titleEl.textContent?.trim() || '',
      sku: skuEl?.textContent?.trim() || '',
      upc: '',
      category: 'pokemon-tcg',
      set: '',
      price: this.extractPrice(priceEl?.textContent || ''),
      imageUrl: ''
    };
  }
}

// Walmart Strategy
class WalmartStrategy extends BaseRetailerStrategy {
  getProductSelectors(): ProductSelectors {
    return {
      title: '.product-title, [data-testid="product-title"]',
      price: '[data-testid="price-current"], .price-current',
      image: '[data-testid="hero-image"] img'
    };
  }

  getCheckoutSelectors(): CheckoutSelectors {
    return {
      page: '.checkout, .cart-page',
      cartButton: '[data-testid="add-to-cart"]',
      checkoutButton: '[data-testid="checkout-button"]'
    };
  }

  getProductContainer(): Element | null {
    return document.querySelector('.price-group, .product-details');
  }

  detectProduct(): Product | null {
    const selectors = this.getProductSelectors();
    const titleEl = document.querySelector(selectors.title);
    const priceEl = document.querySelector(selectors.price);
    
    if (!titleEl) return null;
    
    return {
      id: this.generateProductId(),
      name: titleEl.textContent?.trim() || '',
      sku: '',
      upc: '',
      category: 'pokemon-tcg',
      set: '',
      price: this.extractPrice(priceEl?.textContent || ''),
      imageUrl: ''
    };
  }
}

// Costco Strategy
class CostcoStrategy extends BaseRetailerStrategy {
  getProductSelectors(): ProductSelectors {
    return {
      title: '.product-h1, .product-title',
      price: '.product-price .price, .price-current',
      image: '.product-image-main img'
    };
  }

  getCheckoutSelectors(): CheckoutSelectors {
    return {
      page: '.checkout, .cart',
      cartButton: '.add-to-cart',
      checkoutButton: '.checkout-button'
    };
  }

  getProductContainer(): Element | null {
    return document.querySelector('.product-price, .product-info-main');
  }

  detectProduct(): Product | null {
    const selectors = this.getProductSelectors();
    const titleEl = document.querySelector(selectors.title);
    const priceEl = document.querySelector(selectors.price);
    
    if (!titleEl) return null;
    
    return {
      id: this.generateProductId(),
      name: titleEl.textContent?.trim() || '',
      sku: '',
      upc: '',
      category: 'pokemon-tcg',
      set: '',
      price: this.extractPrice(priceEl?.textContent || ''),
      imageUrl: ''
    };
  }
}

// Sam's Club Strategy
class SamsClubStrategy extends BaseRetailerStrategy {
  getProductSelectors(): ProductSelectors {
    return {
      title: '.product-title, .item-title',
      price: '.price, .price-current',
      image: '.product-image img'
    };
  }

  getCheckoutSelectors(): CheckoutSelectors {
    return {
      page: '.checkout, .cart-page',
      cartButton: '.add-to-cart-button',
      checkoutButton: '.checkout-btn'
    };
  }

  getProductContainer(): Element | null {
    return document.querySelector('.price, .product-details');
  }

  detectProduct(): Product | null {
    const selectors = this.getProductSelectors();
    const titleEl = document.querySelector(selectors.title);
    const priceEl = document.querySelector(selectors.price);
    
    if (!titleEl) return null;
    
    return {
      id: this.generateProductId(),
      name: titleEl.textContent?.trim() || '',
      sku: '',
      upc: '',
      category: 'pokemon-tcg',
      set: '',
      price: this.extractPrice(priceEl?.textContent || ''),
      imageUrl: ''
    };
  }
}

// Strategy Factory
export class RetailerStrategyFactory {
  static createStrategy(retailerId: RetailerId): RetailerStrategy {
    const strategies = {
      bestbuy: () => new BestBuyStrategy(),
      walmart: () => new WalmartStrategy(),
      costco: () => new CostcoStrategy(),
      samsclub: () => new SamsClubStrategy()
    };

    const strategyFactory = strategies[retailerId];
    if (!strategyFactory) {
      throw new Error(`Unsupported retailer: ${retailerId}`);
    }

    return strategyFactory();
  }
}

// Updated ProductDetector using Strategy Pattern
export class StrategyBasedProductDetector {
  private strategy: RetailerStrategy;

  constructor(retailerId: RetailerId) {
    this.strategy = RetailerStrategyFactory.createStrategy(retailerId);
  }

  startMonitoring(): void {
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
    return this.strategy.isProductPage();
  }

  detectProduct(): Product | null {
    return this.strategy.detectProduct();
  }

  getProductContainer(): Element | null {
    return this.strategy.getProductContainer();
  }

  private onProductPageDetected(): void {
    log('info', 'Product page detected');
  }
}

// Usage Example:
// const productDetector = new StrategyBasedProductDetector('bestbuy');
// const product = productDetector.detectProduct();
