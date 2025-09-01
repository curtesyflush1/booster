import Joi from 'joi';
import { 
  STRING_LIMITS, 
  NUMERIC_LIMITS, 
  PAGINATION, 
  BARCODE_LIMITS, 
  VALIDATION_PATTERNS,
  DEFAULT_VALUES
} from '../constants';

// Common reusable schemas
export const commonSchemas = {
  uuid: Joi.string().uuid().required().messages({
    'string.uuid': 'Must be a valid UUID',
    'any.required': 'ID is required'
  }),
  
  optionalUuid: Joi.string().uuid().optional().messages({
    'string.uuid': 'Must be a valid UUID'
  }),
  
  booleanFlag: Joi.boolean().default(false),
  
  upc: Joi.string().pattern(VALIDATION_PATTERNS.UPC_CODE).messages({
    'string.pattern.base': `UPC must be ${BARCODE_LIMITS.UPC_MIN_DIGITS}-${BARCODE_LIMITS.UPC_MAX_DIGITS} digits`
  }),
  
  pagination: {
    page: Joi.number().integer().min(PAGINATION.DEFAULT_PAGE).max(PAGINATION.MAX_PAGE).default(PAGINATION.DEFAULT_PAGE).messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': `Page must be at least ${PAGINATION.DEFAULT_PAGE}`,
      'number.max': `Page cannot exceed ${PAGINATION.MAX_PAGE}`
    }),
    limit: Joi.number().integer().min(PAGINATION.DEFAULT_PAGE).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT).messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    })
  }
};

// Authentication schemas
export const authSchemas = {
  register: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Must be a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(8).max(128).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must not exceed 128 characters',
      'any.required': 'Password is required'
    }),
    first_name: Joi.string().min(STRING_LIMITS.USER_FIRST_NAME_MIN).max(STRING_LIMITS.USER_FIRST_NAME_MAX).optional().messages({
      'string.min': 'Name cannot be empty',
      'string.max': `Name must not exceed ${STRING_LIMITS.USER_FIRST_NAME_MAX} characters`
    }),
    last_name: Joi.string().min(STRING_LIMITS.USER_LAST_NAME_MIN).max(STRING_LIMITS.USER_LAST_NAME_MAX).optional().messages({
      'string.min': 'Name cannot be empty',
      'string.max': `Name must not exceed ${STRING_LIMITS.USER_LAST_NAME_MAX} characters`
    }),
    terms_accepted: Joi.boolean().valid(true).required().messages({
      'any.only': 'Terms and conditions must be accepted',
      'any.required': 'Terms acceptance is required'
    }),
    newsletter_subscription: Joi.boolean().default(false)
  }),

  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Must be a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required'
    })
  }),

  refreshToken: Joi.object({
    refresh_token: Joi.string().required().messages({
      'any.required': 'Refresh token is required'
    })
  }),

  passwordResetRequest: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Must be a valid email address',
      'any.required': 'Email is required'
    })
  }),

  passwordReset: Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'Reset token is required'
    }),
    password: Joi.string().min(8).max(128).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must not exceed 128 characters',
      'any.required': 'Password is required'
    })
  }),

  changePassword: Joi.object({
    current_password: Joi.string().required().messages({
      'any.required': 'Current password is required'
    }),
    new_password: Joi.string().min(8).max(128).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must not exceed 128 characters',
      'any.required': 'Password is required'
    })
  }),

  emailVerification: Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'Verification token is required'
    })
  })
};

// Product schemas
export const productSchemas = {
  search: {
    query: Joi.object({
      q: Joi.string().max(200).optional().messages({
        'string.max': 'Search term cannot exceed 200 characters'
      }),
      category_id: Joi.string().uuid().optional().messages({
        'string.uuid': 'Must be a valid UUID'
      }),
      set_name: Joi.string().max(100).optional(),
      series: Joi.string().max(100).optional(),
      retailer_id: Joi.string().uuid().optional().messages({
        'string.uuid': 'Must be a valid UUID'
      }),
      min_price: Joi.number().min(0).optional().messages({
        'number.min': 'Minimum price cannot be negative'
      }),
      max_price: Joi.number().min(Joi.ref('min_price')).optional().messages({
        'number.min': 'Maximum price must be greater than minimum price'
      }),
      availability: Joi.string().valid('in_stock', 'out_of_stock', 'pre_order').optional(),
      is_active: Joi.boolean().default(true),
      page: Joi.number().integer().min(1).max(1000).default(1).messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1',
        'number.max': 'Page cannot exceed 1000'
      }),
      limit: Joi.number().integer().min(1).max(100).default(20).messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
      }),
      sort_by: Joi.string().valid('name', 'price', 'release_date', 'created_at').default('name'),
      sort_order: Joi.string().valid('asc', 'desc').default('asc')
    })
  },

  getById: {
    params: Joi.object({
      id: commonSchemas.uuid
    })
  },

  getBySlug: {
    params: Joi.object({
      slug: Joi.string().pattern(/^[a-z0-9-]+$/).required().messages({
        'string.pattern.base': 'Slug must contain only lowercase letters, numbers, and hyphens',
        'any.required': 'Slug is required'
      })
    })
  },

  lookupByBarcode: {
    query: Joi.object({
      upc: Joi.string().pattern(/^\d{8,14}$/).required().messages({
        'string.pattern.base': 'UPC must be 8-14 digits',
        'any.required': 'UPC is required'
      })
    })
  },

  getPopular: {
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(50).default(10),
      category_id: Joi.string().uuid().optional().messages({
        'string.uuid': 'Must be a valid UUID'
      })
    })
  },

  getByCategory: {
    params: Joi.object({
      categoryId: Joi.string().uuid().required().messages({
        'string.uuid': 'Must be a valid UUID',
        'any.required': 'ID is required'
      })
    }),
    query: Joi.object({
      page: Joi.number().integer().min(1).max(1000).default(1).messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1',
        'number.max': 'Page cannot exceed 1000'
      }),
      limit: Joi.number().integer().min(1).max(100).default(20).messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
      }),
      is_active: Joi.boolean().default(false)
    })
  },

  getBySet: {
    params: Joi.object({
      setName: Joi.string().min(1).max(100).required().messages({
        'string.min': 'Set name cannot be empty',
        'string.max': 'Set name cannot exceed 100 characters',
        'any.required': 'Set name is required'
      })
    })
  },

  getPriceHistory: {
    params: Joi.object({
      id: Joi.string().uuid().required().messages({
        'string.uuid': 'Must be a valid UUID',
        'any.required': 'ID is required'
      })
    }),
    query: Joi.object({
      days: Joi.number().integer().min(1).max(365).default(30).messages({
        'number.min': 'Days must be at least 1',
        'number.max': 'Days cannot exceed 365'
      }),
      retailer_id: Joi.string().uuid().optional().messages({
        'string.uuid': 'Must be a valid UUID'
      })
    })
  },

  // Batch fetch products by IDs
  getByIdsBatch: {
    body: Joi.object({
      ids: Joi.array()
        .items(
          Joi.string().uuid().messages({
            'string.uuid': 'Each id must be a valid UUID'
          })
        )
        .min(1)
        .max(200)
        .unique()
        .required()
        .messages({
          'array.min': 'At least one product ID is required',
          'array.max': 'Cannot request more than 200 IDs',
          'any.required': 'ids array is required',
          'array.unique': 'Duplicate IDs are not allowed'
        })
    })
  }
};

