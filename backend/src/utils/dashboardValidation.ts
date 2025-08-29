import { DASHBOARD_TIME_WINDOWS } from '../constants/ml';

/**
 * Dashboard-specific validation utilities
 */

/**
 * Parse and validate product IDs from query parameter
 * @param productIds - Raw query parameter value
 * @returns Array of valid product IDs or undefined
 */
export const parseProductIds = (productIds: unknown): string[] | undefined => {
  if (!productIds || typeof productIds !== 'string') {
    return undefined;
  }
  
  const ids = productIds.split(',').filter(id => id.trim().length > 0);
  
  // Validate product ID format (alphanumeric, hyphens, underscores)
  const invalidIds = ids.filter(id => !/^[a-zA-Z0-9-_]+$/.test(id));
  if (invalidIds.length > 0) {
    throw new Error(`Invalid product ID format: ${invalidIds.join(', ')}`);
  }
  
  return ids;
};

/**
 * Parse and validate since date parameter
 * @param since - Raw query parameter value
 * @returns Valid Date object or undefined
 */
export const parseSinceDate = (since: unknown): Date | undefined => {
  if (!since || typeof since !== 'string') {
    return undefined;
  }
  
  const date = new Date(since);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date format');
  }
  
  // Validate date is reasonable (not in future, not more than 30 days ago)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - DASHBOARD_TIME_WINDOWS.UPDATES_MAX_AGE);
  
  if (date > now) {
    throw new Error('Date cannot be in the future');
  }
  
  if (date < thirtyDaysAgo) {
    throw new Error('Date cannot be more than 30 days ago');
  }
  
  return date;
};