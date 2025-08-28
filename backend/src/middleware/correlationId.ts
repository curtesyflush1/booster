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
 * Middleware to generate and track correlation IDs for request tracing
 */
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Generate or extract correlation ID
  const correlationId = req.headers['x-correlation-id'] as string || CorrelationIdManager.generateId();
  
  // Set correlation ID in request and response headers
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Set correlation ID in async context
  CorrelationIdManager.setId(correlationId);
  
  // Clean up on response finish
  res.on('finish', () => {
    CorrelationIdManager.clearId();
  });
  
  next();
};

/**
 * Utility function to get current correlation ID
 */
export const getCurrentCorrelationId = (): string | undefined => {
  return CorrelationIdManager.getId();
};