// Category schemas
export const categorySchemas = {
  getAll: {
    query: Joi.object({
      include_product_count: Joi.boolean().default(false),
      as_tree: Joi.boolean().default(false)
    })
  },

  getById: {
    params: Joi.object({
      id: Joi.string().uuid().required().messages({
        'string.uuid': 'Must be a valid UUID',
        'any.required': 'ID is required'
      })
    }),
    query: Joi.object({
      include_children: Joi.boolean().default(false),
      include_path: Joi.boolean().default(false)
    })
  },

  getBySlug: {
    params: Joi.object({
      slug: Joi.string().pattern(/^[a-z0-9-]+$/).required().messages({
        'string.pattern.base': 'Slug must contain only lowercase letters, numbers, and hyphens',
        'any.required': 'Slug is required'
      })
    }),
    query: Joi.object({
      include_children: Joi.boolean().default(false),
      include_path: Joi.boolean().default(false)
    })
  },

  getChildren: {
    params: Joi.object({
      parentId: Joi.string().uuid().required().messages({
        'string.uuid': 'Must be a valid UUID',
        'any.required': 'ID is required'
      })
    })
  },

  getTree: {
    query: Joi.object({
      category_id: Joi.string().uuid().optional().messages({
        'string.uuid': 'Must be a valid UUID'
      })
    })
  },

  getPath: {
    params: Joi.object({
      id: Joi.string().uuid().required().messages({
        'string.uuid': 'Must be a valid UUID',
        'any.required': 'ID is required'
      })
    })
  }
};

// Watch schemas (basic - will be expanded below)
export const basicWatchSchemas = {
  create: Joi.object({
    product_id: commonSchemas.uuid,
    retailer_ids: Joi.array().items(commonSchemas.uuid).min(1).required().messages({
      'array.min': 'At least one retailer must be selected',
      'any.required': 'Retailer IDs are required'
    }),
    price_threshold: Joi.number().min(0).optional().messages({
      'number.min': 'Price threshold cannot be negative'
    }),
    notification_channels: Joi.array().items(
      Joi.string().valid('web_push', 'email', 'sms', 'discord')
    ).min(1).required().messages({
      'array.min': 'At least one notification channel must be selected',
      'any.required': 'Notification channels are required'
    }),
    is_active: commonSchemas.booleanFlag
  }),

  update: {
    params: Joi.object({
      id: commonSchemas.uuid
    }),
    body: Joi.object({
      retailer_ids: Joi.array().items(commonSchemas.uuid).min(1).optional(),
      price_threshold: Joi.number().min(0).optional(),
      notification_channels: Joi.array().items(
        Joi.string().valid('web_push', 'email', 'sms', 'discord')
      ).min(1).optional(),
      is_active: commonSchemas.booleanFlag
    })
  },

  getById: {
    params: Joi.object({
      id: commonSchemas.uuid
    })
  },

  getUserWatches: {
    query: Joi.object({
      ...commonSchemas.pagination,
      // Default to active watches when omitted
      is_active: Joi.boolean().default(true),
      product_id: commonSchemas.optionalUuid,
      retailer_id: commonSchemas.optionalUuid
    })
  }
};

