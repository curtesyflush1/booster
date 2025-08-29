import { logger } from './logger';
import { AuthenticatedRequest } from '../types/express';

/**
 * Performance monitoring decorator for controller methods
 */
export function withPerformanceMonitoring(methodName: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (req: AuthenticatedRequest, ...args: any[]) {
      const startTime = Date.now();
      const userId = req.user?.id;
      const correlationId = req.headers['x-correlation-id'];

      try {
        const result = await originalMethod.apply(this, [req, ...args]);
        
        const duration = Date.now() - startTime;
        logger.info(`${methodName} completed successfully`, {
          userId,
          duration,
          correlationId,
          method: req.method,
          path: req.path
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`${methodName} failed`, {
          userId,
          duration,
          correlationId,
          method: req.method,
          path: req.path,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        throw error;
      }
    };

    return descriptor;
  };
}