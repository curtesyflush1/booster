import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class InMemoryRateLimitStore {
  private store: RateLimitStore = {};
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  get(key: string): { count: number; resetTime: number } | undefined {
    return this.store[key];
  }

  set(key: string, value: { count: number; resetTime: number }): void {
    this.store[key] = value;
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const existing = this.store[key];

    if (!existing || now > existing.resetTime) {
      // Create new entry or reset expired entry
      this.store[key] = {
        count: 1,
        resetTime: now + windowMs
      };
    } else {
      // Increment existing entry
      existing.count++;
    }

    return this.store[key]!;
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      const entry = this.store[key];
      if (entry && entry.resetTime < now) {
        delete this.store[key];
      }
    });
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store = {};
  }
}

// Global store instance
const store = new InMemoryRateLimitStore();

/**
 * Create rate limiting middleware
 */
export const createRateLimit = (config: RateLimitConfig) => {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip rate limiting when explicitly disabled (but not just because we're in test mode)
    if (process.env.DISABLE_RATE_LIMITING === 'true') {
      next();
      return;
    }
    // Generate key based on IP address
    const key = `rate_limit:${req.ip}`;

    // Get current count
    const current = store.increment(key, windowMs);

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, maxRequests - current.count).toString(),
      'X-RateLimit-Reset': new Date(current.resetTime).toISOString()
    });

    // Check if limit exceeded
    if (current.count > maxRequests) {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        count: current.count,
        limit: maxRequests
      });

      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          timestamp: new Date().toISOString(),
          retryAfter: Math.ceil((current.resetTime - Date.now()) / 1000)
        }
      });
      return;
    }

    // Handle response tracking for skip options
    if (skipSuccessfulRequests || skipFailedRequests) {
      const originalSend = res.send;
      res.send = function(body) {
        const statusCode = res.statusCode;
        const shouldSkip = 
          (skipSuccessfulRequests && statusCode < 400) ||
          (skipFailedRequests && statusCode >= 400);

        if (shouldSkip && current.count > 0) {
          // Decrement count if we should skip this request
          current.count--;
          store.set(key, current);
        }

        return originalSend.call(this, body);
      };
    }

    next();
  };
};

/**
 * Predefined rate limiters for common use cases
 */

// General API rate limiter - 100 requests per 15 minutes
export const generalRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many requests from this IP, please try again later'
});

// Authentication rate limiter - 5 attempts per 15 minutes
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true // Don't count successful logins against the limit
});

// Password reset rate limiter - 3 attempts per hour
export const passwordResetRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  message: 'Too many password reset attempts, please try again later'
});

// Registration rate limiter - 3 registrations per hour per IP
export const registrationRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  message: 'Too many registration attempts, please try again later'
});

// Strict rate limiter for sensitive operations - 10 requests per hour
export const strictRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  message: 'Rate limit exceeded for this operation'
});

// Export store for testing purposes
export { store as rateLimitStore };