// ML schemas
export const mlSchemas = {
  getPricePrediction: {
    params: Joi.object({
      productId: commonSchemas.uuid
    }),
    query: Joi.object({
      timeframe: Joi.number().integer().min(1).max(365).default(30).messages({
        'number.min': 'Timeframe must be at least 1 day',
        'number.max': 'Timeframe cannot exceed 365 days'
      })
    })
  },

  getSelloutRisk: {
    params: Joi.object({
      productId: commonSchemas.uuid
    })
  },

  getROIEstimate: {
    params: Joi.object({
      productId: commonSchemas.uuid
    }),
    query: Joi.object({
      currentPrice: Joi.number().min(0).required().messages({
        'number.min': 'Current price cannot be negative',
        'any.required': 'Current price is required'
      }),
      timeframe: Joi.number().integer().min(NUMERIC_LIMITS.TIMEFRAME_MIN_DAYS).max(NUMERIC_LIMITS.TIMEFRAME_MAX_DAYS).default(NUMERIC_LIMITS.ROI_TIMEFRAME_DEFAULT_DAYS).messages({
        'number.min': `Timeframe must be at least ${NUMERIC_LIMITS.TIMEFRAME_MIN_DAYS} day`,
        'number.max': `Timeframe cannot exceed ${NUMERIC_LIMITS.TIMEFRAME_MAX_DAYS / 365} years`
      })
    })
  },

  getHypeMeter: {
    params: Joi.object({
      productId: commonSchemas.uuid
    })
  },

  getMarketInsights: {
    params: Joi.object({
      productId: commonSchemas.uuid
    }),
    query: Joi.object({
      days: Joi.number().integer().min(1).max(365).default(90).messages({
        'number.min': 'Days must be at least 1',
        'number.max': 'Days cannot exceed 365'
      })
    })
  },

  getComprehensiveAnalysis: {
    params: Joi.object({
      productId: commonSchemas.uuid
    }),
    query: Joi.object({
      currentPrice: Joi.number().min(0).optional(),
      priceTimeframe: Joi.number().integer().min(1).max(365).default(30),
      roiTimeframe: Joi.number().integer().min(1).max(1095).default(365)
    })
  },

  getTrendingProducts: {
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(50).default(10),
      category: commonSchemas.optionalUuid
    })
  },

  getHighRiskProducts: {
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(50).default(10),
      minRiskScore: Joi.number().min(0).max(100).default(50).messages({
        'number.min': 'Risk score cannot be negative',
        'number.max': 'Risk score cannot exceed 100'
      })
    })
  }
};

// Dashboard schemas
export const dashboardSchemas = {
  getStats: {
    query: Joi.object({
      productIds: Joi.string().optional().messages({
        'string.base': 'Product IDs must be a comma-separated string'
      })
    })
  },

  getAlerts: {
    query: Joi.object({
      since: Joi.date().iso().optional().messages({
        'date.format': 'Since date must be in ISO format'
      })
    })
  }
};

// Price comparison schemas
export const priceComparisonSchemas = {
  getProductComparison: {
    params: Joi.object({
      productId: commonSchemas.uuid
    })
  }
};

// Alert schemas
export const alertSchemas = {
  getAlerts: {
    query: Joi.object({
      ...commonSchemas.pagination,
      status: Joi.string().valid('unread', 'read', 'archived').optional(),
      type: Joi.string().valid('restock', 'price_drop', 'new_product').optional(),
      product_id: commonSchemas.optionalUuid,
      retailer_id: commonSchemas.optionalUuid,
      start_date: Joi.date().iso().optional().messages({
        'date.format': 'Start date must be in ISO format'
      }),
      end_date: Joi.date().iso().min(Joi.ref('start_date')).optional().messages({
        'date.format': 'End date must be in ISO format',
        'date.min': 'End date must be after start date'
      }),
      sort_by: Joi.string().valid('created_at', 'priority', 'product_name').default('created_at'),
      sort_order: Joi.string().valid('asc', 'desc').default('desc')
    })
  },

  getById: {
    params: Joi.object({
      id: commonSchemas.uuid
    })
  },

  markAsRead: {
    params: Joi.object({
      id: commonSchemas.uuid
    })
  },

  deleteAlert: {
    params: Joi.object({
      id: commonSchemas.uuid
    })
  },

  bulkMarkAsRead: {
    body: Joi.object({
      alertIds: Joi.array().items(commonSchemas.uuid).min(1).required().messages({
        'array.min': 'At least one alert ID is required',
        'any.required': 'Alert IDs are required'
      })
    })
  },

  getAnalytics: {
    query: Joi.object({
      days: Joi.number().integer().min(1).max(365).default(30).messages({
        'number.min': 'Days must be at least 1',
        'number.max': 'Days cannot exceed 365'
      })
    })
  }
};

// Watch schemas (expanded)
export const watchSchemas = {
  create: Joi.object({
    product_id: commonSchemas.uuid,
    retailer_ids: Joi.array().items(commonSchemas.uuid).min(1).optional().messages({
      'array.min': 'At least one retailer must be selected'
    }),
    max_price: Joi.number().min(0).optional().messages({
      'number.min': 'Max price cannot be negative'
    }),
    availability_type: Joi.string().valid('online', 'in_store', 'both').default('online'),
    zip_code: Joi.string().pattern(VALIDATION_PATTERNS.ZIP_CODE).optional().messages({
      'string.pattern.base': 'ZIP code must be in format 12345 or 12345-6789'
    }),
    radius_miles: Joi.number().integer().min(1).max(500).optional().messages({
      'number.min': 'Radius must be between 1 and 500 miles',
      'number.max': 'Radius must be between 1 and 500 miles'
    }),
    alert_preferences: Joi.object().optional()
  }),

  update: {
    params: Joi.object({
      watchId: commonSchemas.uuid
    }),
    body: Joi.object({
      retailer_ids: Joi.array().items(commonSchemas.uuid).min(1).optional(),
      max_price: Joi.number().min(0).optional(),
      availability_type: Joi.string().valid('online', 'in_store', 'both').optional(),
      zip_code: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional(),
      radius_miles: Joi.number().integer().min(1).max(500).optional(),
      alert_preferences: Joi.object().optional(),
      is_active: commonSchemas.booleanFlag
    })
  },

  getById: {
    params: Joi.object({
      watchId: commonSchemas.uuid
    })
  },

  getUserWatches: {
    query: Joi.object({
      ...commonSchemas.pagination,
      is_active: commonSchemas.booleanFlag,
      product_id: commonSchemas.optionalUuid,
      retailer_id: commonSchemas.optionalUuid
    })
  },

  exportWatches: {
    query: Joi.object({
      is_active: commonSchemas.booleanFlag
    })
  },

  deleteWatch: {
    params: Joi.object({
      watchId: commonSchemas.uuid
    })
  },

  toggleWatch: {
    params: Joi.object({
      watchId: commonSchemas.uuid
    })
  },

  getWatchHealth: {
    params: Joi.object({
      watchId: commonSchemas.uuid
    })
  }
};

