import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { IUser } from '../types/database';
import { CredentialService, RetailerCredentialInput } from '../services/credentialService';
import { QuietHoursService } from '../services/quietHoursService';

// Validation schemas
const updateProfileSchema = Joi.object({
  first_name: Joi.string().min(1).max(50).optional().allow(null).messages({
    'string.min': 'First name cannot be empty',
    'string.max': 'First name must not exceed 50 characters'
  }),
  last_name: Joi.string().min(1).max(50).optional().allow(null).messages({
    'string.min': 'Last name cannot be empty',
    'string.max': 'Last name must not exceed 50 characters'
  }),
  timezone: Joi.string().min(1).max(50).optional().messages({
    'string.min': 'Timezone cannot be empty',
    'string.max': 'Timezone must not exceed 50 characters'
  }),
  zip_code: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional().allow(null).messages({
    'string.pattern.base': 'ZIP code must be in format 12345 or 12345-6789'
  })
});

const updatePreferencesSchema = Joi.object({
  preferences: Joi.object().optional().messages({
    'object.base': 'Preferences must be an object'
  })
});

const updateNotificationSettingsSchema = Joi.object({
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
});

const updateQuietHoursSchema = Joi.object({
  enabled: Joi.boolean().required(),
  start_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).when('enabled', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional()
  }).messages({
    'string.pattern.base': 'Time must be in HH:MM format (24-hour)',
    'any.required': 'Start time is required when quiet hours are enabled'
  }),
  end_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).when('enabled', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional()
  }).messages({
    'string.pattern.base': 'Time must be in HH:MM format (24-hour)',
    'any.required': 'End time is required when quiet hours are enabled'
  }),
  timezone: Joi.string().min(1).max(50).when('enabled', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional()
  }).messages({
    'string.min': 'Timezone cannot be empty',
    'string.max': 'Timezone must not exceed 50 characters',
    'any.required': 'Timezone is required when quiet hours are enabled'
  }),
  days: Joi.array().items(Joi.number().integer().min(0).max(6)).when('enabled', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional()
  }).messages({
    'array.base': 'Days must be an array',
    'number.base': 'Day must be a number',
    'number.integer': 'Day must be an integer',
    'number.min': 'Day must be between 0 and 6 (Sunday = 0)',
    'number.max': 'Day must be between 0 and 6 (Sunday = 0)',
    'any.required': 'Days are required when quiet hours are enabled'
  })
});

