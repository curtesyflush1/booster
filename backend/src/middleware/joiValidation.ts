import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

export interface JoiValidationSchemas {
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  body?: Joi.ObjectSchema;
}

export interface JoiValidationOptions {
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

/**
 * Standardized Joi validation middleware that enforces consistent validation patterns
 * This middleware should be used for ALL new endpoints and existing endpoints should be migrated to use this
 */
export const validateJoi = (schemas: JoiValidationSchemas, options: JoiValidationOptions = {}) => {
  const defaultOptions: JoiValidationOptions = {
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
            message: detail.message.replace(/"/g, ''),
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
            message: detail.message.replace(/"/g, ''),
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
            message: detail.message.replace(/"/g, ''),
            value: detail.context?.value
          })));
        } else {
          validatedData.body = value;
          req.body = value; // Replace with validated/sanitized data
        }
      }

      if (errors.length > 0) {
        logger.warn('Joi validation failed', {
          errors,
          path: req.path,
          method: req.method,
          userId: req.user?.id,
          correlationId: req.correlationId,
          userAgent: req.get('User-Agent')
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
      logger.debug('Joi validation successful', {
        path: req.path,
        method: req.method,
        validatedFields: Object.keys(validatedData),
        userId: req.user?.id,
        correlationId: req.correlationId
      });

      next();
    } catch (validationError) {
      logger.error('Joi validation middleware error', {
        error: validationError instanceof Error ? validationError.message : 'Unknown error',
        stack: validationError instanceof Error ? validationError.stack : undefined,
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
 * Convenience functions for single schema type validation
 */
export const validateJoiBody = (schema: Joi.ObjectSchema, options?: JoiValidationOptions) => 
  validateJoi({ body: schema }, options);

export const validateJoiQuery = (schema: Joi.ObjectSchema, options?: JoiValidationOptions) => 
  validateJoi({ query: schema }, options);

export const validateJoiParams = (schema: Joi.ObjectSchema, options?: JoiValidationOptions) => 
  validateJoi({ params: schema }, options);

/**
 * Validation middleware that only validates without replacing request data
 * Useful for cases where you want to validate but preserve original data structure
 */
export const validateJoiOnly = (schemas: JoiValidationSchemas, options: JoiValidationOptions = {}) => {
  const defaultOptions: JoiValidationOptions = {
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
            message: detail.message.replace(/"/g, ''),
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
            message: detail.message.replace(/"/g, ''),
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
            message: detail.message.replace(/"/g, ''),
            value: detail.context?.value
          })));
        }
      }

      if (errors.length > 0) {
        logger.warn('Joi validation failed (validation-only mode)', {
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
      logger.error('Joi validation middleware error (validation-only mode)', {
        error: validationError instanceof Error ? validationError.message : 'Unknown error',
        stack: validationError instanceof Error ? validationError.stack : undefined,
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
 * Middleware factory that enforces Joi validation pattern
 * This should be the ONLY validation middleware used going forward
 */
export const createValidationMiddleware = (
  schemas: JoiValidationSchemas, 
  options?: JoiValidationOptions
) => {
  if (!schemas || Object.keys(schemas).length === 0) {
    throw new Error('Validation schemas are required. Use validateJoi() with at least one schema.');
  }

  return validateJoi(schemas, options);
};

/**
 * Type guard to ensure schemas are properly structured
 */
export const isValidJoiSchema = (schema: any): schema is Joi.ObjectSchema => {
  return schema && typeof schema.validate === 'function';
};

/**
 * Helper to validate schema structure at runtime
 */
export const validateSchemaStructure = (schemas: JoiValidationSchemas): void => {
  const { query, params, body } = schemas;
  
  if (query && !isValidJoiSchema(query)) {
    throw new Error('Query schema must be a valid Joi ObjectSchema');
  }
  
  if (params && !isValidJoiSchema(params)) {
    throw new Error('Params schema must be a valid Joi ObjectSchema');
  }
  
  if (body && !isValidJoiSchema(body)) {
    throw new Error('Body schema must be a valid Joi ObjectSchema');
  }
};