// Watch Pack schemas
export const watchPackSchemas = {
  getWatchPacks: {
    query: Joi.object({
      ...commonSchemas.pagination,
      search: Joi.string().max(200).optional()
    })
  },

  getPopularWatchPacks: {
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(50).default(10)
    })
  },

  getUserSubscriptions: {
    query: Joi.object({
      ...commonSchemas.pagination,
      is_active: commonSchemas.booleanFlag
    })
  },

  getWatchPack: {
    params: Joi.object({
      packId: Joi.alternatives().try(
        commonSchemas.uuid,
        Joi.string().pattern(/^[a-z0-9-]+$/).messages({
          'string.pattern.base': 'Pack ID must be a valid UUID or slug'
        })
      ).required()
    })
  },

  getWatchPackStats: {
    params: Joi.object({
      packId: commonSchemas.uuid
    })
  },

  createWatchPack: {
    body: Joi.object({
      name: Joi.string().min(1).max(100).required().messages({
        'string.min': 'Name cannot be empty',
        'string.max': 'Name must not exceed 100 characters',
        'any.required': 'Name is required'
      }),
      slug: Joi.string().pattern(/^[a-z0-9-]+$/).required().messages({
        'string.pattern.base': 'Slug must contain only lowercase letters, numbers, and hyphens',
        'any.required': 'Slug is required'
      }),
      description: Joi.string().max(1000).optional().messages({
        'string.max': 'Description must be less than 1000 characters'
      }),
      product_ids: Joi.array().items(commonSchemas.uuid).min(1).required().messages({
        'array.min': 'At least one product ID is required',
        'any.required': 'Product IDs are required'
      }),
      auto_update: commonSchemas.booleanFlag,
      update_criteria: Joi.string().optional()
    })
  },

  updateWatchPack: {
    params: Joi.object({
      packId: commonSchemas.uuid
    }),
    body: Joi.object({
      name: Joi.string().min(1).max(100).optional(),
      description: Joi.string().max(1000).optional(),
      product_ids: Joi.array().items(commonSchemas.uuid).optional(),
      auto_update: commonSchemas.booleanFlag,
      update_criteria: Joi.string().optional(),
      is_active: commonSchemas.booleanFlag
    })
  },

  deleteWatchPack: {
    params: Joi.object({
      packId: commonSchemas.uuid
    })
  },

  subscribeToWatchPack: {
    params: Joi.object({
      packId: commonSchemas.uuid
    }),
    body: Joi.object({
      customizations: Joi.object().optional()
    })
  },

  unsubscribeFromWatchPack: {
    params: Joi.object({
      packId: commonSchemas.uuid
    }),
    body: Joi.object({
      remove_watches: commonSchemas.booleanFlag
    })
  },

  updateSubscriptionCustomizations: {
    params: Joi.object({
      packId: commonSchemas.uuid
    }),
    body: Joi.object({
      customizations: Joi.object().required().messages({
        'any.required': 'Customizations object is required'
      })
    })
  },

  findPacksContainingProduct: {
    params: Joi.object({
      productId: commonSchemas.uuid
    })
  }
};

// Notification schemas
export const notificationSchemas = {
  subscribe: Joi.object({
    endpoint: Joi.string().uri().required().messages({
      'string.uri': 'Endpoint must be a valid URL',
      'any.required': 'Endpoint is required'
    }),
    keys: Joi.object({
      p256dh: Joi.string().required().messages({
        'any.required': 'p256dh key is required'
      }),
      auth: Joi.string().required().messages({
        'any.required': 'auth key is required'
      })
    }).required().messages({
      'any.required': 'Keys object is required'
    })
  }),

  unsubscribe: Joi.object({
    endpoint: Joi.string().uri().required().messages({
      'string.uri': 'Endpoint must be a valid URL',
      'any.required': 'Endpoint is required'
    })
  })
};

