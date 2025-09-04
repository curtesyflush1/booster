// Centralized Configuration Management
import type { RetailerId } from '../shared/types';

interface RetailerConfig {
  name: string;
  selectors: {
    product: {
      title: string;
      price: string;
      sku?: string;
      image?: string;
      container?: string;
    };
    checkout: {
      page: string;
      cartButton?: string;
      checkoutButton?: string;
    };
  };
  features: {
    supportsAutomation: boolean;
    hasOfficialAPI: boolean;
    requiresPoliteDelay: boolean;
    maxRetries: number;
  };
  delays: {
    politeDelay: number;
    retryDelay: number;
    cacheTimeout: number;
  };
  limits: {
    maxRequestsPerMinute: number;
    maxConcurrentRequests: number;
  };
}

const RETAILER_CONFIG: Record<RetailerId, RetailerConfig> = {
  bestbuy: {
    name: 'Best Buy',
    selectors: {
      product: {
        title: '.sku-title, .sr-product-title',
        price: '.pricing-price__range .sr-only, .visuallyhidden',
        sku: '.product-data-value',
        image: '.primary-image img',
        container: '.pricing-price__range, .sr-product-details'
      },
      checkout: {
        page: '.checkout, [data-testid="checkout"]',
        cartButton: '.add-to-cart-button',
        checkoutButton: '.btn-primary[data-testid="checkout-button"]'
      }
    },
    features: {
      supportsAutomation: true,
      hasOfficialAPI: true,
      requiresPoliteDelay: false,
      maxRetries: 3
    },
    delays: {
      politeDelay: 1000,
      retryDelay: 2000,
      cacheTimeout: 5000
    },
    limits: {
      maxRequestsPerMinute: 60,
      maxConcurrentRequests: 5
    }
  },
  walmart: {
    name: 'Walmart',
    selectors: {
      product: {
        title: '.product-title, [data-testid="product-title"]',
        price: '[data-testid="price-current"], .price-current',
        image: '[data-testid="hero-image"] img',
        container: '.price-group, .product-details'
      },
      checkout: {
        page: '.checkout, .cart-page',
        cartButton: '[data-testid="add-to-cart"]',
        checkoutButton: '[data-testid="checkout-button"]'
      }
    },
    features: {
      supportsAutomation: true,
      hasOfficialAPI: true,
      requiresPoliteDelay: false,
      maxRetries: 3
    },
    delays: {
      politeDelay: 1000,
      retryDelay: 2000,
      cacheTimeout: 5000
    },
    limits: {
      maxRequestsPerMinute: 60,
      maxConcurrentRequests: 5
    }
  },
  costco: {
    name: 'Costco',
    selectors: {
      product: {
        title: '.product-h1, .product-title',
        price: '.product-price .price, .price-current',
        image: '.product-image-main img',
        container: '.product-price, .product-info-main'
      },
      checkout: {
        page: '.checkout, .cart',
        cartButton: '.add-to-cart',
        checkoutButton: '.checkout-button'
      }
    },
    features: {
      supportsAutomation: false, // Requires more careful handling
      hasOfficialAPI: false,
      requiresPoliteDelay: true,
      maxRetries: 2
    },
    delays: {
      politeDelay: 2000, // More conservative for scraping
      retryDelay: 5000,
      cacheTimeout: 3000
    },
    limits: {
      maxRequestsPerMinute: 30,
      maxConcurrentRequests: 2
    }
  },
  samsclub: {
    name: "Sam's Club",
    selectors: {
      product: {
        title: '.product-title, .item-title',
        price: '.price, .price-current',
        image: '.product-image img',
        container: '.price, .product-details'
      },
      checkout: {
        page: '.checkout, .cart-page',
        cartButton: '.add-to-cart-button',
        checkoutButton: '.checkout-btn'
      }
    },
    features: {
      supportsAutomation: false,
      hasOfficialAPI: false,
      requiresPoliteDelay: true,
      maxRetries: 2
    },
    delays: {
      politeDelay: 2000,
      retryDelay: 5000,
      cacheTimeout: 3000
    },
    limits: {
      maxRequestsPerMinute: 30,
      maxConcurrentRequests: 2
    }
  }
} as const;