const addShippingAddressSchema = Joi.object({
  type: Joi.string().valid('shipping', 'billing').required().messages({
    'any.only': 'Address type must be either "shipping" or "billing"',
    'any.required': 'Address type is required'
  }),
  first_name: Joi.string().min(1).max(50).required().messages({
    'string.min': 'First name cannot be empty',
    'string.max': 'First name must not exceed 50 characters',
    'any.required': 'First name is required'
  }),
  last_name: Joi.string().min(1).max(50).required().messages({
    'string.min': 'Last name cannot be empty',
    'string.max': 'Last name must not exceed 50 characters',
    'any.required': 'Last name is required'
  }),
  address_line_1: Joi.string().min(1).max(100).required().messages({
    'string.min': 'Address line 1 cannot be empty',
    'string.max': 'Address line 1 must not exceed 100 characters',
    'any.required': 'Address line 1 is required'
  }),
  address_line_2: Joi.string().max(100).optional().allow(null, '').messages({
    'string.max': 'Address line 2 must not exceed 100 characters'
  }),
  city: Joi.string().min(1).max(50).required().messages({
    'string.min': 'City cannot be empty',
    'string.max': 'City must not exceed 50 characters',
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
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional().allow(null, '').messages({
    'string.pattern.base': 'Phone number format is invalid'
  }),
  is_default: Joi.boolean().default(false)
});

const addRetailerCredentialSchema = Joi.object({
  retailer: Joi.string().min(1).max(50).required().messages({
    'string.min': 'Retailer name cannot be empty',
    'string.max': 'Retailer name must not exceed 50 characters',
    'any.required': 'Retailer name is required'
  }),
  username: Joi.string().min(1).max(100).required().messages({
    'string.min': 'Username cannot be empty',
    'string.max': 'Username must not exceed 100 characters',
    'any.required': 'Username is required'
  }),
  password: Joi.string().min(1).max(200).required().messages({
    'string.min': 'Password cannot be empty',
    'string.max': 'Password must not exceed 200 characters',
    'any.required': 'Password is required'
  }),
  twoFactorEnabled: Joi.boolean().default(false)
});

const updateRetailerCredentialSchema = Joi.object({
  username: Joi.string().min(1).max(100).optional().messages({
    'string.min': 'Username cannot be empty',
    'string.max': 'Username must not exceed 100 characters'
  }),
  password: Joi.string().min(1).max(200).optional().messages({
    'string.min': 'Password cannot be empty',
    'string.max': 'Password must not exceed 200 characters'
  }),
  twoFactorEnabled: Joi.boolean().optional()
});

const addPaymentMethodSchema = Joi.object({
  type: Joi.string().valid('credit_card', 'debit_card', 'paypal').required().messages({
    'any.only': 'Payment method type must be credit_card, debit_card, or paypal',
    'any.required': 'Payment method type is required'
  }),
  last_four: Joi.string().pattern(/^\d{4}$/).required().messages({
    'string.pattern.base': 'Last four digits must be exactly 4 digits',
    'any.required': 'Last four digits are required'
  }),
  brand: Joi.string().min(1).max(50).required().messages({
    'string.min': 'Brand cannot be empty',
    'string.max': 'Brand must not exceed 50 characters',
    'any.required': 'Brand is required'
  }),
  expires_month: Joi.number().integer().min(1).max(12).required().messages({
    'number.base': 'Expiry month must be a number',
    'number.integer': 'Expiry month must be an integer',
    'number.min': 'Expiry month must be between 1 and 12',
    'number.max': 'Expiry month must be between 1 and 12',
    'any.required': 'Expiry month is required'
  }),
  expires_year: Joi.number().integer().min(new Date().getFullYear()).required().messages({
    'number.base': 'Expiry year must be a number',
    'number.integer': 'Expiry year must be an integer',
    'number.min': 'Expiry year cannot be in the past',
    'any.required': 'Expiry year is required'
  }),
  billing_address_id: Joi.string().uuid().required().messages({
    'string.uuid': 'Billing address ID must be a valid UUID',
    'any.required': 'Billing address ID is required'
  }),
  is_default: Joi.boolean().default(false)
});

/**
 * Get current user profile with enhanced security and error handling
 */
export const getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.id) {
      logger.warn('Profile access attempt without valid user', { 
        ip: req.ip, 
        userAgent: req.get('User-Agent') 
      });
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Get fresh user data from database
    const user = await User.findById<IUser>(req.user.id);
    if (!user) {
      logger.warn('User profile requested for non-existent user', { 
        userId: req.user.id,
        ip: req.ip 
      });
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Remove sensitive fields from response using a more secure approach
    const sensitiveFields = [
      'password_hash', 'reset_token', 'reset_token_expires', 
      'verification_token', 'failed_login_attempts'
    ] as const;
    
    const userProfile = Object.fromEntries(
      Object.entries(user).filter(([key]) => !sensitiveFields.includes(key as any))
    );

    logger.info('User profile accessed', { userId: req.user.id });

    res.status(200).json({
      user: userProfile
    });
  } catch (error) {
    logger.error('Error retrieving user profile', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
};

/**
 * Update user profile information
 */
export const updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate request body
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation error',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Update user profile
    const updatedUser = await User.updateById<IUser>(req.user.id, value);
    if (!updatedUser) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Remove sensitive fields from response
    const { password_hash, reset_token, reset_token_expires, verification_token, ...userProfile } = updatedUser;

    logger.info('User profile updated', { userId: req.user.id });

    res.status(200).json({
      message: 'Profile updated successfully',
      user: userProfile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user preferences
 */
export const updatePreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate request body
    const { error, value } = updatePreferencesSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation error',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { preferences } = value;

    // Update preferences
    const success = await User.updatePreferences(req.user.id, preferences);
    if (!success) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    logger.info('User preferences updated', { userId: req.user.id });

    res.status(200).json({
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update notification settings
 */
export const updateNotificationSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate request body
    const { error, value } = updateNotificationSettingsSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation error',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Update notification settings
    const success = await User.updateNotificationSettings(req.user.id, value);
    if (!success) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    logger.info('User notification settings updated', { userId: req.user.id });

    res.status(200).json({
      message: 'Notification settings updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update quiet hours settings
 */
export const updateQuietHours = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate request body
    const { error, value } = updateQuietHoursSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation error',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Update quiet hours
    const updatedUser = await User.updateById<IUser>(req.user.id, {
      quiet_hours: value
    });

    if (!updatedUser) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    logger.info('User quiet hours updated', { userId: req.user.id });

    res.status(200).json({
      message: 'Quiet hours updated successfully',
      quiet_hours: updatedUser.quiet_hours
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add shipping address
 */
export const addShippingAddress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate request body
    const { error, value } = addShippingAddressSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation error',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Generate unique ID for the address
    const addressWithId = {
      ...value,
      id: require('crypto').randomUUID()
    };

    // Add shipping address
    const success = await User.addShippingAddress(req.user.id, addressWithId);
    if (!success) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    logger.info('Shipping address added', { userId: req.user.id, addressId: addressWithId.id });

    res.status(201).json({
      message: 'Shipping address added successfully',
      address: addressWithId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove shipping address
 */
export const removeShippingAddress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { addressId } = req.params;

    if (!addressId) {
      res.status(400).json({
        error: {
          code: 'MISSING_ADDRESS_ID',
          message: 'Address ID is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Remove shipping address
    const success = await User.removeShippingAddress(req.user.id, addressId);
    if (!success) {
      res.status(404).json({
        error: {
          code: 'ADDRESS_NOT_FOUND',
          message: 'Address not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    logger.info('Shipping address removed', { userId: req.user.id, addressId });

    res.status(200).json({
      message: 'Shipping address removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user statistics
 */
export const getUserStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Get user statistics
    const stats = await User.getUserStats(req.user.id);
    if (!stats) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    res.status(200).json({
      stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add retailer credentials
 */
export const addRetailerCredentials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate request body
    const { error, value } = addRetailerCredentialSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation error',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Store encrypted credentials
    const success = await CredentialService.storeRetailerCredentials(req.user.id, value);
    if (!success) {
      res.status(500).json({
        error: {
          code: 'CREDENTIAL_STORAGE_FAILED',
          message: 'Failed to store retailer credentials',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    logger.info('Retailer credentials added', { userId: req.user.id, retailer: value.retailer });

    res.status(201).json({
      message: 'Retailer credentials added successfully',
      retailer: value.retailer
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get retailer credentials list (without passwords)
 */
export const getRetailerCredentials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const credentials = await CredentialService.listRetailerCredentials(req.user.id);

    res.status(200).json({
      credentials
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update retailer credentials
 */
export const updateRetailerCredentials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { retailer } = req.params;
    if (!retailer) {
      res.status(400).json({
        error: {
          code: 'MISSING_RETAILER',
          message: 'Retailer parameter is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate request body
    const { error, value } = updateRetailerCredentialSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation error',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Update credentials
    const success = await CredentialService.updateRetailerCredentials(req.user.id, retailer, value);
    if (!success) {
      res.status(404).json({
        error: {
          code: 'CREDENTIALS_NOT_FOUND',
          message: 'Retailer credentials not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    logger.info('Retailer credentials updated', { userId: req.user.id, retailer });

    res.status(200).json({
      message: 'Retailer credentials updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete retailer credentials
 */
export const deleteRetailerCredentials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { retailer } = req.params;
    if (!retailer) {
      res.status(400).json({
        error: {
          code: 'MISSING_RETAILER',
          message: 'Retailer parameter is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Delete credentials
    const success = await CredentialService.deleteRetailerCredentials(req.user.id, retailer);
    if (!success) {
      res.status(404).json({
        error: {
          code: 'CREDENTIALS_NOT_FOUND',
          message: 'Retailer credentials not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    logger.info('Retailer credentials deleted', { userId: req.user.id, retailer });

    res.status(200).json({
      message: 'Retailer credentials deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify retailer credentials
 */
export const verifyRetailerCredentials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { retailer } = req.params;
    if (!retailer) {
      res.status(400).json({
        error: {
          code: 'MISSING_RETAILER',
          message: 'Retailer parameter is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Verify credentials
    const result = await CredentialService.verifyRetailerCredentials(req.user.id, retailer);

    res.status(200).json({
      message: result.message,
      isValid: result.isValid
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add payment method
 */
export const addPaymentMethod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate request body
    const { error, value } = addPaymentMethodSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation error',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Generate unique ID for the payment method
    const paymentMethodWithId = {
      ...value,
      id: require('crypto').randomUUID()
    };

    // Get current user to update payment methods
    const user = await User.findById<IUser>(req.user.id);
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Add payment method
    const updatedPaymentMethods = [...user.payment_methods, paymentMethodWithId];
    const success = await User.updateById<IUser>(req.user.id, {
      payment_methods: updatedPaymentMethods
    });

    if (!success) {
      res.status(500).json({
        error: {
          code: 'PAYMENT_METHOD_ADD_FAILED',
          message: 'Failed to add payment method',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    logger.info('Payment method added', { userId: req.user.id, paymentMethodId: paymentMethodWithId.id });

    res.status(201).json({
      message: 'Payment method added successfully',
      paymentMethod: paymentMethodWithId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove payment method
 */
export const removePaymentMethod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { paymentMethodId } = req.params;
    if (!paymentMethodId) {
      res.status(400).json({
        error: {
          code: 'MISSING_PAYMENT_METHOD_ID',
          message: 'Payment method ID is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Get current user
    const user = await User.findById<IUser>(req.user.id);
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Remove payment method
    const updatedPaymentMethods = user.payment_methods.filter(pm => pm.id !== paymentMethodId);
    
    if (updatedPaymentMethods.length === user.payment_methods.length) {
      res.status(404).json({
        error: {
          code: 'PAYMENT_METHOD_NOT_FOUND',
          message: 'Payment method not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const success = await User.updateById<IUser>(req.user.id, {
      payment_methods: updatedPaymentMethods
    });

    if (!success) {
      res.status(500).json({
        error: {
          code: 'PAYMENT_METHOD_REMOVE_FAILED',
          message: 'Failed to remove payment method',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    logger.info('Payment method removed', { userId: req.user.id, paymentMethodId });

    res.status(200).json({
      message: 'Payment method removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check quiet hours status
 */
export const checkQuietHours = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const quietCheck = await QuietHoursService.isQuietTime(req.user.id);

    res.status(200).json({
      isQuietTime: quietCheck.isQuietTime,
      nextActiveTime: quietCheck.nextActiveTime,
      reason: quietCheck.reason
    });
  } catch (error) {
    next(error);
  }
};