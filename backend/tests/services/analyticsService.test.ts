import { AnalyticsService } from '../../src/services/analyticsService';
import { Product } from '../../src/models/Product';
import { logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/models/Product');
jest.mock('../../src/utils/logger');

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Create service with test configuration
    analyticsService = new AnalyticsService({
      batchSize: 2,
      processInterval: 100,
      maxQueueSize: 5
    });
  });

  afterEach(() => {
    analyticsService.destroy();
  });

  describe('input validation', () => {
    it('should reject invalid product IDs', () => {
      const loggerWarnSpy = jest.spyOn(logger, 'warn');
      
      analyticsService.trackProductView('invalid-id');
      analyticsService.trackProductScan('');
      
      expect(loggerWarnSpy).toHaveBeenCalledTimes(2);
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Invalid product ID for view tracking', 
        { productId: 'invalid-id' }
      );
    });

    it('should accept valid UUID product IDs', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const loggerWarnSpy = jest.spyOn(logger, 'warn');
      
      analyticsService.trackProductView(validUuid);
      
      expect(loggerWarnSpy).not.toHaveBeenCalled();
    });

    it('should validate search parameters', () => {
      const loggerWarnSpy = jest.spyOn(logger, 'warn');
      
      analyticsService.trackProductSearch('', -1);
      analyticsService.trackProductSearch('   ', 5);
      
      expect(loggerWarnSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('event processing', () => {
    it('should process events when batch size is reached', async () => {
      const mockIncrement = jest.spyOn(Product, 'incrementPopularity')
        .mockResolvedValue(true);
      
      const validUuid1 = '550e8400-e29b-41d4-a716-446655440000';
      const validUuid2 = '550e8400-e29b-41d4-a716-446655440001';
      
      analyticsService.trackProductView(validUuid1);
      analyticsService.trackProductScan(validUuid2);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(mockIncrement).toHaveBeenCalledWith(validUuid1, 1);
      expect(mockIncrement).toHaveBeenCalledWith(validUuid2, 2);
    });

    it('should handle queue overflow gracefully', () => {
      // Create a service with larger batch size to prevent auto-processing
      const testService = new AnalyticsService({
        batchSize: 10, // Larger than maxQueueSize
        processInterval: 10000, // Very long interval
        maxQueueSize: 5
      });
      
      const loggerWarnSpy = jest.spyOn(logger, 'warn');
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      
      // Fill queue to exactly max size (5 events)
      for (let i = 0; i < 5; i++) {
        testService.trackProductView(validUuid);
      }
      
      // This 6th event should trigger the overflow warning
      testService.trackProductView(validUuid);
      
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Analytics queue full, dropping oldest events',
        expect.objectContaining({ maxSize: 5 })
      );
      
      testService.destroy();
    });
  });

  describe('resource management', () => {
    it('should flush all pending events', async () => {
      const mockIncrement = jest.spyOn(Product, 'incrementPopularity')
        .mockResolvedValue(true);
      
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      analyticsService.trackProductView(validUuid);
      
      await analyticsService.flush();
      
      expect(mockIncrement).toHaveBeenCalledWith(validUuid, 1);
    });

    it('should cleanup interval on destroy', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      analyticsService.destroy();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});