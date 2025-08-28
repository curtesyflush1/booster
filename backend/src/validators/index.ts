// Export all validation schemas
export * from './schemas';

// Re-export legacy validation middleware (deprecated - use Joi versions)
export { 
  validate, 
  validateBody, 
  validateQuery, 
  validateParams, 
  validateOnly,
  ValidationSchemas,
  ValidationOptions 
} from '../middleware/validationMiddleware';

// Export standardized Joi validation middleware (PREFERRED)
export {
  validateJoi,
  validateJoiBody,
  validateJoiQuery,
  validateJoiParams,
  validateJoiOnly,
  createValidationMiddleware,
  JoiValidationSchemas,
  JoiValidationOptions
} from '../middleware/joiValidation';