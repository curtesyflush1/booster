import { Request, Response, NextFunction } from 'express';
import { sendErrorResponse } from '../utils/controllerHelpers';

/**
 * Validate product IDs query parameter
 */
export const validateProductIds = (req: Request, res: Response, next: NextFunction): void => {
  const { productIds } = req.query;
  
  if (productIds && typeof productIds === 'string') {
    const ids = productIds.split(',').filter(id => id.trim().length > 0);
    const invalidIds = ids.filter(id => !/^[a-zA-Z0-9-_]+$/.test(id));
    
    if (invalidIds.length > 0) {
      sendErrorResponse(res, 400, 'INVALID_PRODUCT_IDS', `Invalid product ID format: ${invalidIds.join(', ')}`);
      return;
    }
    
    if (ids.length > 50) {
      sendErrorResponse(res, 400, 'TOO_MANY_PRODUCT_IDS', 'Maximum 50 product IDs allowed');
      return;
    }
  }
  
  next();
};

/**
 * Validate since date query parameter
 */
export const validateSinceDate = (req: Request, res: Response, next: NextFunction): void => {
  const { since } = req.query;
  
  if (since && typeof since === 'string') {
    const date = new Date(since);
    if (isNaN(date.getTime())) {
      sendErrorResponse(res, 400, 'INVALID_DATE_FORMAT', 'Invalid date format for since parameter');
      return;
    }
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    if (date > now) {
      sendErrorResponse(res, 400, 'FUTURE_DATE_NOT_ALLOWED', 'Since date cannot be in the future');
      return;
    }
    
    if (date < thirtyDaysAgo) {
      sendErrorResponse(res, 400, 'DATE_TOO_OLD', 'Since date cannot be more than 30 days ago');
      return;
    }
  }
  
  next();
};