// User management schemas (comprehensive)
export const userSchemas = {
  updateProfile: Joi.object({
    first_name: Joi.string().min(1).max(50).optional().allow(null).messages({
      'string.min': 'First name cannot be empty',
      'string.max': 'First name must not exceed 50 characters'
    }),
    last_name: Joi.string().min(1).max(50).optional().allow(null).messages({
      'string.min': 'Last name cannot be empty',
      'string.max': 'Last name must not exceed 50 characters'
    }),
    phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional().messages({
      'string.pattern.base': 'Phone number format is invalid'
    }),
    timezone: Joi.string().min(1).max(50).optional().messages({
      'string.min': 'Timezone cannot be empty',
      'string.max': 'Timezone must not exceed 50 characters'
    }),
    zip_code: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional().allow(null).messages({
      'string.pattern.base': 'ZIP code must be in format 12345 or 12345-6789'
    })
  }),

  updatePreferences: Joi.object({
    preferences: Joi.object().optional().messages({
      'object.base': 'Preferences must be an object'
    })
  }),

  updateNotificationSettings: Joi.object({
    web_push: Joi.boolean().optional(),
    email: Joi.boolean().optional(),
    sms: Joi.boolean().optional(),
    discord: Joi.boolean().optional(),
    webhook_url: Joi.string().uri().optional().allow(null).messages({
      'string.uri': 'Webhook URL must be a valid URL'
    }),
    discord_webhook: Joi.string().uri().optional().allow(null).messages({
      'string.uri': 'Discord webhook must be a valid URL'
    })
  }),

  updateQuietHours: Joi.object({
    enabled: Joi.boolean().required(),
    start_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).when('enabled', {
      is: true,
      then: Joi.required().messages({
        'any.required': 'Start time is required when quiet hours are enabled'
      }),
      otherwise: Joi.optional()
    }).messages({
      'string.pattern.base': 'Time must be in HH:MM format (24-hour)'
    }),
    end_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).when('enabled', {
      is: true,
      then: Joi.required().messages({
        'any.required': 'End time is required when quiet hours are enabled'
      }),
      otherwise: Joi.optional()
    }).messages({
      'string.pattern.base': 'Time must be in HH:MM format (24-hour)'
    }),
    timezone: Joi.string().optional().messages({
      'string.base': 'Timezone must be a string'
    })
  }),

  addShippingAddress: Joi.object({
    type: Joi.string().valid('shipping', 'billing').required().messages({
      'any.only': 'Address type must be either "shipping" or "billing"',
      'any.required': 'Address type is required'
    }),
    name: Joi.string().min(1).max(100).required().messages({
      'string.min': 'Name cannot be empty',
      'string.max': 'Name must not exceed 100 characters',
      'any.required': 'Name is required'
    }),
    address_line_1: Joi.string().min(1).max(200).required().messages({
      'string.min': 'Address line 1 cannot be empty',
      'string.max': 'Address line 1 must not exceed 200 characters',
      'any.required': 'Address line 1 is required'
    }),
    address_line_2: Joi.string().max(200).optional().allow('').messages({
      'string.max': 'Address line 2 must not exceed 200 characters'
    }),
    city: Joi.string().min(1).max(100).required().messages({
      'string.min': 'City cannot be empty',
      'string.max': 'City must not exceed 100 characters',
      'any.required': 'City is required'
    }),
    state: Joi.string().min(2).max(50).required().messages({
      'string.min': 'State must be at least 2 characters',
      'string.max': 'State must not exceed 50 characters',
      'any.required': 'State is required'
    }),
    zip_code: Joi.string().pattern(/^\d{5}(-\d{4})?$/).required().messages({
      'string.pattern.base': 'ZIP code must be in format 12345 or 12345-6789',
      'any.required': 'ZIP code is required'
    }),
    country: Joi.string().min(2).max(50).default('US').messages({
      'string.min': 'Country must be at least 2 characters',
      'string.max': 'Country must not exceed 50 characters'
    }),
    is_default: Joi.boolean().default(false)
  }),

  updateShippingAddress: {
    params: Joi.object({
      addressId: commonSchemas.uuid
    }),
    body: Joi.object({
      type: Joi.string().valid('shipping', 'billing').optional(),
      name: Joi.string().min(1).max(100).optional(),
      address_line_1: Joi.string().min(1).max(200).optional(),
      address_line_2: Joi.string().max(200).optional().allow(''),
      city: Joi.string().min(1).max(100).optional(),
      state: Joi.string().min(2).max(50).optional(),
      zip_code: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional(),
      country: Joi.string().min(2).max(50).optional(),
      is_default: Joi.boolean().optional()
    })
  },

  deleteShippingAddress: {
    params: Joi.object({
      addressId: commonSchemas.uuid
    })
  },

  addRetailerCredential: Joi.object({
    retailer: Joi.string().min(1).max(50).required().messages({
      'string.min': 'Retailer name cannot be empty',
      'string.max': 'Retailer name must not exceed 50 characters',
      'any.required': 'Retailer is required'
    }),
    username: Joi.string().min(1).max(100).required().messages({
      'string.min': 'Username cannot be empty',
      'string.max': 'Username must not exceed 100 characters',
      'any.required': 'Username is required'
    }),
    password: Joi.string().min(1).max(500).required().messages({
      'string.min': 'Password cannot be empty',
      'string.max': 'Password must not exceed 500 characters',
      'any.required': 'Password is required'
    }),
    additional_data: Joi.object().optional()
  }),

  updateRetailerCredential: {
    params: Joi.object({
      credentialId: commonSchemas.uuid
    }),
    body: Joi.object({
      username: Joi.string().min(1).max(100).optional().messages({
        'string.min': 'Username cannot be empty',
        'string.max': 'Username must not exceed 100 characters'
      }),
      password: Joi.string().min(1).max(500).optional().messages({
        'string.min': 'Password cannot be empty',
        'string.max': 'Password must not exceed 500 characters'
      }),
      additional_data: Joi.object().optional()
    })
  },

  deleteRetailerCredential: {
    params: Joi.object({
      credentialId: commonSchemas.uuid
    })
  },

  // User-specific encryption schemas
  addRetailerCredentialSecure: Joi.object({
    retailer: Joi.string().min(1).max(50).required().messages({
      'string.min': 'Retailer name cannot be empty',
      'string.max': 'Retailer name must not exceed 50 characters',
      'any.required': 'Retailer is required'
    }),
    username: Joi.string().min(1).max(100).required().messages({
      'string.min': 'Username cannot be empty',
      'string.max': 'Username must not exceed 100 characters',
      'any.required': 'Username is required'
    }),
    retailerPassword: Joi.string().min(1).max(500).required().messages({
      'string.min': 'Retailer password cannot be empty',
      'string.max': 'Retailer password must not exceed 500 characters',
      'any.required': 'Retailer password is required'
    }),
    userPassword: Joi.string().min(8).max(128).required().messages({
      'string.min': 'User password must be at least 8 characters',
      'string.max': 'User password must not exceed 128 characters',
      'any.required': 'User password is required for secure encryption'
    }),
    twoFactorEnabled: Joi.boolean().optional().default(false)
  }),

  getRetailerCredentialSecure: {
    params: Joi.object({
      retailer: Joi.string().min(1).max(50).required().messages({
        'string.min': 'Retailer name cannot be empty',
        'string.max': 'Retailer name must not exceed 50 characters',
        'any.required': 'Retailer is required'
      })
    }),
    body: Joi.object({
      userPassword: Joi.string().min(8).max(128).required().messages({
        'string.min': 'User password must be at least 8 characters',
        'string.max': 'User password must not exceed 128 characters',
        'any.required': 'User password is required for secure decryption'
      })
    })
  },

  migrateCredentialsToUserEncryption: Joi.object({
    userPassword: Joi.string().min(8).max(128).required().messages({
      'string.min': 'User password must be at least 8 characters',
      'string.max': 'User password must not exceed 128 characters',
      'any.required': 'User password is required for credential migration'
    })
  }),

  addPaymentMethod: Joi.object({
    type: Joi.string().valid('credit_card', 'debit_card', 'paypal').required().messages({
      'any.only': 'Payment method type must be credit_card, debit_card, or paypal',
      'any.required': 'Payment method type is required'
    }),
    name: Joi.string().min(1).max(100).required().messages({
      'string.min': 'Payment method name cannot be empty',
      'string.max': 'Payment method name must not exceed 100 characters',
      'any.required': 'Payment method name is required'
    }),
    encrypted_data: Joi.string().required().messages({
      'any.required': 'Payment method data is required'
    }),
    is_default: Joi.boolean().default(false)
  }),

  updatePaymentMethod: {
    params: Joi.object({
      paymentMethodId: commonSchemas.uuid
    }),
    body: Joi.object({
      name: Joi.string().min(1).max(100).optional(),
      encrypted_data: Joi.string().optional(),
      is_default: Joi.boolean().optional()
    })
  },

  deletePaymentMethod: {
    params: Joi.object({
      paymentMethodId: commonSchemas.uuid
    })
  }
};

