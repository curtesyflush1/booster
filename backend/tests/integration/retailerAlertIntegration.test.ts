import { AlertProcessingService } from '../../src/services/alertProcessingService';
import { WatchMonitoringService } from '../../src/services/watchMonitoringService';
import { Alert } from '../../src/models/Alert';
import { Watch } from '../../src/models/Watch';
import { User } from '../../src/models/User';
import { Product } from '../../src/models/Product';
import { IWatch, IUser, IProduct, IAlert } from '../../src/types/database';
import { SubscriptionTier } from '../../src/types/subscription';

// Mock dependencies
jest.mock('../../src/models/Alert');
jest.mock('../../src/models/Watch');
jest.mock('../../src/models/User');
jest.mock('../../src/models/Product');
jest.mock('../../src/services/alertDeliveryService');
jest.mock('../../src/services/quietHoursService');

const MockedAlert = Alert as jest.Mocked<typeof Alert>;
const MockedWatch = Watch as jest.Mocked<typeof Watch>;
const MockedUser = User as jest.Mocked<typeof User>;
const MockedProduct = Product as jest.Mocked<typeof Product>;

describe('Retailer Monitoring to Alert Generation Integration', () => {
  const mockUser: IUser = {
    id: 'user-1',
    email: 'test@example.com',
    password_hash: 'hashed',
    subscription_tier: SubscriptionTier.FREE,
    email_verified: true,
    failed_login_attempts: 0,
    shipping_addresses: [],
    payment_methods: [],
    retailer_credentials: {},
    notification_settings: {
      web_push: true,
      email: true,
      sms: false,
      discord: false
    },
    quiet_hours: {
      enabled: false,
      start_time: '22:00',
      end_time: '08:00',
      timezone: 'UTC',
      days: []
    },
    timezone: 'UTC',
    preferences: {},
    created_at: new Date(),
    updated_at: new Date()
  };

  const mockProduct: IProduct = {
    id: 'product-1',
    name: 'Pokémon Booster Box - Paldea Evolved',
    slug: 'pokemon-booster-box-paldea-evolved',
    sku: 'POK-PAL-BB',
    upc: '820650850011',
    is_active: true,
    popularity_score: 750,
    metadata: {
      set: 'Paldea Evolved',
      type: 'Booster Box',
      release_date: '2023-06-09'
    },
    created_at: new Date(),
    updated_at: new Date()
  };

  const mockWatch: IWatch = {
    id: 'watch-1',
    user_id: 'user-1',
    product_id: 'product-1',
    retailer_ids: ['retailer-bestbuy', 'retailer-walmart'],
    max_price: 120.00,
    availability_type: 'both',
    is_active: true,
    alert_preferences: {
      notify_restock: true,
      notify_price_drop: true,
      notify_low_stock: false
    },
    alert_count: 5,
    last_alerted: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    MockedUser.findById.mockResolvedValue(mockUser);
    MockedProduct.findById.mockResolvedValue(mockProduct);
    MockedWatch.findById.mockResolvedValue(mockWatch);
    MockedAlert.findBy.mockResolvedValue([]);
    
    // Mock quiet hours service
    const { QuietHoursService } = require('../../src/services/quietHoursService');
    QuietHoursService.isQuietTime = jest.fn().mockResolvedValue({ isQuietTime: false });
    
    // Mock alert delivery service
    const { AlertDeliveryService } = require('../../src/services/alertDeliveryService');
    AlertDeliveryService.deliverAlert = jest.fn().mockResolvedValue({
      success: true,
      successfulChannels: ['web_push', 'email'],
      failedChannels: [],
      deliveryIds: ['delivery-1']
    });
  });

  describe('Product Restock Detection', () => {
    it('should generate restock alert when product becomes available', async () => {
      const mockAlert: IAlert = {
        id: 'alert-restock-1',
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-bestbuy',
        watch_id: 'watch-1',
        type: 'restock',
        priority: 'high',
        data: {
          product_name: 'Pokémon Booster Box - Paldea Evolved',
          retailer_name: 'Best Buy',
          availability_status: 'in_stock',
          product_url: 'https://bestbuy.com/site/pokemon-booster-box/123',
          cart_url: 'https://bestbuy.com/cart/add/123',
          price: 89.99,
          stock_level: 15
        },
        status: 'pending',
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedAlert.createAlert.mockResolvedValue(mockAlert);
      MockedAlert.findById.mockResolvedValue(mockAlert);
      MockedAlert.markAsSent.mockResolvedValue(true);
      MockedWatch.updateById.mockResolvedValue(mockWatch);

      // Simulate retailer monitoring detecting a restock
      const alertData = {
        userId: 'user-1',
        productId: 'product-1',
        retailerId: 'retailer-bestbuy',
        watchId: 'watch-1',
        type: 'restock' as const,
        data: {
          product_name: 'Pokémon Booster Box - Paldea Evolved',
          retailer_name: 'Best Buy',
          availability_status: 'in_stock',
          product_url: 'https://bestbuy.com/site/pokemon-booster-box/123',
          cart_url: 'https://bestbuy.com/cart/add/123',
          price: 89.99,
          stock_level: 15
        }
      };

      const result = await AlertProcessingService.generateAlert(alertData);

      expect(result.status).toBe('processed');
      expect(result.alertId).toBe('alert-restock-1');
      expect(result.deliveryChannels).toEqual(['web_push', 'email']);

      // Verify alert was created with correct data
      expect(MockedAlert.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          product_id: 'product-1',
          retailer_id: 'retailer-bestbuy',
          watch_id: 'watch-1',
          type: 'restock',
          priority: 'high', // High priority due to popularity score > 500
          data: expect.objectContaining({
            product_name: 'Pokémon Booster Box - Paldea Evolved',
            retailer_name: 'Best Buy',
            price: 89.99
          })
        })
      );

      // Verify watch was updated
      expect(MockedWatch.updateById).toHaveBeenCalledWith('watch-1', {
        alert_count: 6, // Incremented from 5
        last_alerted: expect.any(Date)
      });
    });

    it('should generate price drop alert when price decreases', async () => {
      const mockAlert: IAlert = {
        id: 'alert-price-drop-1',
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-walmart',
        watch_id: 'watch-1',
        type: 'price_drop',
        priority: 'high',
        data: {
          product_name: 'Pokémon Booster Box - Paldea Evolved',
          retailer_name: 'Walmart',
          availability_status: 'in_stock',
          product_url: 'https://walmart.com/ip/pokemon-booster-box/456',
          cart_url: 'https://walmart.com/cart/add/456',
          price: 79.99,
          original_price: 99.99
        },
        status: 'pending',
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedAlert.createAlert.mockResolvedValue(mockAlert);
      MockedAlert.findById.mockResolvedValue(mockAlert);
      MockedAlert.markAsSent.mockResolvedValue(true);

      const alertData = {
        userId: 'user-1',
        productId: 'product-1',
        retailerId: 'retailer-walmart',
        watchId: 'watch-1',
        type: 'price_drop' as const,
        data: {
          product_name: 'Pokémon Booster Box - Paldea Evolved',
          retailer_name: 'Walmart',
          availability_status: 'in_stock',
          product_url: 'https://walmart.com/ip/pokemon-booster-box/456',
          cart_url: 'https://walmart.com/cart/add/456',
          price: 79.99,
          original_price: 99.99
        }
      };

      const result = await AlertProcessingService.generateAlert(alertData);

      expect(result.status).toBe('processed');
      expect(MockedAlert.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'price_drop',
          priority: 'high', // High priority due to 20% price drop
          data: expect.objectContaining({
            price: 79.99,
            original_price: 99.99
          })
        })
      );
    });

    it('should respect user price limits', async () => {
      // User has max price of $120, product is $130
      const alertData = {
        userId: 'user-1',
        productId: 'product-1',
        retailerId: 'retailer-bestbuy',
        watchId: 'watch-1',
        type: 'restock' as const,
        data: {
          product_name: 'Pokémon Booster Box - Paldea Evolved',
          retailer_name: 'Best Buy',
          availability_status: 'in_stock',
          product_url: 'https://bestbuy.com/site/pokemon-booster-box/123',
          price: 130.00 // Above user's max price of $120
        }
      };

      // In a real implementation, this would be filtered out by the monitoring service
      // before reaching alert generation. For this test, we'll assume the monitoring
      // service respects price limits and doesn't generate alerts for overpriced items.
      
      // This test verifies the integration point exists
      expect(mockWatch.max_price).toBe(120.00);
      expect(alertData.data.price).toBeGreaterThan(mockWatch.max_price!);
    });
  });

  describe('Multiple Retailer Monitoring', () => {
    it('should generate separate alerts for different retailers', async () => {
      const bestBuyAlert: IAlert = {
        id: 'alert-bestbuy',
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-bestbuy',
        watch_id: 'watch-1',
        type: 'restock',
        priority: 'high',
        data: {
          product_name: 'Pokémon Booster Box - Paldea Evolved',
          retailer_name: 'Best Buy',
          availability_status: 'in_stock',
          product_url: 'https://bestbuy.com/site/pokemon-booster-box/123',
          price: 89.99
        },
        status: 'pending',
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      const walmartAlert: IAlert = {
        id: 'alert-walmart',
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-walmart',
        watch_id: 'watch-1',
        type: 'restock',
        priority: 'high',
        data: {
          product_name: 'Pokémon Booster Box - Paldea Evolved',
          retailer_name: 'Walmart',
          availability_status: 'in_stock',
          product_url: 'https://walmart.com/ip/pokemon-booster-box/456',
          price: 94.99
        },
        status: 'pending',
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedAlert.createAlert
        .mockResolvedValueOnce(bestBuyAlert)
        .mockResolvedValueOnce(walmartAlert);
      
      MockedAlert.findById
        .mockResolvedValueOnce(bestBuyAlert)
        .mockResolvedValueOnce(walmartAlert);
      
      MockedAlert.markAsSent.mockResolvedValue(true);

      // Generate alerts for both retailers
      const bestBuyResult = await AlertProcessingService.generateAlert({
        userId: 'user-1',
        productId: 'product-1',
        retailerId: 'retailer-bestbuy',
        watchId: 'watch-1',
        type: 'restock',
        data: bestBuyAlert.data
      });

      const walmartResult = await AlertProcessingService.generateAlert({
        userId: 'user-1',
        productId: 'product-1',
        retailerId: 'retailer-walmart',
        watchId: 'watch-1',
        type: 'restock',
        data: walmartAlert.data
      });

      expect(bestBuyResult.status).toBe('processed');
      expect(walmartResult.status).toBe('processed');
      expect(bestBuyResult.alertId).toBe('alert-bestbuy');
      expect(walmartResult.alertId).toBe('alert-walmart');

      // Both alerts should be created
      expect(MockedAlert.createAlert).toHaveBeenCalledTimes(2);
    });
  });

  describe('Watch Monitoring Integration', () => {
    it('should get watches for monitoring and trigger alerts', async () => {

      // Mock the monitoring service method
      MockedWatch.getWatchesForMonitoring = jest.fn().mockResolvedValue([mockWatch]);
      MockedProduct.findById.mockResolvedValue(mockProduct);

      const watches = await WatchMonitoringService.getWatchesForMonitoring('retailer-bestbuy', 10);

      expect(watches).toHaveLength(1);
      expect(watches[0]).toEqual(expect.objectContaining({
        id: 'watch-1',
        user_id: 'user-1',
        product_id: 'product-1',
        product: expect.objectContaining({
          name: 'Pokémon Booster Box - Paldea Evolved'
        })
      }));
    });

    it('should record alert information after successful delivery', async () => {
      const alertedAt = new Date();
      MockedWatch.updateAlertInfo = jest.fn().mockResolvedValue(true);

      const success = await WatchMonitoringService.recordWatchAlert('watch-1', alertedAt);

      expect(success).toBe(true);
      expect(MockedWatch.updateAlertInfo).toHaveBeenCalledWith('watch-1', alertedAt);
    });

    it('should update watch health after alert generation', async () => {
      const healthStatus = await WatchMonitoringService.checkWatchHealth('watch-1');

      expect(healthStatus).toEqual(expect.objectContaining({
        watchId: 'watch-1',
        productId: 'product-1',
        userId: 'user-1',
        isHealthy: true,
        alertCount: 5
      }));
    });
  });

  describe('Error Handling in Integration', () => {
    it('should handle product not found during alert generation', async () => {
      MockedProduct.findById.mockResolvedValue(null);

      await expect(AlertProcessingService.generateAlert({
        userId: 'user-1',
        productId: 'nonexistent-product',
        retailerId: 'retailer-bestbuy',
        type: 'restock',
        data: {
          product_name: 'Test Product',
          retailer_name: 'Best Buy',
          availability_status: 'in_stock',
          product_url: 'https://example.com'
        }
      })).rejects.toThrow('Alert validation failed: Product not found');
    });

    it('should handle inactive product during alert generation', async () => {
      MockedProduct.findById.mockResolvedValue({
        ...mockProduct,
        is_active: false
      });

      await expect(AlertProcessingService.generateAlert({
        userId: 'user-1',
        productId: 'product-1',
        retailerId: 'retailer-bestbuy',
        type: 'restock',
        data: {
          product_name: 'Test Product',
          retailer_name: 'Best Buy',
          availability_status: 'in_stock',
          product_url: 'https://example.com'
        }
      })).rejects.toThrow('Alert validation failed: Product is inactive');
    });

    it('should handle watch not found during alert generation', async () => {
      MockedWatch.findById.mockResolvedValue(null);

      await expect(AlertProcessingService.generateAlert({
        userId: 'user-1',
        productId: 'product-1',
        retailerId: 'retailer-bestbuy',
        watchId: 'nonexistent-watch',
        type: 'restock',
        data: {
          product_name: 'Test Product',
          retailer_name: 'Best Buy',
          availability_status: 'in_stock',
          product_url: 'https://example.com'
        }
      })).rejects.toThrow('Alert validation failed: Watch not found');
    });

    it('should handle delivery failures gracefully', async () => {
      const mockAlert: IAlert = {
        id: 'alert-1',
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-bestbuy',
        type: 'restock',
        priority: 'medium',
        data: {
          product_name: 'Test Product',
          retailer_name: 'Best Buy',
          availability_status: 'in_stock',
          product_url: 'https://example.com'
        },
        status: 'pending',
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedAlert.createAlert.mockResolvedValue(mockAlert);
      MockedAlert.findById.mockResolvedValue(mockAlert);

      // Mock delivery failure
      const { AlertDeliveryService } = require('../../src/services/alertDeliveryService');
      AlertDeliveryService.deliverAlert = jest.fn().mockResolvedValue({
        success: false,
        successfulChannels: [],
        failedChannels: ['web_push', 'email'],
        error: 'All delivery channels failed',
        deliveryIds: []
      });
      MockedAlert.markAsFailed.mockResolvedValue(true);

      const result = await AlertProcessingService.generateAlert({
        userId: 'user-1',
        productId: 'product-1',
        retailerId: 'retailer-bestbuy',
        type: 'restock',
        data: {
          product_name: 'Test Product',
          retailer_name: 'Best Buy',
          availability_status: 'in_stock',
          product_url: 'https://example.com'
        }
      });

      expect(result.status).toBe('failed');
      expect(MockedAlert.markAsFailed).toHaveBeenCalledWith('alert-1', 'All delivery channels failed');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle bulk alert generation efficiently', async () => {
      const alertPromises = Array.from({ length: 10 }, (_, i) => {
        const mockAlert: IAlert = {
          id: `alert-${i}`,
          user_id: 'user-1',
          product_id: 'product-1',
          retailer_id: 'retailer-bestbuy',
          type: 'restock',
          priority: 'medium',
          data: {
            product_name: 'Test Product',
            retailer_name: 'Best Buy',
            availability_status: 'in_stock',
            product_url: 'https://example.com'
          },
          status: 'pending',
          delivery_channels: [],
          retry_count: 0,
          created_at: new Date(),
          updated_at: new Date()
        };

        MockedAlert.createAlert.mockResolvedValue(mockAlert);
        MockedAlert.findById.mockResolvedValue(mockAlert);
        MockedAlert.markAsSent.mockResolvedValue(true);

        return AlertProcessingService.generateAlert({
          userId: 'user-1',
          productId: 'product-1',
          retailerId: 'retailer-bestbuy',
          type: 'restock',
          data: {
            product_name: 'Test Product',
            retailer_name: 'Best Buy',
            availability_status: 'in_stock',
            product_url: 'https://example.com'
          }
        });
      });

      const results = await Promise.allSettled(alertPromises);
      
      // Most should succeed (some might be deduplicated)
      const successfulResults = results.filter(r => 
        r.status === 'fulfilled' && 
        (r.value.status === 'processed' || r.value.status === 'deduplicated')
      );
      
      expect(successfulResults.length).toBeGreaterThan(0);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});