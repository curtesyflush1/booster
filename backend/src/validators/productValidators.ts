import Joi from 'joi';
import { commonSchemas } from './schemas';
import { 
  STRING_LIMITS, 
  NUMERIC_LIMITS, 
  PAGINATION, 
  BARCODE_LIMITS, 
  VALIDATION_PATTERNS 
} from '../constants';

export const productValidationSchemas = {
  searchProducts: {
    query: Joi.object({
      q: Joi.string().min(STRING_LIMITS.SEARCH_QUERY_MIN).max(STRING_LIMITS.SEARCH_QUERY_MAX).optional().messages({
        'string.min': 'Search query cannot be empty',
        'string.max': `Search query must not exceed ${STRING_LIMITS.SEARCH_QUERY_MAX} characters`
      }),
      category_id: commonSchemas.optionalUuid.messages({
        'string.uuid': 'Category ID must be a valid UUID'
      }),
      set_name: Joi.string().min(1).max(255).optional().messages({
        'string.min': 'Set name cannot be empty',
        'string.max': 'Set name must not exceed 255 characters'
      }),
      series: Joi.string().min(1).max(255).optional().messages({
        'string.min': 'Series cannot be empty',
        'string.max': 'Series must not exceed 255 characters'
      }),
      retailer_id: commonSchemas.optionalUuid.messages({
        'string.uuid': 'Retailer ID must be a valid UUID'
      }),
      min_price: Joi.number().min(NUMERIC_LIMITS.PRICE_MIN).max(NUMERIC_LIMITS.PRICE_MAX).optional().messages({
        'number.min': 'Minimum price cannot be negative',
        'number.max': `Minimum price must not exceed ${NUMERIC_LIMITS.PRICE_MAX}`
      }),
      max_price: Joi.number().min(NUMERIC_LIMITS.PRICE_MIN).max(NUMERIC_LIMITS.PRICE_MAX).optional().messages({
        'number.min': 'Maximum price cannot be negative',
        'number.max': `Maximum price must not exceed ${NUMERIC_LIMITS.PRICE_MAX}`
      }),
      availability: Joi.string().valid('in_stock', 'low_stock', 'out_of_stock', 'pre_order').optional().messages({
        'any.only': 'Availability must be one of: in_stock, low_stock, out_of_stock, pre_order'
      }),
      is_active: Joi.boolean().optional(),
      page: Joi.number().integer().min(PAGINATION.DEFAULT_PAGE).max(PAGINATION.MAX_PAGE).default(PAGINATION.DEFAULT_PAGE).messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': `Page must be at least ${PAGINATION.DEFAULT_PAGE}`,
        'number.max': `Page must not exceed ${PAGINATION.MAX_PAGE}`
      }),
      limit: Joi.number().integer().min(PAGINATION.DEFAULT_PAGE).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT).messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': `Limit must be at least ${PAGINATION.DEFAULT_PAGE}`,
        'number.max': `Limit must not exceed ${PAGINATION.MAX_LIMIT}`
      }),
      sort_by: Joi.string().valid('name', 'release_date', 'popularity_score', 'created_at').default('popularity_score').messages({
        'any.only': 'Sort by must be one of: name, release_date, popularity_score, created_at'
      }),
      sort_order: Joi.string().valid('asc', 'desc').default('desc').messages({
        'any.only': 'Sort order must be either asc or desc'
      })
    })
  },

  productById: {
    params: Joi.object({
      id: commonSchemas.uuid.messages({
        'string.uuid': 'Product ID must be a valid UUID',
        'any.required': 'Product ID is required'
      })
    })
  },

  productBySlug: {
    params: Joi.object({
      slug: Joi.string().required().messages({
        'any.required': 'Product slug is required'
      })
    })
  },

  barcodeSearch: {
    query: Joi.object({
      upc: commonSchemas.upc.messages({
        'string.pattern.base': 'UPC must be 8-14 digits',
        'any.required': 'UPC is required'
      })
    })
  },

  productsByCategory: {
    params: Joi.object({
      categoryId: commonSchemas.uuid.messages({
        'string.uuid': 'Category ID must be a valid UUID',
        'any.required': 'Category ID is required'
      })
    }),
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      is_active: Joi.boolean().default(true)
    })
  },

  productsBySet: {
    params: Joi.object({
      setName: Joi.string().required().messages({
        'any.required': 'Set name is required'
      })
    })
  },

  priceHistory: {
    params: Joi.object({
      id: commonSchemas.uuid.messages({
        'string.uuid': 'Product ID must be a valid UUID',
        'any.required': 'Product ID is required'
      })
    }),
    query: Joi.object({
      days: Joi.number().integer().min(1).max(365).default(30),
      retailer_id: commonSchemas.optionalUuid
    })
  },

  popularProducts: {
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(50).default(10),
      category_id: commonSchemas.optionalUuid
    })
  }
};