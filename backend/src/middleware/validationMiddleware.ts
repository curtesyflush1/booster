import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ResponseHelper } from '../utils/responseHelpers';
import { logger } from '../utils/logger';

export interface ValidationSchemas {
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  body?: Joi.ObjectSchema;
}

export interface ValidationOptions {
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

/**
 * Enhanced Joi validation middleware with comprehensive error handling and logging
 */
export const validate = (schemas: ValidationSchemas, options: ValidationOptions = {}) => {
  const defaultOptions = {
    allowUnknown: false,
    stripUnknown: true,
    abortEarly: false,
    ...options
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Array<{ field: string; message: string; value?: any }> = [];
    const validatedData: { query?: any; params?: any; body?: any } = {};

    try {
      // Validate query parameters
      if (schemas.query) {
        const { error, value } = schemas.query.validate(req.query, defaultOptions);
        if (error) {
          errors.push(...error.details.map(detail => ({
            field: `query.${detail.path.join('.')}`,
            message: detail.message,
            value: detail.context?.value
          })));
        } else {
          validatedData.query = value;
          req.query = value; // Replace with validated/sanitized data
        }
      }

      // Validate path parameters
      if (schemas.params) {
        const { error, value } = schemas.params.validate(req.params, defaultOptions);
        if (error) {
          errors.push(...error.details.map(detail => ({
            field: `params.${detail.path.join('.')}`,
            message: detail.message,
            value: detail.context?.value
          })));
        } else {
          validatedData.params = value;
          req.params = value; // Replace with validated/sanitized data
        }
      }

      // Validate request body
      if (schemas.body) {
        const { error, value } = schemas.body.validate(req.body, defaultOptions);
        if (error) {
          errors.push(...error.details.map(detail => ({
            field: `body.${detail.path.join('.')}`,
            message: detail.message,
            value: detail.context?.value
          })));
        } else {
          validatedData.body = value;
          req.body = value; // Replace with validated/sanitized data
        }
      }

      if (errors.length > 0) {
        logger.warn('Request validation failed', {
          errors,
          path: req.path,
          method: req.method,
          userId: req.user?.id,
          correlationId: req.correlationId
        });

        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: errors,
            timestamp: new Date().toISOString(),
            correlationId: req.correlationId
          }
        });
        return;
      }

      // Log successful validation in debug mode
      logger.debug('Request validation successful', {
        path: req.path,
        method: req.method,
        validatedFields: Object.keys(validatedData),
        userId: req.user?.id,
        correlationId: req.correlationId
      });

      next();
    } catch (validationError) {
      logger.error('Validation middleware error', {
        error: validationError instanceof Error ? validationError.message : 'Unknown error',
        path: req.path,
        method: req.method,
        correlationId: req.correlationId
      });

      res.status(500).json({
        error: {
          code: 'VALIDATION_MIDDLEWARE_ERROR',
          message: 'Internal validation error',
          timestamp: new Date().toISOString(),
          correlationId: req.correlationId
        }
      });
    }
  };
};

/**
 * Simplified validation for single schema type
 */
export const validateBody = (schema: Joi.ObjectSchema, options?: ValidationOptions) => 
  validate({ body: schema }, options);

export const validateQuery = (schema: Joi.ObjectSchema, options?: ValidationOptions) => 
  validate({ query: schema }, options);

export const validateParams = (schema: Joi.ObjectSchema, options?: ValidationOptions) => 
  validate({ params: schema }, options);

/**
 * Validation middleware that only validates without replacing request data
 */
export const validateOnly = (schemas: ValidationSchemas, options: ValidationOptions = {}) => {
  const defaultOptions = {
    allowUnknown: true,
    stripUnknown: false,
    abortEarly: false,
    ...options
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Array<{ field: string; message: string; value?: any }> = [];

    try {
      // Validate query parameters (without modifying req.query)
      if (schemas.query) {
        const { error } = schemas.query.validate(req.query, defaultOptions);
        if (error) {
          errors.push(...error.details.map(detail => ({
            field: `query.${detail.path.join('.')}`,
            message: detail.message,
            value: detail.context?.value
          })));
        }
      }

      // Validate path parameters (without modifying req.params)
      if (schemas.params) {
        const { error } = schemas.params.validate(req.params, defaultOptions);
        if (error) {
          errors.push(...error.details.map(detail => ({
            field: `params.${detail.path.join('.')}`,
            message: detail.message,
            value: detail.context?.value
          })));
        }
      }

      // Validate request body (without modifying req.body)
      if (schemas.body) {
        const { error } = schemas.body.validate(req.body, defaultOptions);
        if (error) {
          errors.push(...error.details.map(detail => ({
            field: `body.${detail.path.join('.')}`,
            message: detail.message,
            value: detail.context?.value
          })));
        }
      }

      if (errors.length > 0) {
        logger.warn('Request validation failed', {
          errors,
          path: req.path,
          method: req.method,
          userId: req.user?.id,
          correlationId: req.correlationId
        });

        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: errors,
            timestamp: new Date().toISOString(),
            correlationId: req.correlationId
          }
        });
        return;
      }

      next();
    } catch (validationError) {
      logger.error('Validation middleware error', {
        error: validationError instanceof Error ? validationError.message : 'Unknown error',
        path: req.path,
        method: req.method,
        correlationId: req.correlationId
      });

      res.status(500).json({
        error: {
          code: 'VALIDATION_MIDDLEWARE_ERROR',
          message: 'Internal validation error',
          timestamp: new Date().toISOString(),
          correlationId: req.correlationId
        }
      });
    }
  };
};