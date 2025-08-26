import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { authService } from '../services/authService';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { IUserRegistration, ILoginCredentials } from '../types/database';

// Validation schemas
const registrationSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(8).max(128).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password must not exceed 128 characters',
    'any.required': 'Password is required'
  }),
  first_name: Joi.string().min(1).max(50).optional().messages({
    'string.min': 'First name cannot be empty',
    'string.max': 'First name must not exceed 50 characters'
  }),
  last_name: Joi.string().min(1).max(50).optional().messages({
    'string.min': 'Last name cannot be empty',
    'string.max': 'Last name must not exceed 50 characters'
  })
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  })
});

const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string().required().messages({
    'any.required': 'Refresh token is required'
  })
});

const passwordResetRequestSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  })
});

const passwordResetSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Reset token is required'
  }),
  password: Joi.string().min(8).max(128).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password must not exceed 128 characters',
    'any.required': 'Password is required'
  })
});

const changePasswordSchema = Joi.object({
  current_password: Joi.string().required().messages({
    'any.required': 'Current password is required'
  }),
  new_password: Joi.string().min(8).max(128).required().messages({
    'string.min': 'New password must be at least 8 characters long',
    'string.max': 'New password must not exceed 128 characters',
    'any.required': 'New password is required'
  })
});

const emailVerificationSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Verification token is required'
  })
});

/**
 * Register a new user
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = registrationSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || "Validation failed",
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const userData: IUserRegistration = value;

    // Register user
    const result = await authService.register(userData);

    logger.info('User registration successful', { 
      userId: result.user.id, 
      email: result.user.email 
    });

    res.status(201).json({
      message: 'Registration successful',
      user: result.user,
      tokens: result.tokens
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'User already exists with this email') {
      res.status(409).json({
        error: {
          code: 'USER_EXISTS',
          message: 'A user with this email already exists',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next(error);
  }
};

/**
 * Login user
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || "Validation failed",
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const credentials: ILoginCredentials = value;

    // Login user
    const result = await authService.login(credentials);

    logger.info('User login successful', { 
      userId: result.user.id, 
      email: result.user.email 
    });

    res.status(200).json({
      message: 'Login successful',
      user: result.user,
      tokens: result.tokens
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid credentials') {
      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    if (error instanceof Error && error.message.includes('Account is temporarily locked')) {
      res.status(423).json({
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account is temporarily locked due to too many failed login attempts',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next(error);
  }
};

/**
 * Refresh access token
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = refreshTokenSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || "Validation failed",
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { refresh_token } = value;

    // Refresh token
    const tokens = await authService.refreshToken(refresh_token);

    res.status(200).json({
      message: 'Token refreshed successfully',
      tokens
    });
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token',
        timestamp: new Date().toISOString()
      }
    });
  }
};

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
    const user = await User.findById(req.user.id);
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
    const { password_hash, ...userWithoutPassword } = user as any;

    res.status(200).json({
      user: userWithoutPassword
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Request password reset
 */
export const requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = passwordResetRequestSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || "Validation failed",
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { email } = value;

    // Initiate password reset
    await authService.initiatePasswordReset(email);

    // Always return success to prevent email enumeration
    res.status(200).json({
      message: 'If an account with this email exists, a password reset link has been sent.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password using token
 */
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = passwordResetSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || "Validation failed",
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { token, password } = value;

    // Reset password
    await authService.resetPassword(token, password);

    res.status(200).json({
      message: 'Password reset successful'
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid or expired')) {
      res.status(400).json({
        error: {
          code: 'INVALID_RESET_TOKEN',
          message: 'Invalid or expired reset token',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next(error);
  }
};

/**
 * Change password (requires current password)
 */
export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || "Validation failed",
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { current_password, new_password } = value;

    // Change password
    await authService.changePassword(req.user.id, current_password, new_password);

    res.status(200).json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Current password is incorrect') {
      res.status(400).json({
        error: {
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'Current password is incorrect',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next(error);
  }
};

/**
 * Verify email using token
 */
export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = emailVerificationSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || "Validation failed",
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { token } = value;

    // Verify email
    await authService.verifyEmail(token);

    res.status(200).json({
      message: 'Email verified successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid verification token') {
      res.status(400).json({
        error: {
          code: 'INVALID_VERIFICATION_TOKEN',
          message: 'Invalid verification token',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next(error);
  }
};

/**
 * Logout user (client-side token invalidation)
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  // In a JWT-based system, logout is typically handled client-side
  // by removing the tokens from storage. Server-side logout would
  // require token blacklisting, which we can implement later if needed.
  
  res.status(200).json({
    message: 'Logout successful'
  });
};