import { PerformanceTracker } from '../../src/utils/encryption/performanceTracker';

describe('PerformanceTracker', () => {
  let tracker: PerformanceTracker;

  beforeEach(() => {
    tracker = new PerformanceTracker();
  });

  afterEach(() => {
    // Ensure clean state between tests
    tracker.reset();
  });

  describe('timing operations', () => {
    it('should track operation timing and return correct result', async () => {
      const expectedResult = 'test-result';
      
      const result = await tracker.trackOperation('test-operation', async () => {
        // Use minimal delay to reduce test flakiness
        await new Promise(resolve => setTimeout(resolve, 1));
        return expectedResult;
      });

      expect(result).toBe(expectedResult);
      
      const metrics = tracker.getMetrics();
      expect(metrics).toHaveProperty('test-operation');
      
      const testOpMetrics = metrics['test-operation'];
      expect(testOpMetrics).toBeDefined();
      expect(testOpMetrics!.count).toBe(1);
      expect(testOpMetrics!.totalTime).toBeGreaterThan(0);
      expect(testOpMetrics!.averageTime).toBe(testOpMetrics!.totalTime);
      expect(testOpMetrics!.errors).toBe(0);
    });

    it('should handle operation errors and track them correctly', async () => {
      const errorMessage = 'Test error';
      
      await expect(
        tracker.trackOperation('error-operation', async () => {
          throw new Error(errorMessage);
        })
      ).rejects.toThrow(errorMessage);

      const metrics = tracker.getMetrics();
      expect(metrics).toHaveProperty('error-operation');
      
      const errorOpMetrics = metrics['error-operation'];
      expect(errorOpMetrics).toBeDefined();
      expect(errorOpMetrics!.count).toBe(1);
      expect(errorOpMetrics!.errors).toBe(1);
      expect(errorOpMetrics!.totalTime).toBeGreaterThan(0);
    });

    it('should accumulate multiple operations correctly', async () => {
      const result1 = await tracker.trackOperation('multi-op', async () => 'result1');
      const result2 = await tracker.trackOperation('multi-op', async () => 'result2');

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');

      const metrics = tracker.getMetrics();
      const multiOpMetrics = metrics['multi-op'];
      expect(multiOpMetrics).toBeDefined();
      expect(multiOpMetrics!.count).toBe(2);
      expect(multiOpMetrics!.errors).toBe(0);
      expect(multiOpMetrics!.totalTime).toBeGreaterThan(0);
      expect(multiOpMetrics!.averageTime).toBe(multiOpMetrics!.totalTime / 2);
    });
  });

  describe('metrics collection', () => {
    it('should calculate average times correctly', async () => {
      // Run operations with minimal delays to reduce test time
      await tracker.trackOperation('avg-test', async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return 'result1';
      });
      await tracker.trackOperation('avg-test', async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return 'result2';
      });

      const metrics = tracker.getMetrics();
      const avgTestMetrics = metrics['avg-test'];
      expect(avgTestMetrics).toBeDefined();
      expect(avgTestMetrics!.averageTime).toBeGreaterThan(0);
      expect(avgTestMetrics!.count).toBe(2);
      expect(avgTestMetrics!.totalTime).toBeGreaterThan(0);
      expect(avgTestMetrics!.averageTime).toBe(avgTestMetrics!.totalTime / 2);
    });

    it('should reset metrics completely', async () => {
      await tracker.trackOperation('reset-test', async () => 'result');
      
      // Verify metrics exist before reset
      let metrics = tracker.getMetrics();
      expect(Object.keys(metrics)).toHaveLength(1);
      const resetTestMetrics = metrics['reset-test'];
      expect(resetTestMetrics).toBeDefined();
      expect(resetTestMetrics!.count).toBe(1);
      
      tracker.reset();
      
      // Verify metrics are cleared after reset
      metrics = tracker.getMetrics();
      expect(Object.keys(metrics)).toHaveLength(0);
    });

    it('should handle concurrent operations correctly', async () => {
      const promises = [
        tracker.trackOperation('concurrent-op', async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
          return 'result1';
        }),
        tracker.trackOperation('concurrent-op', async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
          return 'result2';
        }),
        tracker.trackOperation('concurrent-op', async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
          return 'result3';
        })
      ];

      const results = await Promise.all(promises);
      
      expect(results).toEqual(['result1', 'result2', 'result3']);
      
      const metrics = tracker.getMetrics();
      const concurrentOpMetrics = metrics['concurrent-op'];
      expect(concurrentOpMetrics).toBeDefined();
      expect(concurrentOpMetrics!.count).toBe(3);
      expect(concurrentOpMetrics!.errors).toBe(0);
    });

    it('should handle mixed success and error operations', async () => {
      await tracker.trackOperation('mixed-op', async () => 'success');
      
      await expect(
        tracker.trackOperation('mixed-op', async () => {
          throw new Error('failure');
        })
      ).rejects.toThrow('failure');
      
      await tracker.trackOperation('mixed-op', async () => 'success2');

      const metrics = tracker.getMetrics();
      const mixedOpMetrics = metrics['mixed-op'];
      expect(mixedOpMetrics).toBeDefined();
      expect(mixedOpMetrics!.count).toBe(3);
      expect(mixedOpMetrics!.errors).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle operations with no delay', async () => {
      const result = await tracker.trackOperation('instant-op', async () => 'instant');
      
      expect(result).toBe('instant');
      
      const metrics = tracker.getMetrics();
      const instantOpMetrics = metrics['instant-op'];
      expect(instantOpMetrics).toBeDefined();
      expect(instantOpMetrics!.count).toBe(1);
      expect(instantOpMetrics!.totalTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle operations that return undefined', async () => {
      const result = await tracker.trackOperation('undefined-op', async () => undefined);
      
      expect(result).toBeUndefined();
      
      const metrics = tracker.getMetrics();
      const undefinedOpMetrics = metrics['undefined-op'];
      expect(undefinedOpMetrics).toBeDefined();
      expect(undefinedOpMetrics!.count).toBe(1);
    });

    it('should handle operations that return null', async () => {
      const result = await tracker.trackOperation('null-op', async () => null);
      
      expect(result).toBeNull();
      
      const metrics = tracker.getMetrics();
      const nullOpMetrics = metrics['null-op'];
      expect(nullOpMetrics).toBeDefined();
      expect(nullOpMetrics!.count).toBe(1);
    });
  });
});