// UI Configuration
const UI_CONFIG = {
  notifications: {
    defaultTimeout: 3000,
    errorTimeout: 5000,
    criticalTimeout: 10000
  },
  fab: {
    position: { bottom: '20px', right: '20px' },
    size: { width: '56px', height: '56px' },
    zIndex: 10000
  },
  productUI: {
    position: { top: '20px', right: '20px' },
    width: '320px',
    zIndex: 10001
  },
  quickActions: {
    minWidth: '200px',
    zIndex: 10002
  },
  animations: {
    fadeInDuration: 300,
    slideInDuration: 300,
    hoverScale: 1.1
  }
} as const;

// Extension Configuration
const EXTENSION_CONFIG = {
  messageTypes: {
    PING: 'PING',
    EXECUTE_ADD_TO_CART: 'EXECUTE_ADD_TO_CART',
    FILL_CHECKOUT_FORM: 'FILL_CHECKOUT_FORM',
    ADD_TO_CART: 'ADD_TO_CART',
    TRACK_PAGE_VIEW: 'TRACK_PAGE_VIEW',
    SYNC_DATA: 'SYNC_DATA',
    ERROR_REPORT: 'ERROR_REPORT'
  } as const,
  cache: {
    defaultTTL: 5000,
    maxSize: 100,
    cleanupInterval: 30000
  },
  monitoring: {
    debounceDelay: 1000,
    mutationObserverConfig: {
      childList: true,
      subtree: true,
      attributes: false
    }
  },
  errorReporting: {
    maxQueueSize: 50,
    flushInterval: 30000,
    maxRetries: 3
  }
} as const;

class ConfigManager {
  private static instance: ConfigManager;

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private constructor() {}

  getRetailerConfig(retailerId: RetailerId): RetailerConfig {
    const config = RETAILER_CONFIG[retailerId];
    if (!config) {
      throw new Error(`Configuration not found for retailer: ${retailerId}`);
    }
    return config;
  }

  getProductSelectors(retailerId: RetailerId) {
    return this.getRetailerConfig(retailerId).selectors.product;
  }

  getCheckoutSelectors(retailerId: RetailerId) {
    return this.getRetailerConfig(retailerId).selectors.checkout;
  }

  getRetailerFeatures(retailerId: RetailerId) {
    return this.getRetailerConfig(retailerId).features;
  }

  getRetailerDelays(retailerId: RetailerId) {
    return this.getRetailerConfig(retailerId).delays;
  }

  getRetailerLimits(retailerId: RetailerId) {
    return this.getRetailerConfig(retailerId).limits;
  }

  getUIConfig() {
    return UI_CONFIG;
  }

  getExtensionConfig() {
    return EXTENSION_CONFIG;
  }

  // Dynamic configuration updates (for future use)
  updateRetailerConfig(retailerId: RetailerId, updates: Partial<RetailerConfig>): void {
    const currentConfig = RETAILER_CONFIG[retailerId];
    if (currentConfig) {
      Object.assign(currentConfig, updates);
    }
  }

  // Validation methods
  isRetailerSupported(retailerId: string): retailerId is RetailerId {
    return retailerId in RETAILER_CONFIG;
  }

  supportsAutomation(retailerId: RetailerId): boolean {
    return this.getRetailerFeatures(retailerId).supportsAutomation;
  }

  requiresPoliteDelay(retailerId: RetailerId): boolean {
    return this.getRetailerFeatures(retailerId).requiresPoliteDelay;
  }

  hasOfficialAPI(retailerId: RetailerId): boolean {
    return this.getRetailerFeatures(retailerId).hasOfficialAPI;
  }
}

// Usage examples:
const configManager = ConfigManager.getInstance();

// Get retailer-specific selectors
const bestBuySelectors = configManager.getProductSelectors('bestbuy');
console.log(bestBuySelectors.title); // '.sku-title, .sr-product-title'

// Check retailer capabilities
if (configManager.supportsAutomation('costco')) {
  // Enable automation features
} else {
  // Use manual mode
}

// Get appropriate delays
const delays = configManager.getRetailerDelays('costco');
setTimeout(() => {
  // Perform action with polite delay
}, delays.politeDelay);

export { ConfigManager, RETAILER_CONFIG, UI_CONFIG, EXTENSION_CONFIG };
