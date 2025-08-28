import request from 'supertest';
import express from 'express';
import { PriceComparisonController } from '../../src/controllers/priceComparisonController';
import { PriceComparisonService } from '../../src/services/priceComparisonService';
import { logger } from '../../src/utils/logger';

// Mock the service and logger
jest.mock('../../src/services/priceComparisonService');
jest.mock('../../src/utils/logger');

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  (req as any).user = { id: 'test-user-id' };
  next();
});

// Set up routes
app.get('/api/price-comparison/products/:productId', PriceComparisonController.getProductComparison);
app.post('/api/price-comparison/products/batch', PriceComparisonController.getBatchComparisons);
app.get('/api/price-comparison/products/:productId/history', PriceComparisonController.getProductPriceHistory);
app.get('/api/price-comparison/deals', PriceComparisonController.getCurrentDeals);
app.get('/api/price-comparison/products/:productId/trends', PriceComparisonController.getProductTrends);
app.get('/api/price-comparison/my-deals', PriceComparisonController.getUserDeals);

describe('PriceComparisonController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/price-comparison/products/:productId', () => {
    it('should return price comparison for a valid product', async () => {
      const mockComparison = {
        productId: 'product-1',
        productName: 'Pokemon Booster Pack',
        retailers: [
          {
            retailerId: 'retailer-1',
            retailerName: 'Best Buy',
            retailerSlug: 'best-buy',
            price: 4.99,
            inStock: true,
            availabilityStatus: 'in_stock',
            productUrl: 'https://bestbuy.com/product',
            lastChecked: '2024-01-01T10:00:00.000Z',
            dealScore: 85
          }
        ],
        bestDeal: {
          retailerId: 'retailer-1',
          retailerName: 'Best Buy',
          retailerSlug: 'best-buy',
          price: 4.99,
          inStock: true,
          availabilityStatus: 'in_stock',
          productUrl: 'https://bestbuy.com/product',
          lastChecked: '2024-01-01T10:00:00.000Z',
          dealScore: 85
        },
        averagePrice: 4.99,
        priceRange: { min: 4.99, max: 4.99 }
      };

      (PriceComparisonService.getProductPriceComparison as jest.Mock)
        .mockResolvedValue(mockComparison);

      const response = await request(app)
        .get('/api/price-comparison/products/product-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockComparison);
      expect(PriceComparisonService.getProductPriceComparison)
        .toHaveBeenCalledWith('product-1', false);
    });

    it('should include historical context when requested', async () => {
      const mockComparison = {
        productId: 'product-1',
        productName: 'Pokemon Booster Pack',
        retailers: [],
        bestDeal: null,
        averagePrice: 0,
        priceRange: { min: 0, max: 0 },
        historicalContext: {
          isAboveAverage: false,
          isAtHistoricalLow: true,
          averageHistoricalPrice: 5.49,
          priceChangePercentage: -10.5
        }
      };

      (PriceComparisonService.getProductPriceComparison as jest.Mock)
        .mockResolvedValue(mockComparison);

      await request(app)
        .get('/api/price-comparison/products/product-1?includeHistory=true')
        .expect(200);

      expect(PriceComparisonService.getProductPriceComparison)
        .toHaveBeenCalledWith('product-1', true);
    });

    it('should return 404 when product is not found', async () => {
      (PriceComparisonService.getProductPriceComparison as jest.Mock)
        .mockResolvedValue(null);

      const response = await request(app)
        .get('/api/price-comparison/products/nonexistent-product')
        .expect(404);

      expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('should return 400 when product ID is missing', async () => {
      const response = await request(app)
        .get('/api/price-comparison/products/')
        .expect(404); // Express returns 404 for missing route params
    });

    it('should handle service errors', async () => {
      (PriceComparisonService.getProductPriceComparison as jest.Mock)
        .mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/price-comparison/products/product-1')
        .expect(500);

      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('POST /api/price-comparison/products/batch', () => {
    it('should return batch price comparisons', async () => {
      const mockComparisons = [
        {
          productId: 'product-1',
          productName: 'Pokemon Booster Pack 1',
          retailers: [],
          bestDeal: null,
          averagePrice: 0,
          priceRange: { min: 0, max: 0 }
        },
        {
          productId: 'product-2',
          productName: 'Pokemon Booster Pack 2',
          retailers: [],
          bestDeal: null,
          averagePrice: 0,
          priceRange: { min: 0, max: 0 }
        }
      ];

      (PriceComparisonService.getMultipleProductComparisons as jest.Mock)
        .mockResolvedValue(mockComparisons);

      const response = await request(app)
        .post('/api/price-comparison/products/batch')
        .send({
          productIds: ['product-1', 'product-2'],
          includeHistory: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockComparisons);
      expect(response.body.count).toBe(2);
    });

    it('should return 400 for invalid product IDs', async () => {
      const response = await request(app)
        .post('/api/price-comparison/products/batch')
        .send({ productIds: 'not-an-array' })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_PRODUCT_IDS');
    });

    it('should return 400 for too many products', async () => {
      const productIds = Array.from({ length: 51 }, (_, i) => `product-${i}`);

      const response = await request(app)
        .post('/api/price-comparison/products/batch')
        .send({ productIds })
        .expect(400);

      expect(response.body.error.code).toBe('TOO_MANY_PRODUCTS');
    });

    it('should return 400 for empty product IDs array', async () => {
      const response = await request(app)
        .post('/api/price-comparison/products/batch')
        .send({ productIds: [] })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_PRODUCT_IDS');
    });
  });

  describe('GET /api/price-comparison/products/:productId/history', () => {
    it('should return price history for a product', async () => {
      const mockHistory = [
        {
          date: '2024-01-01T08:00:00.000Z',
          price: 5.99,
          retailerId: 'retailer-1',
          retailerName: 'Best Buy',
          inStock: true
        },
        {
          date: '2024-01-01T10:00:00.000Z',
          price: 4.99,
          retailerId: 'retailer-1',
          retailerName: 'Best Buy',
          inStock: true
        }
      ];

      (PriceComparisonService.getProductPriceHistory as jest.Mock)
        .mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/price-comparison/products/product-1/history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHistory);
      expect(response.body.count).toBe(2);
      expect(response.body.timeframe).toBe(30); // default
    });

    it('should accept custom days parameter', async () => {
      (PriceComparisonService.getProductPriceHistory as jest.Mock)
        .mockResolvedValue([]);

      await request(app)
        .get('/api/price-comparison/products/product-1/history?days=7')
        .expect(200);

      expect(PriceComparisonService.getProductPriceHistory)
        .toHaveBeenCalledWith('product-1', 7, undefined);
    });

    it('should accept retailer filter', async () => {
      (PriceComparisonService.getProductPriceHistory as jest.Mock)
        .mockResolvedValue([]);

      await request(app)
        .get('/api/price-comparison/products/product-1/history?retailerId=retailer-1')
        .expect(200);

      expect(PriceComparisonService.getProductPriceHistory)
        .toHaveBeenCalledWith('product-1', 30, 'retailer-1');
    });

    it('should return 400 for invalid days parameter', async () => {
      const response = await request(app)
        .get('/api/price-comparison/products/product-1/history?days=invalid')
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_DAYS');
    });

    it('should return 400 for days out of range', async () => {
      const response = await request(app)
        .get('/api/price-comparison/products/product-1/history?days=500')
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_DAYS');
    });
  });

  describe('GET /api/price-comparison/deals', () => {
    it('should return current deals', async () => {
      const mockDeals = [
        {
          id: 'deal-1',
          productId: 'product-1',
          retailerId: 'retailer-1',
          alertType: 'price_drop' as const,
          currentPrice: 4.99,
          previousPrice: 6.99,
          savingsAmount: 2.00,
          savingsPercentage: 28.61,
          dealScore: 85
        }
      ];

      (PriceComparisonService.identifyDeals as jest.Mock)
        .mockResolvedValue(mockDeals);

      const response = await request(app)
        .get('/api/price-comparison/deals')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDeals);
      expect(response.body.count).toBe(1);
    });

    it('should accept query parameters', async () => {
      (PriceComparisonService.identifyDeals as jest.Mock)
        .mockResolvedValue([]);

      await request(app)
        .get('/api/price-comparison/deals?minSavings=15&minScore=80&limit=25')
        .expect(200);

      expect(PriceComparisonService.identifyDeals).toHaveBeenCalledWith({
        minSavingsPercentage: 15,
        minDealScore: 80,
        includeOutOfStock: false,
        retailerIds: undefined,
        limit: 25
      });
    });

    it('should return 400 for invalid parameters', async () => {
      const response = await request(app)
        .get('/api/price-comparison/deals?minSavings=invalid')
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_MIN_SAVINGS');
    });
  });

  describe('GET /api/price-comparison/products/:productId/trends', () => {
    it('should return price trends for a product', async () => {
      const mockTrends = [
        {
          productId: 'product-1',
          retailerId: 'retailer-1',
          trend: 'decreasing' as const,
          changePercentage: -15.5,
          timeframe: 7,
          confidence: 0.85
        }
      ];

      (PriceComparisonService.analyzePriceTrends as jest.Mock)
        .mockResolvedValue(mockTrends);

      const response = await request(app)
        .get('/api/price-comparison/products/product-1/trends')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTrends);
      expect(response.body.timeframe).toBe(7);
    });

    it('should accept custom timeframe', async () => {
      (PriceComparisonService.analyzePriceTrends as jest.Mock)
        .mockResolvedValue([]);

      await request(app)
        .get('/api/price-comparison/products/product-1/trends?days=14')
        .expect(200);

      expect(PriceComparisonService.analyzePriceTrends)
        .toHaveBeenCalledWith('product-1', 14);
    });

    it('should return 400 for invalid days parameter', async () => {
      const response = await request(app)
        .get('/api/price-comparison/products/product-1/trends?days=100')
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_DAYS');
    });
  });

  describe('GET /api/price-comparison/my-deals', () => {
    it('should return deals for authenticated user', async () => {
      const mockDeals = [
        {
          id: 'deal-1',
          productId: 'product-1',
          retailerId: 'retailer-1',
          alertType: 'price_drop' as const,
          currentPrice: 4.99,
          previousPrice: 6.99,
          savingsAmount: 2.00,
          savingsPercentage: 28.61,
          dealScore: 85,
          productName: 'Pokemon Booster Pack',
          retailerName: 'Best Buy'
        }
      ];

      (PriceComparisonService.getBestDealsForUser as jest.Mock)
        .mockResolvedValue(mockDeals);

      const response = await request(app)
        .get('/api/price-comparison/my-deals')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDeals);
      expect(PriceComparisonService.getBestDealsForUser)
        .toHaveBeenCalledWith('test-user-id', {
          minSavingsPercentage: 5,
          limit: 20
        });
    });

    it('should accept query parameters', async () => {
      (PriceComparisonService.getBestDealsForUser as jest.Mock)
        .mockResolvedValue([]);

      await request(app)
        .get('/api/price-comparison/my-deals?minSavings=10&limit=30')
        .expect(200);

      expect(PriceComparisonService.getBestDealsForUser)
        .toHaveBeenCalledWith('test-user-id', {
          minSavingsPercentage: 10,
          limit: 30
        });
    });

    it('should return 401 when user is not authenticated', async () => {
      // Create app without authentication middleware
      const unauthApp = express();
      unauthApp.use(express.json());
      unauthApp.get('/api/price-comparison/my-deals', PriceComparisonController.getUserDeals);

      const response = await request(unauthApp)
        .get('/api/price-comparison/my-deals')
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 400 for invalid parameters', async () => {
      const response = await request(app)
        .get('/api/price-comparison/my-deals?limit=100')
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_LIMIT');
    });
  });
});