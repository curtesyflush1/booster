import { query, param, body } from 'express-validator';

export class AlertValidationService {
  /**
   * Validation rules for alert listing endpoint
   */
  static getAlertsValidation() {
    return [
      query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
      query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
      query('status').optional().isIn(['pending', 'sent', 'failed', 'read']).withMessage('Invalid status'),
      query('type').optional().isIn(['restock', 'price_drop', 'low_stock', 'pre_order']).withMessage('Invalid type'),
      query('unread_only').optional().isBoolean().withMessage('unread_only must be a boolean'),
      query('search').optional().isString().trim().isLength({ max: 255 }).withMessage('Search must be a string with max 255 characters'),
      query('start_date').optional().isISO8601().withMessage('start_date must be a valid date'),
      query('end_date').optional().isISO8601().withMessage('end_date must be a valid date')
    ];
  }

  /**
   * Validation rules for alert ID parameter
   */
  static alertIdValidation() {
    return [
      param('id').isUUID().withMessage('Alert ID must be a valid UUID')
    ];
  }

  /**
   * Validation rules for bulk operations
   */
  static bulkOperationValidation() {
    return [
      body('alertIds')
        .isArray({ min: 1, max: 50 })
        .withMessage('alertIds must be a non-empty array with maximum 50 items'),
      body('alertIds.*').isUUID().withMessage('Each alert ID must be a valid UUID')
    ];
  }

  /**
   * Validation rules for analytics endpoint
   */
  static analyticsValidation() {
    return [
      query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
    ];
  }

  /**
   * Sanitize and validate date range
   */
  static validateDateRange(startDate?: string, endDate?: string): { isValid: boolean; error?: string } {
    if (!startDate && !endDate) {
      return { isValid: true };
    }

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start && isNaN(start.getTime())) {
      return { isValid: false, error: 'Invalid start_date format' };
    }

    if (end && isNaN(end.getTime())) {
      return { isValid: false, error: 'Invalid end_date format' };
    }

    if (start && end && start > end) {
      return { isValid: false, error: 'start_date must be before end_date' };
    }

    // Prevent queries for ranges longer than 1 year
    if (start && end) {
      const diffInDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (diffInDays > 365) {
        return { isValid: false, error: 'Date range cannot exceed 365 days' };
      }
    }

    return { isValid: true };
  }
}