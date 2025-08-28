import { performance } from 'perf_hooks';
import request from 'supertest';
import app from '../../src/index';

// Global test app instance
let testApp: any;

// Performance test utilities
export class PerformanceTestHelper {
  private static measurements: Map<string, number[]> = new Map();

  static startMeasurement(testName: string): number {
    return performance.now();
  }

  static endMeasurement(testName: string, startTime: number): number {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (!this.measurements.has(testName)) {
      this.measurements.set(testName, []);
    }
    
    this.measurements.get(testName)!.push(duration);
    return duration;
  }

  static getAverageTime(testName: string): number {
    const measurements = this.measurements.get(testName) || [];
    return measurements.length > 0 ? measurements.reduce((a, b) => a + b, 0) / measurements.length : 0;
  }

  static getP95Time(testName: string): number {
    const measurements = this.measurements.get(testName) || [];
    if (measurements.length === 0) return 0;
    
    const sorted = measurements.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[index];
  }

  static clearMeasurements(): void {
    this.measurements.clear();
  }

  static getAllMeasurements(): Map<string, number[]> {
    return new Map(this.measurements);
  }
}

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  API_RESPONSE_TIME: 500, // 500ms
  DATABASE_QUERY_TIME: 100, // 100ms
  ALERT_PROCESSING_TIME: 1000, // 1 second
  BULK_OPERATION_TIME: 5000, // 5 seconds
  CONCURRENT_REQUESTS: 50, // 50 concurrent requests
  MEMORY_USAGE_MB: 512, // 512MB
};

// Load testing utilities
export class LoadTestHelper {
  static async runConcurrentRequests<T>(
    requestFn: () => Promise<T>,
    concurrency: number,
    totalRequests: number
  ): Promise<{
    results: T[];
    errors: Error[];
    averageTime: number;
    p95Time: number;
    throughput: number;
  }> {
    const results: T[] = [];
    const errors: Error[] = [];
    const times: number[] = [];
    
    const startTime = performance.now();
    
    // Run requests in batches
    for (let i = 0; i < totalRequests; i += concurrency) {
      const batch = Math.min(concurrency, totalRequests - i);
      const promises = Array.from({ length: batch }, async () => {
        const requestStart = performance.now();
        try {
          const result = await requestFn();
          const requestTime = performance.now() - requestStart;
          times.push(requestTime);
          results.push(result);
        } catch (error) {
          errors.push(error as Error);
        }
      });
      
      await Promise.all(promises);
    }
    
    const totalTime = performance.now() - startTime;
    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const sortedTimes = times.sort((a, b) => a - b);
    const p95Time = sortedTimes[Math.ceil(sortedTimes.length * 0.95) - 1] || 0;
    const throughput = (results.length / totalTime) * 1000; // requests per second
    
    return {
      results,
      errors,
      averageTime,
      p95Time,
      throughput
    };
  }
}

// Memory monitoring utilities
export class MemoryMonitor {
  private static initialMemory: NodeJS.MemoryUsage;
  
  static startMonitoring(): void {
    this.initialMemory = process.memoryUsage();
  }
  
  static getCurrentUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }
  
  static getMemoryDelta(): {
    heapUsedMB: number;
    heapTotalMB: number;
    externalMB: number;
    rssMB: number;
  } {
    const current = process.memoryUsage();
    const initial = this.initialMemory || current;
    
    return {
      heapUsedMB: (current.heapUsed - initial.heapUsed) / 1024 / 1024,
      heapTotalMB: (current.heapTotal - initial.heapTotal) / 1024 / 1024,
      externalMB: (current.external - initial.external) / 1024 / 1024,
      rssMB: (current.rss - initial.rss) / 1024 / 1024,
    };
  }
}

// Setup and teardown
beforeAll(async () => {
  console.log('🚀 Setting up performance test environment...');
  testApp = request(app);
  
  // Warm up the application
  console.log('🔥 Warming up application...');
  for (let i = 0; i < 5; i++) {
    try {
      await testApp.get('/health');
    } catch (error) {
      // Ignore warm-up errors
    }
  }
  console.log('✅ Performance test setup complete');
});

afterAll(async () => {
  console.log('🧹 Cleaning up performance test environment...');
  // Cleanup handled by individual test teardown
  console.log('✅ Performance test cleanup complete');
});

beforeEach(() => {
  PerformanceTestHelper.clearMeasurements();
  MemoryMonitor.startMonitoring();
});

afterEach(() => {
  // Log performance metrics
  const measurements = PerformanceTestHelper.getAllMeasurements();
  const memoryDelta = MemoryMonitor.getMemoryDelta();
  
  if (measurements.size > 0) {
    console.log('📊 Performance metrics:');
    measurements.forEach((times, name) => {
      console.log(`  ${name}: avg=${PerformanceTestHelper.getAverageTime(name).toFixed(2)}ms, p95=${PerformanceTestHelper.getP95Time(name).toFixed(2)}ms`);
    });
    console.log(`  Memory delta: heap=${memoryDelta.heapUsedMB.toFixed(2)}MB, rss=${memoryDelta.rssMB.toFixed(2)}MB`);
  }
});

// Export test app for use in performance tests
export { testApp };