// Admin schemas
export const adminSchemas = {
  getUsers: {
    query: Joi.object({
      ...commonSchemas.pagination,
      search: Joi.string().max(200).optional(),
      role: Joi.string().valid('user', 'admin', 'super_admin').optional(),
      subscription_tier: Joi.string().valid('free', 'pro').optional(),
      is_active: commonSchemas.booleanFlag,
      sort_by: Joi.string().valid('created_at', 'email', 'last_login').default('created_at'),
      sort_order: Joi.string().valid('asc', 'desc').default('desc')
    })
  },

  updateUserRole: {
    params: Joi.object({
      userId: commonSchemas.uuid
    }),
    body: Joi.object({
      role: Joi.string().valid('user', 'admin', 'super_admin').required(),
      permissions: Joi.array().items(Joi.string()).default([])
    })
  },

  suspendUser: {
    params: Joi.object({
      userId: commonSchemas.uuid
    }),
    body: Joi.object({
      suspend: Joi.boolean().required(),
      reason: Joi.string().optional()
    })
  },

  createMLModel: {
    body: Joi.object({
      name: Joi.string().required(),
      version: Joi.string().required(),
      config: Joi.object().default({}),
      training_notes: Joi.string().optional()
    })
  },

  reviewTrainingData: {
    params: Joi.object({
      dataId: commonSchemas.uuid
    }),
    body: Joi.object({
      status: Joi.string().valid('approved', 'rejected').required(),
      review_notes: Joi.string().optional()
    })
  },

  // Temporary test route schema for purchase enqueue
  testPurchase: {
    body: Joi.object({
      productId: commonSchemas.uuid,
      retailerSlug: Joi.string().min(1).max(100).required().messages({
        'string.min': 'retailerSlug cannot be empty',
        'string.max': 'retailerSlug must not exceed 100 characters',
        'any.required': 'retailerSlug is required'
      }),
      maxPrice: Joi.number().min(0).optional(),
      qty: Joi.number().integer().min(1).max(10).default(1),
      alertAt: Joi.string().isoDate().optional()
    })
  }
};

// Subscription schemas
export const subscriptionSchemas = {
  createCheckoutSession: Joi.object({
    planSlug: Joi.string()
      .valid('free', 'pro', 'pro-monthly', 'pro-yearly', 'premium-monthly', 'pro-plus')
      .required()
      .messages({
        'any.only': 'Plan must be one of "free", "pro", "pro-monthly", "pro-yearly", "premium-monthly", or "pro-plus"',
        'any.required': 'Plan is required'
      }),
    successUrl: Joi.string().uri().required().messages({
      'string.uri': 'Success URL must be a valid URL',
      'any.required': 'Success URL is required'
    }),
    cancelUrl: Joi.string().uri().required().messages({
      'string.uri': 'Cancel URL must be a valid URL',
      'any.required': 'Cancel URL is required'
    })
  }),

  cancelSubscription: Joi.object({
    cancelAtPeriodEnd: Joi.boolean().default(true),
    reason: Joi.string().max(500).optional().messages({
      'string.max': 'Reason must not exceed 500 characters'
    })
  })
};

// RBAC schemas (Role-Based Access Control)
export const rbacSchemas = {
  updatePermissions: {
    params: Joi.object({
      userId: commonSchemas.uuid
    }),
    body: Joi.object({
      permissions: Joi.array().items(Joi.string()).required().messages({
        'array.base': 'Permissions must be an array',
        'any.required': 'Permissions are required'
      }),
      reason: Joi.string().optional().messages({
        'string.base': 'Reason must be a string'
      })
    })
  },

  updateRole: {
    params: Joi.object({
      userId: commonSchemas.uuid
    }),
    body: Joi.object({
      role: Joi.string().required().messages({
        'any.required': 'Role is required'
      }),
      reason: Joi.string().optional().messages({
        'string.base': 'Reason must be a string'
      })
    })
  },

  addPermission: {
    params: Joi.object({
      userId: commonSchemas.uuid
    }),
    body: Joi.object({
      permission: Joi.string().required().messages({
        'any.required': 'Permission is required'
      }),
      reason: Joi.string().optional().messages({
        'string.base': 'Reason must be a string'
      })
    })
  },

  removePermission: {
    params: Joi.object({
      userId: commonSchemas.uuid
    }),
    body: Joi.object({
      permission: Joi.string().required().messages({
        'any.required': 'Permission is required'
      }),
      reason: Joi.string().optional().messages({
        'string.base': 'Reason must be a string'
      })
    })
  },

  getUserPermissions: {
    params: Joi.object({
      userId: commonSchemas.uuid
    })
  },

  getUserRole: {
    params: Joi.object({
      userId: commonSchemas.uuid
    })
  },

  testPurchase: {
    body: Joi.object({
      productId: Joi.string().uuid().required().messages({
        'string.uuid': 'productId must be a valid UUID',
        'any.required': 'productId is required'
      }),
      retailerSlug: Joi.string().valid('best-buy', 'walmart', 'costco', 'sams-club').required().messages({
        'any.only': 'retailerSlug must be one of best-buy, walmart, costco, sams-club',
        'any.required': 'retailerSlug is required'
      }),
      maxPrice: Joi.number().min(0).optional().messages({
        'number.min': 'maxPrice cannot be negative'
      }),
      qty: Joi.number().integer().min(1).max(10).default(1).messages({
        'number.min': 'qty must be at least 1',
        'number.max': 'qty must not exceed 10'
      }),
      alertAt: Joi.date().iso().optional().messages({
        'date.format': 'alertAt must be an ISO date string'
      })
    })
  }
};

