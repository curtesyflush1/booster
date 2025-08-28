/**
 * Example demonstrating enhanced error logging capabilities
 * This file shows how to use the new error handling features
 */

import { Request, Response } from 'express';
import { 
  ValidationError, 
  NotFoundError, 
  DatabaseError,
  ErrorUtils,
  asyncRouteHandler 
} from './errors';
import { loggerWithContext, createContextualError } from './logger';

/**
 * Example controller method showing enhanced error logging
 */
export const exampleController = asyncRouteHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const operation = 'getUserProfile';
  
  try {
    // Example of input validation with contextual error
    if (!userId || userId.length < 3) {
      throw new ValidationError('Invalid user ID format', {
        providedUserId: userId,
        expectedFormat: 'string with minimum 3 characters',
        validationRule: 'USER_ID_FORMAT'
      }, userId);
    }
    
    // Example of database operation with error context
    const user = await getUserFromDatabase(userId);
    
    if (!user) {
      throw new NotFoundError('User', userId, userId);
    }
    
    // Log successful operation
    loggerWithContext.info('User profile retrieved successfully', {
      userId,
      operation,
      profileFields: Object.keys(user)
    });
    
    res.json({ user });
    
  } catch (error) {
    // Error will be automatically handled by errorHandler middleware
    // with full context including stack trace, method names, and request details
    throw error;
  }
});

/**
 * Example database function showing error wrapping
 */
async function getUserFromDatabase(userId: string) {
  try {
    // Simulate database call
    const result = await simulateDatabaseQuery(userId);
    return result;
  } catch (error) {
    // Wrap database errors with additional context
    throw new DatabaseError(
      'Failed to retrieve user from database',
      error as Error,
      'getUserFromDatabase',
      userId
    );
  }
}

/**
 * Example of external service call with error handling
 */
export const callExternalService = async (endpoint: string, data: any) => {
  const operation = 'externalServiceCall';
  const timer = loggerWithContext.time(operation);
  
  try {
    // Simulate external service call
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw ErrorUtils.fromHttpResponse('external-api', {
        status: response.status,
        statusText: response.statusText
      }, operation);
    }
    
    const result = await response.json();
    
    // Log successful operation with timing
    timer();
    loggerWithContext.info('External service call completed', {
      endpoint,
      operation,
      responseStatus: response.status
    });
    
    return result;
    
  } catch (error) {
    timer();
    
    // Log error with full context
    loggerWithContext.error('External service call failed', error as Error, {
      endpoint,
      operation,
      requestData: data
    });
    
    throw error;
  }
};

/**
 * Example showing how to create contextual errors manually
 */
export const processUserAction = async (userId: string, action: string) => {
  try {
    // Some processing logic here
    if (action === 'invalid') {
      // Create error with full context
      throw createContextualError('Invalid action requested', {
        statusCode: 400,
        code: 'INVALID_ACTION',
        operation: 'processUserAction',
        context: {
          allowedActions: ['create', 'update', 'delete'],
          providedAction: action,
          userId
        },
        userId
      });
    }
    
    // Process action...
    return { success: true };
    
  } catch (error) {
    // Error will include:
    // - Full stack trace with method names
    // - Correlation ID for request tracking
    // - User context and operation details
    // - Request information from middleware
    throw error;
  }
};

// Simulate database query for example
async function simulateDatabaseQuery(userId: string) {
  // Simulate random database error
  if (Math.random() < 0.1) {
    throw new Error('Database connection timeout');
  }
  
  return userId === 'test' ? { id: userId, name: 'Test User' } : null;
}

/**
 * Example of error logging in middleware
 */
export const exampleMiddleware = (req: Request, res: Response, next: any) => {
  try {
    // Some middleware logic
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw createContextualError('Missing authorization header', {
        statusCode: 401,
        code: 'MISSING_AUTH_HEADER',
        operation: 'authenticationMiddleware',
        context: {
          endpoint: req.path,
          method: req.method,
          headers: Object.keys(req.headers)
        }
      });
    }
    
    next();
  } catch (error) {
    next(error); // Pass to error handler with full context
  }
};