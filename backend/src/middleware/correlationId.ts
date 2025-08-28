import { Request, Response, NextFunction } from 'express';
import { CorrelationIdManager } from '../utils/logger';

// Extend Express Request interface to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Enhanced middleware to generate and track correlation IDs for request tracing
 * Also adds request timing and enhanced logging context
 */
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Generate or extract correlation ID
  const correlationId = req.headers['x-correlation-id'] as string || 
                       req.headers['x-request-id'] as string || 
                       CorrelationIdManager.generateId();
  
  // Set correlation ID in request and response headers
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  res.setHeader('X-Request-ID', correlationId);
  
  // Add request start time for duration calculation
  (req as any).startTime = Date.now();
  
  // Set correlation ID in async context
  CorrelationIdManager.run(correlationId, () => {
    // Log request start with enhanced context
    const startContext = {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      correlationId,
      contentType: req.get('Content-Type'),
      origin: req.get('Origin')
    };
    
    // Use the enhanced logger
    const { loggerWithContext } = require('../utils/logger');
    loggerWithContext.info('Request started', startContext);
    
    // Log response completion with timing
    res.on('finish', () => {
      const duration = Date.now() - (req as any).startTime;
      const responseContext = {
        ...startContext,
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('Content-Length')
      };
      
      // Log as performance if slow, info otherwise
      if (duration > 1000) {
        loggerWithContext.performance(`${req.method} ${req.url}`, duration, responseContext);
      } else {
        loggerWithContext.info('Request completed', responseContext);
      }
    });
    
    // Log errors during request processing
    res.on('error', (error) => {
      const errorContext = {
        ...startContext,
        duration: Date.now() - (req as any).startTime,
        error: error.message
      };
      
      loggerWithContext.error('Response error', error, errorContext);
    });
    
    next();
  });
};

/**
 * Utility function to get current correlation ID
 */
export const getCurrentCorrelationId = (): string | undefined => {
  return CorrelationIdManager.getId();
};