import Joi from 'joi';

/**
 * Validation schemas for dashboard endpoints
 */

export const getDashboardDataSchema = {
  query: Joi.object({
    // No query parameters required for basic dashboard data
  }).unknown(false)
};

export const getConsolidatedDashboardDataSchema = {
  query: Joi.object({
    productIds: Joi.string()
      .pattern(/^[a-zA-Z0-9-_,]+$/)
      .max(1000) // Reasonable limit for URL length
      .optional()
      .messages({
        'string.pattern.base': 'Product IDs must contain only alphanumeric characters, hyphens, and underscores',
        'string.max': 'Product IDs parameter is too long'
      })
  }).unknown(false)
};

export const getPredictiveInsightsSchema = {
  query: Joi.object({
    productIds: Joi.string()
      .pattern(/^[a-zA-Z0-9-_,]+$/)
      .max(1000)
      .optional()
      .messages({
        'string.pattern.base': 'Product IDs must contain only alphanumeric characters, hyphens, and underscores',
        'string.max': 'Product IDs parameter is too long'
      })
  }).unknown(false)
};

export const getDashboardUpdatesSchema = {
  query: Joi.object({
    since: Joi.date()
      .iso()
      .max('now')
      .min(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // 30 days ago
      .optional()
      .messages({
        'date.iso': 'Since parameter must be a valid ISO date string',
        'date.max': 'Since date cannot be in the future',
        'date.min': 'Since date cannot be more than 30 days ago'
      })
  }).unknown(false)
};

export const getPortfolioDataSchema = {
  query: Joi.object({
    // No query parameters required for portfolio data
  }).unknown(false)
};