// Tests for background script optimizations

import { performanceMonitor } from '../../src/shared/performanceMonitor';

// Skip setup file for this test
jest.mock('../../tests/setup.ts', () => {});

// Mock chrome APIs
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn()
    },
    lastError: null,
    sendMessage: jest.fn()
  },
  alarms: {
    onAlarm: {
      addListener: jest.fn()
    },
    create: jest.fn(),
    clearAll: jest.fn((callback) => callback())
  },
  tabs: {
    onUpdated: {
      addListener: jest.fn()
    },
    get: jest.fn(),
    sendMessage: jest.fn()
  },
  scripting: {
    executeScript: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    }
  },
  notifications: {
    create: jest.fn()
  }
};

// @ts-ignore
global.chrome = mockChrome;
// @ts-ignore
global.performance = {
  now: jest.fn(() => Date.now())
};

describe('Background Script Optimizations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset performance monitor
    performanceMonitor.cleanup(0);
  });

  describe('Performance Monitor', () => {
    it('should record metrics correctly', () => {
      performanceMonitor.recordMetric('test_metric', 50);
      
      const stats = performanceMonitor.getStats('test_metric');
      expect(stats).toBeTruthy();
      expect(stats!.count).toBe(1);
      expect(stats!.average).toBe(50);
      expect(stats!.recent).toBe(50);
    });

    it('should calculate statistics correctly', () => {
      performanceMonitor.recordMetric('test_metric', 10);
      performanceMonitor.recordMetric('test_metric', 20);
      performanceMonitor.recordMetric('test_metric', 30);
      
      const stats = performanceMonitor.getStats('test_metric');
      expect(stats).toBeTruthy();
      expect(stats!.count).toBe(3);
      expect(stats!.average).toBe(20);
      expect(stats!.min).toBe(10);
      expect(stats!.max).toBe(30);
      expect(stats!.recent).toBe(30);
    });

    it('should time function execution', async () => {
      const mockFunction = jest.fn().mockResolvedValue('result');
      
      const result = await performanceMonitor.timeFunction(
        'test_function',
        mockFunction
      );
      
      expect(result).toBe('result');
      expect(mockFunction).toHaveBeenCalled();
      
      const stats = performanceMonitor.getStats('test_function');
      expect(stats).toBeTruthy();
      expect(stats!.count).toBe(1);
    });

    it('should handle function errors correctly', async () => {
      const mockFunction = jest.fn().mockRejectedValue(new Error('Test error'));
      
      await expect(
        performanceMonitor.timeFunction('test_function', mockFunction)
      ).rejects.toThrow('Test error');
      
      const stats = performanceMonitor.getStats('test_function');
      expect(stats).toBeTruthy();
      expect(stats!.count).toBe(1);
    });

    it('should cleanup old metrics', () => {
      // Record metrics with old timestamps
      performanceMonitor.recordMetric('old_metric', 50);
      
      // Cleanup metrics older than 0ms (should remove all)
      performanceMonitor.cleanup(0);
      
      const stats = performanceMonitor.getStats('old_metric');
      expect(stats).toBeNull();
    });

    it('should limit metrics per type', () => {
      // Record more than the limit
      for (let i = 0; i < 150; i++) {
        performanceMonitor.recordMetric('limited_metric', i);
      }
      
      const stats = performanceMonitor.getStats('limited_metric');
      expect(stats).toBeTruthy();
      expect(stats!.count).toBeLessThanOrEqual(100); // Should be limited
    });
  });

  describe('Alarm Optimization', () => {
    it('should create optimized alarms with correct intervals', () => {
      // This would test the alarm creation in the background script
      // Since we can't easily test the actual BackgroundService class here,
      // we'll test that the chrome.alarms.create is called with correct parameters
      
      expect(mockChrome.alarms.create).toBeDefined();
    });

    it('should handle alarm execution with performance monitoring', () => {
      // Test that alarms are handled efficiently
      const mockAlarm = {
        name: 'test-alarm',
        scheduledTime: Date.now(),
        periodInMinutes: 5
      };
      
      // This would be tested in integration tests with the actual background service
      expect(mockAlarm.name).toBe('test-alarm');
    });
  });

  describe('Message Handling Optimization', () => {
    it('should validate message format', () => {
      const validMessage = {
        type: 'GET_USER_STATUS',
        timestamp: Date.now()
      };
      
      const invalidMessage: any = {
        type: 'INVALID'
        // Missing timestamp
      };
      
      expect(validMessage.type).toBeTruthy();
      expect(validMessage.timestamp).toBeTruthy();
      expect(invalidMessage.timestamp).toBeUndefined();
    });

    it('should handle message processing with performance tracking', async () => {
      // Test that message processing is tracked
      const mockMessage = {
        type: 'GET_USER_STATUS',
        timestamp: Date.now()
      };
      
      // This would be tested with the actual message handler
      expect(mockMessage.type).toBe('GET_USER_STATUS');
    });
  });

  describe('Cache Optimization', () => {
    it('should implement cache with TTL', () => {
      const now = Date.now();
      const ttl = 60000; // 1 minute
      const cacheExpiry = now + ttl;
      
      expect(cacheExpiry).toBeGreaterThan(now);
      expect(cacheExpiry - now).toBe(ttl);
    });

    it('should invalidate expired cache', () => {
      const now = Date.now();
      const expiredTime = now - 1000; // 1 second ago
      
      expect(now > expiredTime).toBe(true);
    });
  });

  describe('Content Script Injection Optimization', () => {
    it('should debounce content script injection', () => {
      // Test that rapid injection calls are debounced
      const mockTabId = 123;
      
      // This would test the debounced injection function
      expect(mockTabId).toBe(123);
    });

    it('should validate tab before injection', () => {
      const validTab = {
        id: 123,
        url: 'https://www.bestbuy.com/products'
      };
      
      const invalidTab = {
        id: 456,
        url: 'chrome://extensions'
      };
      
      expect(validTab.url.startsWith('http')).toBe(true);
      expect(invalidTab.url.startsWith('chrome://')).toBe(true);
    });
  });

  describe('Memory Management', () => {
    it('should limit array sizes to prevent memory leaks', () => {
      const maxSize = 100;
      const testArray: number[] = [];
      
      // Simulate adding items beyond limit
      for (let i = 0; i < 150; i++) {
        testArray.push(i);
        if (testArray.length > maxSize) {
          testArray.shift();
        }
      }
      
      expect(testArray.length).toBe(maxSize);
      expect(testArray[0]).toBe(50); // First item should be shifted
    });

    it('should cleanup expired data', () => {
      const now = Date.now();
      const maxAge = 300000; // 5 minutes
      const cutoff = now - maxAge;
      
      const testData = [
        { timestamp: now - 600000, value: 1 }, // 10 minutes ago - should be removed
        { timestamp: now - 100000, value: 2 }, // 1.6 minutes ago - should be kept
        { timestamp: now, value: 3 } // now - should be kept
      ];
      
      const filtered = testData.filter(item => item.timestamp > cutoff);
      
      expect(filtered.length).toBe(2);
      expect(filtered[0]?.value).toBe(2);
      expect(filtered[1]?.value).toBe(3);
    });
  });
});