// Monitoring schemas
export const monitoringSchemas = {
  addAlertRule: Joi.object({
    id: Joi.string().required().messages({
      'any.required': 'Rule ID is required'
    }),
    name: Joi.string().min(1).max(100).required().messages({
      'string.min': 'Rule name cannot be empty',
      'string.max': 'Rule name cannot exceed 100 characters',
      'any.required': 'Rule name is required'
    }),
    metric: Joi.string().required().messages({
      'any.required': 'Metric is required'
    }),
    operator: Joi.string().valid('gt', 'lt', 'eq', 'gte', 'lte').required().messages({
      'any.only': 'Operator must be one of: gt, lt, eq, gte, lte',
      'any.required': 'Operator is required'
    }),
    threshold: Joi.number().required().messages({
      'number.base': 'Threshold must be a number',
      'any.required': 'Threshold is required'
    }),
    duration: Joi.number().integer().min(1).required().messages({
      'number.base': 'Duration must be a number',
      'number.integer': 'Duration must be an integer',
      'number.min': 'Duration must be at least 1',
      'any.required': 'Duration is required'
    }),
    severity: Joi.string().valid('low', 'medium', 'high', 'critical').required().messages({
      'any.only': 'Severity must be one of: low, medium, high, critical',
      'any.required': 'Severity is required'
    }),
    enabled: commonSchemas.booleanFlag,
    notificationChannels: Joi.array().items(
      Joi.string().valid('email', 'sms', 'discord', 'webhook')
    ).default(['email']).messages({
      'array.base': 'Notification channels must be an array'
    })
  })
};

// Community schemas
export const communitySchemas = {
  createTestimonial: Joi.object({
    content: Joi.string().min(10).max(1000).required().messages({
      'string.min': 'Content must be at least 10 characters',
      'string.max': 'Content must not exceed 1000 characters',
      'any.required': 'Content is required'
    }),
    rating: Joi.number().integer().min(1).max(5).required().messages({
      'number.min': 'Rating must be between 1 and 5',
      'number.max': 'Rating must be between 1 and 5',
      'any.required': 'Rating is required'
    }),
    isPublic: Joi.boolean().default(true),
    tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
    metadata: Joi.object({
      productsSaved: Joi.number().integer().min(0).optional(),
      moneySaved: Joi.number().min(0).optional(),
      timeUsing: Joi.string().max(100).optional(),
      favoriteFeature: Joi.string().max(200).optional()
    }).optional()
  }),

  updateTestimonial: {
    params: Joi.object({
      id: commonSchemas.uuid
    }),
    body: Joi.object({
      content: Joi.string().min(10).max(1000).optional(),
      rating: Joi.number().integer().min(1).max(5).optional(),
      isPublic: Joi.boolean().optional(),
      tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
      metadata: Joi.object().optional()
    })
  },

  getTestimonials: {
    query: Joi.object({
      ...commonSchemas.pagination,
      userId: commonSchemas.optionalUuid,
      isPublic: Joi.boolean().optional(),
      isFeatured: Joi.boolean().optional(),
      moderationStatus: Joi.string().valid('pending', 'approved', 'rejected').optional(),
      minRating: Joi.number().integer().min(1).max(5).optional(),
      tags: Joi.string().optional() // comma-separated string
    })
  },

  createPost: Joi.object({
    type: Joi.string().valid('success_story', 'tip', 'collection_showcase', 'deal_share', 'question').required().messages({
      'any.only': 'Post type must be one of: success_story, tip, collection_showcase, deal_share, question',
      'any.required': 'Post type is required'
    }),
    title: Joi.string().min(5).max(200).required().messages({
      'string.min': 'Title must be at least 5 characters',
      'string.max': 'Title must not exceed 200 characters',
      'any.required': 'Title is required'
    }),
    content: Joi.string().min(10).max(5000).required().messages({
      'string.min': 'Content must be at least 10 characters',
      'string.max': 'Content must not exceed 5000 characters',
      'any.required': 'Content is required'
    }),
    images: Joi.array().items(Joi.string().uri()).max(10).optional().messages({
      'array.max': 'Maximum 10 images allowed'
    }),
    tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
    isPublic: Joi.boolean().default(true)
  }),

  updatePost: {
    params: Joi.object({
      id: commonSchemas.uuid
    }),
    body: Joi.object({
      type: Joi.string().valid('success_story', 'tip', 'collection_showcase', 'deal_share', 'question').optional(),
      title: Joi.string().min(5).max(200).optional(),
      content: Joi.string().min(10).max(5000).optional(),
      images: Joi.array().items(Joi.string().uri()).max(10).optional(),
      tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
      isPublic: Joi.boolean().optional()
    })
  },

  getPosts: {
    query: Joi.object({
      ...commonSchemas.pagination,
      userId: commonSchemas.optionalUuid,
      type: Joi.string().valid('success_story', 'tip', 'collection_showcase', 'deal_share', 'question').optional(),
      isPublic: Joi.boolean().optional(),
      isFeatured: Joi.boolean().optional(),
      moderationStatus: Joi.string().valid('pending', 'approved', 'rejected').optional(),
      tags: Joi.string().optional() // comma-separated string
    })
  },

  addComment: {
    params: Joi.object({
      id: commonSchemas.uuid
    }),
    body: Joi.object({
      content: Joi.string().min(1).max(500).required().messages({
        'string.min': 'Comment cannot be empty',
        'string.max': 'Comment must not exceed 500 characters',
        'any.required': 'Comment content is required'
      }),
      isPublic: Joi.boolean().default(true)
    })
  },

  getPostComments: {
    params: Joi.object({
      id: commonSchemas.uuid
    }),
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(100).default(50),
      offset: Joi.number().integer().min(0).default(0)
    })
  },

  togglePostLike: {
    params: Joi.object({
      id: commonSchemas.uuid
    })
  },

  moderateContent: Joi.object({
    contentType: Joi.string().valid('testimonial', 'post', 'comment').required().messages({
      'any.only': 'Content type must be one of: testimonial, post, comment',
      'any.required': 'Content type is required'
    }),
    contentId: commonSchemas.uuid,
    action: Joi.string().valid('approve', 'reject').required().messages({
      'any.only': 'Action must be either approve or reject',
      'any.required': 'Action is required'
    }),
    notes: Joi.string().max(1000).optional().messages({
      'string.max': 'Notes must not exceed 1000 characters'
    })
  }),

  deleteTestimonial: {
    params: Joi.object({
      id: commonSchemas.uuid
    })
  },

  deletePost: {
    params: Joi.object({
      id: commonSchemas.uuid
    })
  }
};

