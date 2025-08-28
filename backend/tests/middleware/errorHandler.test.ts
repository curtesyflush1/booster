import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../src/middleware/errorHandler';
import { ValidationError, NotFoundError, DatabaseError } from '../../src/utils/errors';
import { CorrelationIdManager } from '../../src/utils/logger';

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn()
  },
  loggerWithContext: {
    error: jest.fn()
  },
  CorrelationIdManager: {
    getId: jest.fn()
  }
}));

describe('Enhanced Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockSetHeader: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockSetHeader = jest.fn();

    mockRequest = {
      method: 'POST',
      url: '/api/users',
      originalUrl: '/api/users',
      path: '/api/users',
      ip: '127.0.0.1',
      ips: [],
      protocol: 'http',
      secure: false,
      query: { page: '1' },
      params: { id: '123' },
      body: { name: 'Test User', password: 'secret123' },
      headers: {
        'user-agent': 'Test Agent',
        'content-type': 'application/json',
        'x-correlation-id': 'test-correlation-id'
      },
      get: jest.fn((header: string) => {
        const headers: Record<string, string | string[]> = {
          'User-Agent': 'Test Agent',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'http://localhost:3000',
          'set-cookie': ['cookie1=value1', 'cookie2=value2']
        };
        return headers[header];
      }) as any,
      correlationId: 'test-correlation-id'
    };

    mockResponse = {
      status: mockStatus,
      json: mockJson,
      setHeader: mockSetHeader
    };

    mockNext = jest.fn();

    // Mock correlation ID manager
    (CorrelationIdManager.getId as jest.Mock).mockReturnValue('test-correlation-id');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Enhanced Error Context', () => {
    it('should log comprehensive error context for ValidationError', () => {
      const error = new ValidationError('Invalid input', {
        field: 'email',
        value: 'invalid-email'
      }, 'user123');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      // Verify enhanced logging was called
      const { loggerWithContext } = require('../../src/utils/logger');
      expect(loggerWithContext.error).toHaveBeenCalledWith(
        'ValidationError: Invalid input',
        error,
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'ValidationError',
            message: 'Invalid input',
            stack: expect.any(String),
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            methodNames: expect.any(Array),
            context: { field: 'email', value: 'invalid-email' },
            operation: 'validation'
          }),
          request: expect.objectContaining({
            method: 'POST',
            url: '/api/users',
            correlationId: 'test-correlation-id',
            body: { name: 'Test User', password: '[REDACTED]' } // Password should be sanitized
          }),
          system: expect.objectContaining({
            nodeVersion: expect.any(String),
            platform: expect.any(String),
            memory: expect.any(Object),
            uptime: expect.any(Number),
            pid: expect.any(Number)
          }),
          timing: expect.objectContaining({
            errorTime: expect.any(String)
          }),
          operation: 'validation',
          correlationId: 'test-correlation-id'
        })
      );
    });

    it('should extract method names from stack trace', () => {
      const error = new Error('Test error');
      // Mock stack trace with method names
      error.stack = `Error: Test error
    at UserController.createUser (/app/controllers/userController.js:25:15)
    at Router.handle (/app/node_modules/express/lib/router/layer.js:95:5)
    at next (/app/node_modules/express/lib/router/route.js:137:13)`;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const { loggerWithContext } = require('../../src/utils/logger');
      const logCall = loggerWithContext.error.mock.calls[0];
      const errorContext = logCall[2];

      expect(errorContext.error.methodNames).toContain('UserController.createUser');
      expect(errorContext.error.methodNames).toContain('Router.handle');
    });

    it('should sanitize sensitive data in request body', () => {
      const error = new Error('Test error');
      mockRequest.body = {
        username: 'testuser',
        password: 'secret123',
        token: 'jwt-token',
        secret: 'api-secret',
        normalField: 'normal-value'
      };

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const { loggerWithContext } = require('../../src/utils/logger');
      const logCall = loggerWithContext.error.mock.calls[0];
      const requestContext = logCall[2].request;

      expect(requestContext.body).toEqual({
        username: 'testuser',
        password: '[REDACTED]',
        token: '[REDACTED]',
        secret: '[REDACTED]',
        normalField: 'normal-value'
      });
    });

    it('should include request timing when available', () => {
      const error = new Error('Test error');
      (mockRequest as any).startTime = Date.now() - 1500; // 1.5 seconds ago

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const { loggerWithContext } = require('../../src/utils/logger');
      const logCall = loggerWithContext.error.mock.calls[0];
      const timingContext = logCall[2].timing;

      expect(timingContext.requestDuration).toBeGreaterThan(1400);
      expect(timingContext.requestDuration).toBeLessThan(1600);
    });

    it('should handle errors with cause chain', () => {
      const rootCause = new Error('Database connection failed');
      const error = new DatabaseError('User creation failed', rootCause, 'createUser', 'user123');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const { loggerWithContext } = require('../../src/utils/logger');
      const logCall = loggerWithContext.error.mock.calls[0];
      const errorContext = logCall[2].error;

      expect(errorContext.cause).toEqual({
        name: 'Error',
        message: 'Database connection failed',
        stack: expect.any(String)
      });
    });
  });

  describe('Response Handling', () => {
    it('should return enhanced error response in development', () => {
      process.env.NODE_ENV = 'development';
      
      const error = new ValidationError('Invalid input', { field: 'email' }, 'user123');
      (error as any).operation = 'validateUserInput';

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          timestamp: expect.any(String),
          requestId: 'test-correlation-id',
          correlationId: 'test-correlation-id',
          stack: expect.any(String),
          methodNames: expect.any(Array),
          operation: 'validateUserInput',
          context: { field: 'email' }
        })
      });
    });

    it('should return safe error response in production', () => {
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Internal database error');
      error.stack = 'Error: Internal database error\n    at Database.query...';

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal Server Error',
          statusCode: 500,
          timestamp: expect.any(String),
          requestId: 'test-correlation-id',
          correlationId: 'test-correlation-id'
          // Should NOT include stack, methodNames, operation, or context in production
        }
      });
    });

    it('should handle NotFoundError correctly', () => {
      const error = new NotFoundError('User', '123', 'user456');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: "User with identifier '123' not found",
          statusCode: 404
        })
      });
    });
  });

  describe('System Context', () => {
    it('should include system information in error context', () => {
      const error = new Error('Test error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const { loggerWithContext } = require('../../src/utils/logger');
      const logCall = loggerWithContext.error.mock.calls[0];
      const systemContext = logCall[2].system;

      expect(systemContext).toEqual({
        nodeVersion: process.version,
        platform: process.platform,
        memory: expect.any(Object),
        uptime: expect.any(Number),
        pid: process.pid
      });
    });

    it('should include user context when available', () => {
      const error = new Error('Test error');
      (mockRequest as any).user = { id: 'user123', role: 'admin' };

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const { loggerWithContext } = require('../../src/utils/logger');
      const logCall = loggerWithContext.error.mock.calls[0];
      const requestContext = logCall[2].request;

      expect(requestContext.userId).toBe('user123');
      expect(requestContext.userRole).toBe('admin');
    });
  });
});