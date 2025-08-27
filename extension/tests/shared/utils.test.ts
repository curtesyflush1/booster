// Tests for shared utility functions

import { 
  getCurrentRetailer, 
  isSupportedRetailer, 
  generateId, 
  isValidEmail, 
  formatCurrency, 
  formatRelativeTime,
  debounce,
  throttle
} from '../../src/shared/utils';

// Mock chrome APIs for testing
(globalThis as any).chrome = {
  runtime: {
    sendMessage: jest.fn(),
    lastError: null
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    }
  }
};

describe('Utility Functions', () => {
  describe('getCurrentRetailer', () => {
    it('should identify Best Buy correctly', () => {
      const retailer = getCurrentRetailer('https://www.bestbuy.com/site/pokemon');
      expect(retailer).toBeTruthy();
      expect(retailer?.id).toBe('bestbuy');
      expect(retailer?.name).toBe('Best Buy');
    });

    it('should identify Walmart correctly', () => {
      const retailer = getCurrentRetailer('https://www.walmart.com/ip/pokemon-cards');
      expect(retailer).toBeTruthy();
      expect(retailer?.id).toBe('walmart');
      expect(retailer?.name).toBe('Walmart');
    });

    it('should identify Costco correctly', () => {
      const retailer = getCurrentRetailer('https://www.costco.com/pokemon-trading-cards');
      expect(retailer).toBeTruthy();
      expect(retailer?.id).toBe('costco');
      expect(retailer?.name).toBe('Costco');
    });

    it('should identify Sams Club correctly', () => {
      const retailer = getCurrentRetailer('https://www.samsclub.com/p/pokemon-cards');
      expect(retailer).toBeTruthy();
      expect(retailer?.id).toBe('samsclub');
      expect(retailer?.name).toBe("Sam's Club");
    });

    it('should return null for unsupported sites', () => {
      const retailer = getCurrentRetailer('https://www.amazon.com/pokemon');
      expect(retailer).toBeNull();
    });

    it('should handle invalid URLs gracefully', () => {
      expect(() => getCurrentRetailer('not-a-url')).toThrow();
    });
  });

  describe('isSupportedRetailer', () => {
    it('should return true for supported retailers', () => {
      expect(isSupportedRetailer('https://www.bestbuy.com')).toBe(true);
      expect(isSupportedRetailer('https://www.walmart.com')).toBe(true);
      expect(isSupportedRetailer('https://www.costco.com')).toBe(true);
      expect(isSupportedRetailer('https://www.samsclub.com')).toBe(true);
    });

    it('should return false for unsupported retailers', () => {
      expect(isSupportedRetailer('https://www.amazon.com')).toBe(false);
      expect(isSupportedRetailer('https://www.target.com')).toBe(false);
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    it('should generate IDs of reasonable length', () => {
      const id = generateId();
      expect(id.length).toBeGreaterThan(10);
      expect(id.length).toBeLessThan(30);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test.example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(49.99)).toBe('$49.99');
      expect(formatCurrency(100)).toBe('$100.00');
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('should handle negative values', () => {
      expect(formatCurrency(-10.50)).toBe('-$10.50');
    });
  });

  describe('formatRelativeTime', () => {
    const now = Date.now();
    
    it('should format recent times correctly', () => {
      expect(formatRelativeTime(now)).toBe('Just now');
      expect(formatRelativeTime(now - 30 * 1000)).toBe('Just now'); // 30 seconds ago
    });

    it('should format minutes correctly', () => {
      expect(formatRelativeTime(now - 2 * 60 * 1000)).toBe('2 minutes ago');
      expect(formatRelativeTime(now - 1 * 60 * 1000)).toBe('1 minute ago');
    });

    it('should format hours correctly', () => {
      expect(formatRelativeTime(now - 2 * 60 * 60 * 1000)).toBe('2 hours ago');
      expect(formatRelativeTime(now - 1 * 60 * 60 * 1000)).toBe('1 hour ago');
    });

    it('should format days correctly', () => {
      expect(formatRelativeTime(now - 2 * 24 * 60 * 60 * 1000)).toBe('2 days ago');
      expect(formatRelativeTime(now - 1 * 24 * 60 * 60 * 1000)).toBe('1 day ago');
    });

    it('should handle string timestamps', () => {
      const timestamp = new Date(now - 60 * 1000).toISOString();
      expect(formatRelativeTime(timestamp)).toBe('1 minute ago');
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    it('should debounce function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments correctly', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('arg1', 'arg2');

      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });

  describe('throttle', () => {
    jest.useFakeTimers();

    it('should throttle function calls', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);

      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });
});