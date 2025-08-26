import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { IUser } from '../types/database';

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

/**
 * Get current user profile
 */
export const getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    // Get fresh user data from database
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

    // Remove password hash from response
    const { password_hash, reset_token, reset_token_expires, verification_token, ...userProfile } = user;

    res.status(200).json({
      user: userProfile
    });
  } catch (error) {
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