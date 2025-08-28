import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/testApp';
import { ValidationError, NotFoundError } from '../../src/utils/errors';
import { loggerWithContext } from '../../src/utils/logger';

// Mock the logger to capture log calls
jest.mock('../../src/utils/logger', () => ({
  ...jest.requireActual('../../src/utils/logger'),
  loggerWithContext: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    audit: jest.fn(),
    performance: jest.fn(),
    security: jest.fn(),
    time: jest.fn(() => jest.fn())
  }
}));

describe('Enhanced Error Logging Integration', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API Error Responses', () => {
    it('should log enhanced context for validation errors', async () => {
      // Create a test route that throws a validation error
      app.get('/test/validation-error', (req, res, next) => {
        const error = new ValidationError('Invalid email format', {
          field: 'email',
          value: 'invalid-email',
          expectedFormat: 'user@domain.com'
        }, 'test-user-123');
        
        next(error);
      });

      const response = await request(app)
        .get('/test/validation-error')
        .set('User-Agent', 'Test Integration Client')
        .set('X-Correlation-ID', 'integration-test-123')
        .expect(400);

      // Verify response structure
      expect(response.body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format',
          timestamp: expect.any(String),
          requestId: 'integration-test-123',
          correlationId: 'integration-test-123'
        }
      });

      // Verify enhanced logging was called
      expect(loggerWithContext.error).toHaveBeenCalledWith(
        'ValidationError: Invalid email format',
        expect.any(ValidationError),
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'ValidationError',
            message: 'Invalid email format',
            code: 'VALIDATION_ERROR',
            statusCode: 400,
            context: {
              field: 'email',
              value: 'invalid-email',
              expectedFormat: 'user@domain.com'
            },
            methodNames: expect.any(Array)
          }),
          request: expect.objectContaining({
            method: 'GET',
            url: '/test/validation-error',
            correlationId: 'integration-test-123',
            headers: expect.objectContaining({
              'user-agent': 'Test Integration Client'
            })
          }),
          system: expect.objectContaining({
            nodeVersion: expect.any(String),
            platform: expect.any(String),
            memory: expect.any(Object)
          }),
          correlationId: 'integration-test-123'
        })
      );
    });

    it('should log enhanced context for not found errors', async () => {
      app.get('/test/not-found-error', (req, res, next) => {
        const error = new NotFoundError('User', req.params.id || 'unknown', 'test-user-456');
        next(error);
      });

      const response = await request(app)
        .get('/test/not-found-error')
        .set('X-Request-ID', 'req-456')
        .expect(404);

      expect(response.body).toMatchObject({
        error: {
          code: 'NOT_FOUND',
          message: 'User with identifier \'unknown\' not found',
          requestId: 'req-456'
        }
      });

      // Verify logging includes resource context
      expect(loggerWithContext.error).toHaveBeenCalledWith(
        expect.stringContaining('NotFoundError'),
        expect.any(NotFoundError),
        expect.objectContaining({
          error: expect.objectContaining({
            context: expect.objectContaining({
              resource: 'User',
              identifier: 'unknown'
            })
          })
        })
      );
    });

    it('should handle request timing in error logs', async () => {
      app.get('/test/slow-error', async (req, res, next) => {
        // Simulate slow operation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const error = new Error('Slow operation failed');
        next(error);
      });

      await request(app)
        .get('/test/slow-error')
        .expect(500);

      // Verify timing information is included
      expect(loggerWithContext.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Error),
        expect.objectContaining({
          timing: expect.objectContaining({
            errorTime: expect.any(String),
            requestDuration: expect.any(Number)
          })
        })
      );

      // Verify request duration is reasonable (should be >= 100ms)
      const logCall = (loggerWithContext.error as jest.Mock).mock.calls[0];
      const timing = logCall[2].timing;
      expect(timing.requestDuration).toBeGreaterThanOrEqual(100);
    });

    it('should sanitize sensitive data in request body', async () => {
      app.post('/test/sensitive-data-error', (req, res, next) => {
        const error = new Error('Processing failed');
        next(error);
      });

      await request(app)
        .post('/test/sensitive-data-error')
        .send({
          username: 'testuser',
          password: 'secret123',
          token: 'jwt-token-here',
          normalField: 'safe-data'
        })
        .expect(500);

      // Verify sensitive data is redacted
      expect(loggerWithContext.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Error),
        expect.objectContaining({
          request: expect.objectContaining({
            body: {
              username: 'testuser',
              password: '[REDACTED]',
              token: '[REDACTED]',
              normalField: 'safe-data'
            }
          })
        })
      );
    });

    it('should include method names from stack trace', async () => {
      // Create a nested function call to generate a meaningful stack trace
      const deepFunction = () => {
        const nestedFunction = () => {
          throw new Error('Deep error');
        };
        return nestedFunction();
      };

      app.get('/test/stack-trace-error', (req, res, next) => {
        try {
          deepFunction();
        } catch (error) {
          next(error);
        }
      });

      await request(app)
        .get('/test/stack-trace-error')
        .expect(500);

      // Verify method names are extracted from stack trace
      expect(loggerWithContext.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Error),
        expect.objectContaining({
          error: expect.objectContaining({
            methodNames: expect.arrayContaining([
              expect.stringMatching(/nestedFunction|deepFunction/)
            ])
          })
        })
      );
    });
  });

  describe('Development vs Production Responses', () => {
    it('should include debug info in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      app.get('/test/dev-error', (req, res, next) => {
        const error = new ValidationError('Dev test error', { debug: 'info' });
        next(error);
      });

      const response = await request(app)
        .get('/test/dev-error')
        .expect(400);

      // Should include debug information in development
      expect(response.body.error).toHaveProperty('stack');
      expect(response.body.error).toHaveProperty('methodNames');
      expect(response.body.error).toHaveProperty('context');

      process.env.NODE_ENV = originalEnv;
    });

    it('should hide debug info in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      app.get('/test/prod-error', (req, res, next) => {
        const error = new Error('Production error');
        next(error);
      });

      const response = await request(app)
        .get('/test/prod-error')
        .expect(500);

      // Should NOT include debug information in production
      expect(response.body.error).not.toHaveProperty('stack');
      expect(response.body.error).not.toHaveProperty('methodNames');
      expect(response.body.error).not.toHaveProperty('context');
      expect(response.body.error.message).toBe('Internal Server Error');

      process.env.NODE_ENV = originalEnv;
    });
  });
});