// Discord schemas
export const discordSchemas = {
  sendAlert: Joi.object({
    channel_id: Joi.string().required().messages({
      'any.required': 'Channel ID is required'
    }),
    message: Joi.string().min(1).max(2000).required().messages({
      'string.min': 'Message cannot be empty',
      'string.max': 'Message must not exceed 2000 characters',
      'any.required': 'Message is required'
    }),
    embed: Joi.object().optional()
  }),

  configureBot: Joi.object({
    guild_id: Joi.string().required().messages({
      'any.required': 'Guild ID is required'
    }),
    channel_id: Joi.string().required().messages({
      'any.required': 'Channel ID is required'
    }),
    webhook_url: Joi.string().uri().optional().messages({
      'string.uri': 'Webhook URL must be a valid URL'
    })
  })
};

// CSV schemas
export const csvSchemas = {
  importWatches: Joi.object({
    data: Joi.array().items(Joi.object({
      product_id: commonSchemas.uuid,
      retailer_ids: Joi.array().items(commonSchemas.uuid).min(1).required(),
      max_price: Joi.number().min(0).optional(),
      notification_channels: Joi.array().items(
        Joi.string().valid('web_push', 'email', 'sms', 'discord')
      ).min(1).required()
    })).min(1).required().messages({
      'array.min': 'At least one watch entry is required',
      'any.required': 'Watch data is required'
    }),
    overwrite_existing: Joi.boolean().default(false)
  }),

  exportWatches: {
    query: Joi.object({
      format: Joi.string().valid('csv', 'json').default('csv'),
      include_inactive: Joi.boolean().default(false)
    })
  }
};

// Social schemas
export const socialSchemas = {
  shareProduct: {
    params: Joi.object({
      productId: commonSchemas.uuid
    }),
    body: Joi.object({
      platform: Joi.string().valid('twitter', 'facebook', 'instagram', 'discord').required().messages({
        'any.only': 'Platform must be one of: twitter, facebook, instagram, discord',
        'any.required': 'Platform is required'
      }),
      message: Joi.string().max(500).optional().messages({
        'string.max': 'Message must not exceed 500 characters'
      })
    })
  },

  shareAlert: {
    params: Joi.object({
      alertId: commonSchemas.uuid
    }),
    body: Joi.object({
      platform: Joi.string().valid('twitter', 'facebook', 'instagram', 'discord').required(),
      include_price: Joi.boolean().default(true),
      custom_message: Joi.string().max(500).optional()
    })
  }
};

// Webhook schemas
export const webhookSchemas = {
  createWebhook: Joi.object({
    url: Joi.string().uri().required().messages({
      'string.uri': 'URL must be a valid URL',
      'any.required': 'URL is required'
    }),
    events: Joi.array().items(
      Joi.string().valid('product_restock', 'price_drop', 'new_product', 'watch_created')
    ).min(1).required().messages({
      'array.min': 'At least one event type must be selected',
      'any.required': 'Event types are required'
    }),
    secret: Joi.string().min(8).max(128).optional().messages({
      'string.min': 'Secret must be at least 8 characters',
      'string.max': 'Secret must not exceed 128 characters'
    }),
    is_active: commonSchemas.booleanFlag
  }),

  updateWebhook: {
    params: Joi.object({
      webhookId: commonSchemas.uuid
    }),
    body: Joi.object({
      url: Joi.string().uri().optional(),
      events: Joi.array().items(
        Joi.string().valid('product_restock', 'price_drop', 'new_product', 'watch_created')
      ).min(1).optional(),
      secret: Joi.string().min(8).max(128).optional(),
      is_active: commonSchemas.booleanFlag
    })
  },

  testWebhook: {
    params: Joi.object({
      webhookId: commonSchemas.uuid
    }),
    body: Joi.object({
      event_type: Joi.string().valid('product_restock', 'price_drop', 'new_product', 'watch_created').required()
    })
  }
};
