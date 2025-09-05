import { MLPredictionService } from '../../src/services/mlPredictionService';
import { Product } from '../../src/models/Product';
import { BaseModel } from '../../src/models/BaseModel';

// Mock the database and models
jest.mock('../../src/models/BaseModel');
jest.mock('../../src/models/Product');
jest.mock('../../src/utils/logger');
jest.mock('../../src/config/database', () => ({
  handleDatabaseError: jest.fn((error) => error)
}));

describe('MLPredictionService', () => {
  let mockDb: any;

  beforeEach(() => {
    // Setup mock database
    mockDb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      first: jest.fn(),
      limit: jest.fn().mockReturnThis(),
      raw: jest.fn().mockReturnValue('mocked_raw_query'),
      fn: {
        now: jest.fn()
      }
    };

    // Mock BaseModel.getKnex to return a callable knex-like function
    const fakeKnex: any = Object.assign(((table: string) => mockDb), {
      raw: jest.fn().mockReturnValue('mocked_raw_query'),
      fn: { now: jest.fn() }
    });
    (BaseModel as any).getKnex = jest.fn().mockReturnValue(fakeKnex);
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('collectHistoricalData', () => {
    it('should collect price history and availability data', async () => {
      const productId = 'test-product-id';
      const mockPriceHistory = [
        {
          date: '2024-01-01',
          price: '29.99',
          retailer_id: 'retailer-1',
          in_stock: true
        },
        {
          date: '2024-01-02',
          price: '31.99',
          retailer_id: 'retailer-1',
          in_stock: true
        }
      ];

      const mockAvailabilityData = [
        {
          date: '2024-01-01',
          in_stock: true,
          retailer_id: 'retailer-1',
          stock_level: 10
        }
      ];

      // Mock the database query chain to return the mock data via getKnex callable
      const fakeKnex: any = ((table: string) => {
        if (table === 'price_history') {
          return { ...mockDb, first: jest.fn().mockResolvedValue(mockPriceHistory) };
        }
        if (table === 'product_availability') {
          return { ...mockDb, first: jest.fn().mockResolvedValue(mockAvailabilityData) };
        }
        return mockDb;
      });
      fakeKnex.raw = jest.fn().mockReturnValue('mocked_raw_query');
      fakeKnex.fn = { now: jest.fn() };
      (BaseModel as any).getKnex = jest.fn().mockReturnValue(fakeKnex);

      // Mock the private methods
      jest.spyOn(MLPredictionService as any, 'calculateSeasonalTrends').mockResolvedValue([]);
      jest.spyOn(MLPredictionService as any, 'getCompetitorAnalysis').mockResolvedValue([]);

      const result = await MLPredictionService.collectHistoricalData(productId, 30);

      expect(result).toHaveProperty('productId', productId);
      expect(result).toHaveProperty('priceHistory');
      expect(result).toHaveProperty('availabilityPattern');
      expect(result).toHaveProperty('seasonalTrends');
      expect(result).toHaveProperty('competitorAnalysis');
    });

    it('should handle empty data gracefully', async () => {
      const productId = 'test-product-id';

      // Mock empty results
      const emptyKnex: any = ((table: string) => ({ ...mockDb, first: jest.fn().mockResolvedValue([]) }));
      emptyKnex.raw = jest.fn().mockReturnValue('mocked_raw_query');
      emptyKnex.fn = { now: jest.fn() };
      (BaseModel as any).getKnex = jest.fn().mockReturnValue(emptyKnex);
      jest.spyOn(MLPredictionService as any, 'calculateSeasonalTrends').mockResolvedValue([]);
      jest.spyOn(MLPredictionService as any, 'getCompetitorAnalysis').mockResolvedValue([]);

      const result = await MLPredictionService.collectHistoricalData(productId, 30);

      expect(result.priceHistory).toEqual([]);
      expect(result.availabilityPattern).toEqual([]);
    });
  });

  describe('predictPrice', () => {
    it('should return insufficient data prediction for products with little history', async () => {
      const productId = 'test-product-id';
      
      // Mock collectHistoricalData to return insufficient data
      jest.spyOn(MLPredictionService, 'collectHistoricalData').mockResolvedValue({
        productId,
        priceHistory: [], // Empty history
        availabilityPattern: [],
        seasonalTrends: [],
        competitorAnalysis: []
      });

      const result = await MLPredictionService.predictPrice(productId, 30);

      expect(result.productId).toBe(productId);
      expect(result.confidence).toBe(0);
      expect(result.factors).toContain('insufficient_data');
    });

    it('should calculate price prediction with sufficient data', async () => {
      const productId = 'test-product-id';
      const mockPriceHistory = [
        { date: new Date('2024-01-01'), price: 29.99, retailerId: 'retailer-1', inStock: true },
        { date: new Date('2024-01-02'), price: 30.99, retailerId: 'retailer-1', inStock: true },
        { date: new Date('2024-01-03'), price: 31.99, retailerId: 'retailer-1', inStock: true },
        { date: new Date('2024-01-04'), price: 32.99, retailerId: 'retailer-1', inStock: true },
        { date: new Date('2024-01-05'), price: 33.99, retailerId: 'retailer-1', inStock: true }
      ];

      jest.spyOn(MLPredictionService, 'collectHistoricalData').mockResolvedValue({
        productId,
        priceHistory: mockPriceHistory,
        availabilityPattern: [],
        seasonalTrends: [],
        competitorAnalysis: []
      });

      const result = await MLPredictionService.predictPrice(productId, 30);

      expect(result.productId).toBe(productId);
      expect(result.predictedPrice).toBeGreaterThan(0);
      expect(['increasing', 'decreasing', 'stable']).toContain(result.trend);
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('calculateSelloutRisk', () => {
    it('should return low risk for products with no data', async () => {
      const productId = 'test-product-id';

      jest.spyOn(MLPredictionService, 'collectHistoricalData').mockResolvedValue({
        productId,
        priceHistory: [],
        availabilityPattern: [],
        seasonalTrends: [],
        competitorAnalysis: []
      });

      jest.spyOn(MLPredictionService as any, 'getCurrentAvailability').mockResolvedValue([]);
      jest.spyOn(MLPredictionService as any, 'calculateDemandScore').mockResolvedValue(0);

      const result = await MLPredictionService.calculateSelloutRisk(productId);

      expect(result.productId).toBe(productId);
      expect(result.riskLevel).toBe('low');
      expect(result.factors).toContain('no_data');
    });

    it('should calculate high risk for products with low availability', async () => {
      const productId = 'test-product-id';
      const mockAvailabilityPattern = [
        { date: new Date('2024-01-01'), inStock: false, retailerId: 'retailer-1' },
        { date: new Date('2024-01-02'), inStock: false, retailerId: 'retailer-1' },
        { date: new Date('2024-01-03'), inStock: true, retailerId: 'retailer-1' },
        { date: new Date('2024-01-04'), inStock: false, retailerId: 'retailer-1' }
      ];

      jest.spyOn(MLPredictionService, 'collectHistoricalData').mockResolvedValue({
        productId,
        priceHistory: [],
        availabilityPattern: mockAvailabilityPattern,
        seasonalTrends: [],
        competitorAnalysis: []
      });

      jest.spyOn(MLPredictionService as any, 'getCurrentAvailability').mockResolvedValue([
        { in_stock: false },
        { in_stock: false }
      ]);
      jest.spyOn(MLPredictionService as any, 'calculateDemandScore').mockResolvedValue(80);

      const result = await MLPredictionService.calculateSelloutRisk(productId);

      expect(result.productId).toBe(productId);
      expect(result.riskScore).toBeGreaterThan(50);
      expect(result.riskLevel).toMatch(/high|critical/);
    });
  });

  describe('estimateROI', () => {
    it('should return zero ROI for products with insufficient data', async () => {
      const productId = 'test-product-id';
      const currentPrice = 29.99;

      // Mock Product.findById
      (Product.findById as jest.Mock).mockResolvedValue({
        id: productId,
        name: 'Test Product',
        popularity_score: 100
      });

      jest.spyOn(MLPredictionService, 'collectHistoricalData').mockResolvedValue({
        productId,
        priceHistory: [], // Insufficient data
        availabilityPattern: [],
        seasonalTrends: [],
        competitorAnalysis: []
      });

      const result = await MLPredictionService.estimateROI(productId, currentPrice, 365);

      expect(result.productId).toBe(productId);
      expect(result.roiPercentage).toBe(0);
      expect(result.marketFactors).toContain('insufficient_data');
    });

    it('should calculate positive ROI for appreciating products', async () => {
      const productId = 'test-product-id';
      const currentPrice = 35.00;

      (Product.findById as jest.Mock).mockResolvedValue({
        id: productId,
        name: 'Test Product',
        popularity_score: 800,
        release_date: new Date('2022-01-01')
      });

      const mockPriceHistory = Array.from({ length: 20 }, (_, i) => ({
        date: new Date(Date.now() - (19 - i) * 24 * 60 * 60 * 1000),
        price: 20 + i * 0.5, // Steadily increasing prices
        retailerId: 'retailer-1',
        inStock: true
      }));

      jest.spyOn(MLPredictionService, 'collectHistoricalData').mockResolvedValue({
        productId,
        priceHistory: mockPriceHistory,
        availabilityPattern: [],
        seasonalTrends: [],
        competitorAnalysis: []
      });

      const result = await MLPredictionService.estimateROI(productId, currentPrice, 365);

      expect(result.productId).toBe(productId);
      expect(result.roiPercentage).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('calculateHypeMeter', () => {
    it('should calculate hype score based on engagement metrics', async () => {
      const productId = 'test-product-id';

      // Mock database queries for engagement metrics
      mockDb.first
        .mockResolvedValueOnce({ count: '50' }) // watch count
        .mockResolvedValueOnce({ alert_count: '25', clicked_count: '15' }); // alert stats

      jest.spyOn(MLPredictionService as any, 'calculateSearchVolume').mockResolvedValue(500);
      jest.spyOn(MLPredictionService as any, 'calculateHypeTrend').mockResolvedValue('rising');

      const result = await MLPredictionService.calculateHypeMeter(productId);

      expect(result.productId).toBe(productId);
      expect(result.hypeScore).toBeGreaterThan(0);
      expect(result.hypeScore).toBeLessThanOrEqual(100);
      expect(result.engagementMetrics.watchCount).toBe(50);
      expect(result.engagementMetrics.alertCount).toBe(25);
      expect(result.trendDirection).toBe('rising');
    });

    it('should return low hype for products with minimal engagement', async () => {
      const productId = 'test-product-id';

      mockDb.first
        .mockResolvedValueOnce({ count: '0' }) // no watches
        .mockResolvedValueOnce({ alert_count: '0', clicked_count: '0' }); // no alerts

      jest.spyOn(MLPredictionService as any, 'calculateSearchVolume').mockResolvedValue(0);
      jest.spyOn(MLPredictionService as any, 'calculateHypeTrend').mockResolvedValue('stable');

      const result = await MLPredictionService.calculateHypeMeter(productId);

      expect(result.hypeLevel).toBe('low');
      expect(result.hypeScore).toBeLessThan(25);
    });
  });

  describe('linearRegression helper', () => {
    it('should calculate correct linear regression', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10]; // Perfect linear relationship

      const result = (MLPredictionService as any).linearRegression(x, y);

      expect(result.slope).toBeCloseTo(2, 1);
      expect(result.intercept).toBeCloseTo(0, 1);
      expect(result.correlation).toBeCloseTo(1, 1);
    });

    it('should handle edge cases gracefully', () => {
      const x = [1];
      const y = [1];

      const result = (MLPredictionService as any).linearRegression(x, y);

      expect(result.correlation).toBe(0); // Should handle NaN case
    });
  });

  describe('identifyStockOutEvents helper', () => {
    it('should identify stock-out periods correctly', () => {
      const availabilityData = [
        { date: new Date('2024-01-01'), inStock: true, retailerId: 'r1' },
        { date: new Date('2024-01-02'), inStock: false, retailerId: 'r1' },
        { date: new Date('2024-01-03'), inStock: false, retailerId: 'r1' },
        { date: new Date('2024-01-04'), inStock: true, retailerId: 'r1' }
      ];

      const events = (MLPredictionService as any).identifyStockOutEvents(availabilityData);

      expect(events).toHaveLength(1);
      expect(events[0].start).toEqual(new Date('2024-01-02'));
      expect(events[0].end).toEqual(new Date('2024-01-04'));
      expect(events[0].duration).toBeGreaterThan(0);
    });

    it('should handle no stock-out events', () => {
      const availabilityData = [
        { date: new Date('2024-01-01'), inStock: true, retailerId: 'r1' },
        { date: new Date('2024-01-02'), inStock: true, retailerId: 'r1' }
      ];

      const events = (MLPredictionService as any).identifyStockOutEvents(availabilityData);

      expect(events).toHaveLength(0);
    });
  });
});
