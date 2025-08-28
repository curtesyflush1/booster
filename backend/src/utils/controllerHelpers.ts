import { Response, NextFunction } from 'express';
import { logger } from './logger';
import { AuthenticatedRequest } from '../types/express';

/**
 * Centralized error handler for dashboard controllers
 */
export const handleControllerError = (
  error: unknown,
  req: AuthenticatedRequest,
  next: NextFunction,
  context: string
): void => {
  logger.error(`Error in ${context}`, {
    userId: req.user.id,
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  });
  next(error);
};

/**
 * Standard success response wrapper
 */
export const sendSuccessResponse = (
  res: Response,
  data: any,
  statusCode: number = 200
): void => {
  res.status(statusCode).json(data);
};

/**
 * Standard error response wrapper
 */
export const sendErrorResponse = (
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400
): void => {
  res.status(statusCode).json({
    error: {
      code,
      message,
      timestamp: new Date().toISOString()
    }
  });
};