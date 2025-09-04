// DOM Caching System for Performance Optimization
import { RetailerId, Product } from '../shared/types';
import { debounce, log } from '../shared/utils';
import { RetailerStrategy, RetailerStrategyFactory } from './retailer-strategies';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

class DOMCache {
  private cache = new Map<string, CacheEntry<Element | null | NodeListOf<Element>>>();
  private defaultTTL = 5000; // 5 seconds
  private observers = new Map<string, MutationObserver>();

  constructor(defaultTTL = 5000) {
    this.defaultTTL = defaultTTL;
  }

  querySelector(selector: string, ttl = this.defaultTTL): Element | null {
    const cached = this.getFromCache(selector) as Element | null | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const element = document.querySelector(selector);
    this.setCache(selector, element, ttl);
    
    // Set up mutation observer for this selector if element exists
    if (element) {
      this.setupMutationObserver(selector, element);
    }

    return element;
  }

  querySelectorAll(selector: string, ttl = this.defaultTTL): NodeListOf<Element> {
    // For querySelectorAll, we'll use a different caching strategy
    const cacheKey = `all:${selector}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached !== undefined) {
      return cached as NodeListOf<Element>;
    }

    const elements = document.querySelectorAll(selector);
    this.setCache(cacheKey, elements as any, ttl);
    
    return elements;
  }

  invalidate(selector: string): void {
    this.cache.delete(selector);
    this.cache.delete(`all:${selector}`);
    
    // Clean up mutation observer
    const observer = this.observers.get(selector);
    if (observer) {
      observer.disconnect();
      this.observers.delete(selector);
    }
  }

  invalidateAll(): void {
    this.cache.clear();
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }

  private getFromCache(key: string): Element | NodeListOf<Element> | null | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  private setCache(key: string, value: Element | null | NodeListOf<Element>, ttl: number): void {
    this.cache.set(key, {
      value: value as Element | null,
      timestamp: Date.now(),
      ttl
    });

    // Auto-cleanup after TTL
    setTimeout(() => {
      this.cache.delete(key);
    }, ttl);
  }

  private setupMutationObserver(selector: string, element: Element): void {
    // Don't create duplicate observers
    if (this.observers.has(selector)) return;

    const observer = new MutationObserver(() => {
      // Invalidate cache when DOM changes
      this.invalidate(selector);
    });

    // Observe the parent element for changes
    const parent = element.parentElement || document.body;
    observer.observe(parent, {
      childList: true,
      subtree: true,
      attributes: true
    });

    this.observers.set(selector, observer);
  }

  // Cleanup method
  destroy(): void {
    this.invalidateAll();
  }
}

// Enhanced ProductDetector with DOM Caching
class CachedProductDetector {
  private strategy: RetailerStrategy;
  private domCache: DOMCache;

  constructor(retailerId: RetailerId) {
    this.strategy = RetailerStrategyFactory.createStrategy(retailerId);
    this.domCache = new DOMCache(3000); // 3 second cache for product pages
  }

  startMonitoring(): void {
    const observer = new MutationObserver(debounce(() => {
      // Invalidate cache on major DOM changes
      this.domCache.invalidateAll();
      
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
    const selectors = this.strategy.getProductSelectors();
    return !!this.domCache.querySelector(selectors.title);
  }

  detectProduct(): Product | null {
    const selectors = this.strategy.getProductSelectors();
    
    // Use cached DOM queries
    const titleEl = this.domCache.querySelector(selectors.title);
    const priceEl = this.domCache.querySelector(selectors.price);
    const skuEl = selectors.sku ? this.domCache.querySelector(selectors.sku) : null;
    const imageEl = selectors.image ? this.domCache.querySelector(selectors.image) : null;
    
    if (!titleEl) return null;
    
    return {
      id: this.generateProductId(),
      name: titleEl.textContent?.trim() || '',
      sku: skuEl?.textContent?.trim() || '',
      upc: '',
      category: 'pokemon-tcg',
      set: '',
      price: this.extractPrice(priceEl?.textContent || ''),
      imageUrl: (imageEl as HTMLImageElement)?.src || ''
    };
  }

  getProductContainer(): Element | null {
    // This will be implemented by the strategy
    return this.strategy.getProductContainer();
  }

  private generateProductId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private extractPrice(priceText: string): number {
    const match = priceText.match(/\$?(\d+(?:\.\d{2})?)/);
    return match && match[1] ? parseFloat(match[1]) : 0;
  }

  private onProductPageDetected(): void {
    log('info', 'Product page detected');
  }

  // Cleanup method
  destroy(): void {
    this.domCache.destroy();
  }
}

// Usage with automatic cleanup
class ContentScriptWithCache {
  private cachedProductDetector: CachedProductDetector | null = null;

  constructor(retailerId: RetailerId) {
    this.cachedProductDetector = new CachedProductDetector(retailerId);
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      this.cachedProductDetector?.destroy();
    });
  }
}
