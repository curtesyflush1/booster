import { ValidationError } from 'joi';
import { logger } from './logger';

export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: any;
  code?: string;
}

export interface StandardValidationError {
  code: string;
  message: string;
  details: ValidationErrorDetail[];
  timestamp: string;
  correlationId?: string;
}

/**
 * Centralized validation error formatting
 * Ensures consistent error responses across the application
 */
export class ValidationErrorHandler {
  /**
   * Format Joi validation errors into standardized format
   */
  static formatJoiError(
    error: ValidationError,
    correlationId?: string
  ): StandardValidationError {
    const details: ValidationErrorDetail[] = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message.replace(/"/g, ''),
      value: detail.context?.value,
      code: detail.type
    }));

    return {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details,
      timestamp: new Date().toISOString(),
      correlationId
    };
  }

  /**
   * Log validation errors with context
   */
  static logValidationError(
    error: ValidationError,
    context: {
      path: string;
      method: string;
      userId?: string;
      correlationId?: string;
      userAgent?: string;
    }
  ): void {
    logger.warn('Validation failed', {
      error: this.formatJoiError(error, context.correlationId),
      context
    });
  }

  /**
   * Create a validation error response
   */
  static createErrorResponse(
    error: ValidationError,
    correlationId?: string
  ) {
    return {
      error: this.formatJoiError(error, correlationId)
    };
  }
}