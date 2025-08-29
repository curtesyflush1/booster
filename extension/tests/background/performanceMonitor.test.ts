// Standalone tests for performance monitor

import { PerformanceMonitor } from '../../src/shared/performanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = PerformanceMonitor.getInstance();
    // Clear any existing metrics
    monitor.cleanup(0);
  });

  describe('Metric Recording', () => {
    it('should record metrics correctly', () => {
      monitor.recordMetric('test_metric', 50);
      
      const stats = monitor.getStats('test_metric');
      expect(stats).toBeTruthy();
      expect(stats!.count).toBe(1);
      expect(stats!.average).toBe(50);
      expect(stats!.recent).toBe(50);
    });

    it('should calculate statistics correctly', () => {
      monitor.recordMetric('test_metric', 10);
      monitor.recordMetric('test_metric', 20);
      monitor.recordMetric('test_metric', 30);
      
      const stats = monitor.getStats('test_metric');
      expect(stats).toBeTruthy();
      expect(stats!.count).toBe(3);
      expect(stats!.average).toBe(20);
      expect(stats!.min).toBe(10);
      expect(stats!.max).toBe(30);
      expect(stats!.recent).toBe(30);
    });

    it('should return null for non-existent metrics', () => {
      const stats = monitor.getStats('non_existent');
      expect(stats).toBeNull();
    });
  });

  describe('Function Timing', () => {
    it('should time async function execution', async () => {
      const mockFunction = jest.fn().mockResolvedValue('result');
      
      const result = await monitor.timeFunction(
        'test_function',
        mockFunction
      );
      
      expect(result).toBe('result');
      expect(mockFunction).toHaveBeenCalled();
      
      const stats = monitor.getStats('test_function');
      expect(stats).toBeTruthy();
      expect(stats!.count).toBe(1);
    });

    it('should time sync function execution', () => {
      const mockFunction = jest.fn().mockReturnValue('sync_result');
      
      const result = monitor.timeSync(
        'sync_function',
        mockFunction
      );
      
      expect(result).toBe('sync_result');
      expect(mockFunction).toHaveBeenCalled();
      
      const stats = monitor.getStats('sync_function');
      expect(stats).toBeTruthy();
      expect(stats!.count).toBe(1);
    });

    it('should handle function errors correctly', async () => {
      const mockFunction = jest.fn().mockRejectedValue(new Error('Test error'));
      
      await expect(
        monitor.timeFunction('error_function', mockFunction)
      ).rejects.toThrow('Test error');
      
      const stats = monitor.getStats('error_function');
      expect(stats).toBeTruthy();
      expect(stats!.count).toBe(1);
    });
  });

  describe('Memory Management', () => {
    it('should cleanup old metrics', () => {
      // Record a metric
      monitor.recordMetric('old_metric', 50);
      
      // Verify it exists
      let stats = monitor.getStats('old_metric');
      expect(stats).toBeTruthy();
      
      // Cleanup metrics older than 0ms (should remove all)
      monitor.cleanup(0);
      
      // Verify it's gone
      stats = monitor.getStats('old_metric');
      expect(stats).toBeNull();
    });

    it('should limit metrics per type to prevent memory leaks', () => {
      // Record more than the limit (100)
      for (let i = 0; i < 150; i++) {
        monitor.recordMetric('limited_metric', i);
      }
      
      const stats = monitor.getStats('limited_metric');
      expect(stats).toBeTruthy();
      expect(stats!.count).toBeLessThanOrEqual(100);
    });
  });

  describe('Thresholds', () => {
    it('should set custom thresholds', () => {
      monitor.setThresholds('custom_metric', { warning: 100, critical: 200 });
      
      // This would normally log warnings, but we can't easily test console output
      monitor.recordMetric('custom_metric', 150); // Should trigger warning
      monitor.recordMetric('custom_metric', 250); // Should trigger critical
      
      const stats = monitor.getStats('custom_metric');
      expect(stats).toBeTruthy();
      expect(stats!.count).toBe(2);
    });
  });

  describe('Statistics Aggregation', () => {
    it('should provide comprehensive statistics', () => {
      monitor.recordMetric('stat_test', 10);
      monitor.recordMetric('stat_test', 20);
      monitor.recordMetric('stat_test', 30);
      monitor.recordMetric('other_metric', 100);
      
      const allStats = monitor.getAllStats();
      
      expect(allStats).toHaveProperty('stat_test');
      expect(allStats).toHaveProperty('other_metric');
      expect(allStats.stat_test.count).toBe(3);
      expect(allStats.other_metric.count).toBe(1);
    });
  });
});