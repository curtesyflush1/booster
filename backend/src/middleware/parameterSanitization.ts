import { Request, Response, NextFunction } from 'express';
import { 
  sanitizeUrlParameter, 
  sanitizeSetName, 
  sanitizeSlug, 
  sanitizeUUID, 
  sanitizeUPC, 
  sanitizeSearchQuery 
} from '../utils/validation';
import { logger } from '../utils/logger';

/**
 * Middleware to sanitize URL parameters before they reach controllers
 * This provides an additional layer of security beyond Joi validation
 */
export const sanitizeParameters = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const originalParams = { ...req.params };
    const originalQuery = { ...req.query };
    
    // Sanitize path parameters
    if (req.params) {
      for (const [key, value] of Object.entries(req.params)) {
        if (typeof value === 'string') {
          req.params[key] = sanitizeParameterByName(key, value);
        }
      }
    }
    
    // Sanitize query parameters
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          req.query[key] = sanitizeParameterByName(key, value);
        } else if (Array.isArray(value)) {
          // Handle array query parameters
          req.query[key] = value.map(item => 
            typeof item === 'string' ? sanitizeParameterByName(key, item) : item
          );
        }
      }
    }
    
    // Log if any parameters were modified (potential security issue)
    const paramsModified = JSON.stringify(originalParams) !== JSON.stringify(req.params);
    const queryModified = JSON.stringify(originalQuery) !== JSON.stringify(req.query);
    
    if (paramsModified || queryModified) {
      logger.warn('URL parameters were sanitized', {
        path: req.path,
        method: req.method,
        originalParams: paramsModified ? originalParams : undefined,
        sanitizedParams: paramsModified ? req.params : undefined,
        originalQuery: queryModified ? originalQuery : undefined,
        sanitizedQuery: queryModified ? req.query : undefined,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        correlationId: req.correlationId
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error in parameter sanitization middleware', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      path: req.path,
      method: req.method,
      correlationId: req.correlationId
    });
    
    // Don't block the request, but log the error
    next();
  }
};

/**
 * Sanitize a parameter based on its name/type
 */
function sanitizeParameterByName(paramName: string, value: string): string {
  // Handle specific parameter types
  switch (paramName.toLowerCase()) {
    case 'setname':
    case 'set_name':
      return sanitizeSetName(value);
    
    case 'slug':
      return sanitizeSlug(value);
    
    case 'id':
    case 'userid':
    case 'user_id':
    case 'productid':
    case 'product_id':
    case 'categoryid':
    case 'category_id':
    case 'retailerid':
    case 'retailer_id':
    case 'watchid':
    case 'watch_id':
    case 'packid':
    case 'pack_id':
    case 'alertid':
    case 'alert_id':
    case 'addressid':
    case 'address_id':
    case 'credentialid':
    case 'credential_id':
    case 'paymentmethodid':
    case 'payment_method_id':
    case 'parentid':
    case 'parent_id':
      return sanitizeUUID(value);
    
    case 'upc':
    case 'barcode':
      return sanitizeUPC(value);
    
    case 'q':
    case 'search':
    case 'query':
      return sanitizeSearchQuery(value);
    
    // For other parameters, apply general sanitization
    default:
      return sanitizeUrlParameter(value);
  }
}

/**
 * Middleware specifically for product routes that handles set names
 */
export const sanitizeProductParameters = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Special handling for setName parameter in product routes
    if (req.params.setName) {
      const originalSetName = req.params.setName;
      req.params.setName = sanitizeSetName(originalSetName);
      
      if (originalSetName !== req.params.setName) {
        logger.warn('Set name parameter was sanitized', {
          path: req.path,
          original: originalSetName,
          sanitized: req.params.setName,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          correlationId: req.correlationId
        });
      }
    }
    
    // Apply general parameter sanitization
    sanitizeParameters(req, res, next);
  } catch (error) {
    logger.error('Error in product parameter sanitization middleware', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      path: req.path,
      method: req.method,
      correlationId: req.correlationId
    });
    
    next();
  }
};

/**
 * Validation helper to ensure sanitized parameters are still valid
 */
export const validateSanitizedParameter = (
  paramName: string, 
  originalValue: string, 
  sanitizedValue: string
): { isValid: boolean; error?: string } => {
  // Check if sanitization removed too much content
  if (originalValue.length > 0 && sanitizedValue.length === 0) {
    return {
      isValid: false,
      error: `${paramName} contains invalid characters`
    };
  }
  
  // Check if sanitization changed the value significantly
  const changeRatio = 1 - (sanitizedValue.length / originalValue.length);
  if (changeRatio > 0.5) {
    return {
      isValid: false,
      error: `${paramName} contains too many invalid characters`
    };
  }
  
  return { isValid: true };
};

/**
 * Express error handler for parameter sanitization errors
 */
export const handleSanitizationError = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error.message.includes('sanitization')) {
    logger.error('Parameter sanitization error', {
      error: error.message,
      path: req.path,
      method: req.method,
      params: req.params,
      query: req.query,
      correlationId: req.correlationId
    });
    
    res.status(400).json({
      error: {
        code: 'INVALID_PARAMETERS',
        message: 'Request contains invalid parameters',
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId
      }
    });
    return;
  }
  
  next(error);
};