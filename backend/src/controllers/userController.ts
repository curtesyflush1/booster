import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { IUser } from '../types/database';
import { createCredentialService } from '../services/credentialService';
import { createQuietHoursService } from '../services/quietHoursService';
import { userSchemas } from '../validators/schemas';

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

    const value = req.body;

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
    const { error, value } = userSchemas.updatePreferences.validate(req.body);
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
    const { error, value } = userSchemas.updateNotificationSettings.validate(req.body);
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
    const { error, value } = userSchemas.updateQuietHours.validate(req.body);
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
    const { error, value } = userSchemas.addShippingAddress.validate(req.body);
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
    const { error, value } = userSchemas.addRetailerCredential.validate(req.body);
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
    const credentialService = createCredentialService();
    const success = await credentialService.storeRetailerCredentials(req.user.id, value);
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

    const credentialService = createCredentialService();
    const credentials = await credentialService.listRetailerCredentials(req.user.id);

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
    const { error, value } = userSchemas.updateRetailerCredential.body.validate(req.body);
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
    const credentialService = createCredentialService();
    const success = await credentialService.updateRetailerCredentials(req.user.id, retailer, value);
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
    const credentialService = createCredentialService();
    const success = await credentialService.deleteRetailerCredentials(req.user.id, retailer);
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
    const credentialService = createCredentialService();
    const result = await credentialService.verifyRetailerCredentials(req.user.id, retailer);

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
    const { error, value } = userSchemas.addPaymentMethod.validate(req.body);
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

    const quietHoursService = createQuietHoursService();
    const quietCheck = await quietHoursService.isQuietTime(req.user.id);

    res.status(200).json({
      isQuietTime: quietCheck.isQuietTime,
      nextActiveTime: quietCheck.nextActiveTime,
      reason: quietCheck.reason
    });
  } catch (error) {
    next(error);
  }
};