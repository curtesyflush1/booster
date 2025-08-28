import express, { Express } from 'express';
import { correlationIdMiddleware } from '../../src/middleware/correlationId';
import { errorHandler } from '../../src/middleware/errorHandler';

/**
 * Create a test Express application with error handling middleware
 */
export const createTestApp = async (): Promise<Express> => {
  const app = express();

  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Add correlation ID middleware for request tracking
  app.use(correlationIdMiddleware);

  // Add a basic health check route
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
};