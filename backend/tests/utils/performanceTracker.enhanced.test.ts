import { PerformanceTracker } from '../../src/utils/encryption/performanceTracker';

describe('PerformanceTracker - Enhanced Tests', () => {
  let tracker: PerformanceTracker;

  beforeEach(() => {
    tracker = new PerformanceTracker();
  });

  afterEach(() => {
    tracker.reset();
  });

  describe('performance regression tests', () => {
    it('should track operations within acceptable overhead', async () => {
      const iterations = 100;
      const startTime = performance.now();

      const promises = Array.from({ length: iterations }, (_, i) =>
        tracker.trackOperation(`perf-test-${i % 10}`, async () => {
          // Minimal operation to test tracking overhead
          return i;
        })
      );

      await Promise.all(promises);
      const totalTime = performance.now() - startTime;

      // Tracking overhead should be minimal (less than 1ms per operation on average)
      expect(totalTime / iterations).toBeLessThan(1);
    });

    it('should handle high-frequency operations efficiently', async () => {
      const operations = 1000;
      const promises: Promise<number>[] = [];

      for (let i = 0; i < operations; i++) {
        promises.push(
          tracker.trackOperation('high-freq', async () => i)
        );
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(operations);

      const metrics = tracker.getMetrics();
      const highFreqMetrics = metrics['high-freq'];
      expect(highFreqMetrics).toBeDefined();
      expect(highFreqMetrics!.count).toBe(operations);
    });
  });

  describe('memory management', () => {
    it('should not leak memory with many different operation names', async () => {
      const operationCount = 1000;

      // Create many different operation names
      for (let i = 0; i < operationCount; i++) {
        await tracker.trackOperation(`op-${i}`, async () => i);
      }

      const metrics = tracker.getMetrics();
      expect(Object.keys(metrics)).toHaveLength(operationCount);

      // Reset should clear all metrics
      tracker.reset();
      const resetMetrics = tracker.getMetrics();
      expect(Object.keys(resetMetrics)).toHaveLength(0);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle operations that throw non-Error objects', async () => {
      await expect(
        tracker.trackOperation('string-throw', async () => {
          throw 'string error';
        })
      ).rejects.toBe('string error');

      const metrics = tracker.getMetrics();
      const stringThrowMetrics = metrics['string-throw'];
      expect(stringThrowMetrics).toBeDefined();
      expect(stringThrowMetrics!.errors).toBe(1);
    });

    it('should handle operations that throw null', async () => {
      await expect(
        tracker.trackOperation('null-throw', async () => {
          throw null;
        })
      ).rejects.toBeNull();

      const metrics = tracker.getMetrics();
      const nullThrowMetrics = metrics['null-throw'];
      expect(nullThrowMetrics).toBeDefined();
      expect(nullThrowMetrics!.errors).toBe(1);
    });
  });

  describe('timing accuracy', () => {
    it('should provide reasonably accurate timing measurements', async () => {
      const expectedDelay = 50; // 50ms

      await tracker.trackOperation('timing-test', async () => {
        await new Promise(resolve => setTimeout(resolve, expectedDelay));
        return 'done';
      });

      const metrics = tracker.getMetrics();
      const timingMetrics = metrics['timing-test'];
      expect(timingMetrics).toBeDefined();

      // More lenient timing bounds for CI environments (±30ms)
      const tolerance = 30;
      expect(timingMetrics!.totalTime).toBeGreaterThan(expectedDelay - tolerance);
      expect(timingMetrics!.totalTime).toBeLessThan(expectedDelay + tolerance * 2); // Allow more overhead
    });
  });
});