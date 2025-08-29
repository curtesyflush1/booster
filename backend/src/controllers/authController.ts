import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { IUserRegistration, ILoginCredentials } from '../types/database';
import { 
  sendSuccessResponse, 
  sendErrorResponse, 
  handleControllerError,
  asyncHandler 
} from '../utils/controllerHelpers';
import { 
  hasAuthenticatedUser, 
  extractSafeUserData,
  isValidUser 
} from '../utils/typeGuards';

/**
 * Register a new user
 * Validation handled by middleware
 */
export const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userData: IUserRegistration = req.body;

  try {
    const result = await authService.register(userData);

    logger.info('User registration successful', { 
      userId: result.user.id, 
      email: result.user.email 
    });

    sendSuccessResponse(res, {
      message: 'Registration successful',
      user: result.user,
      tokens: result.tokens
    }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === 'User already exists with this email') {
      return sendErrorResponse(res, 409, 'USER_EXISTS', 'A user with this email already exists');
    }
    throw error;
  }
});

/**
 * Login user
 * Validation handled by middleware
 */
export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const credentials: ILoginCredentials = req.body;

  try {
    const result = await authService.login(credentials);

    logger.info('User login successful', { 
      userId: result.user.id, 
      email: result.user.email 
    });

    sendSuccessResponse(res, {
      message: 'Login successful',
      user: result.user,
      tokens: result.tokens
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid credentials') {
      return sendErrorResponse(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (error instanceof Error && error.message.includes('Account is temporarily locked')) {
      return sendErrorResponse(res, 423, 'ACCOUNT_LOCKED', 
        'Account is temporarily locked due to too many failed login attempts');
    }

    throw error;
  }
});

/**
 * Refresh access token
 * Validation handled by middleware
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refresh_token } = req.body;

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
export const getProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!hasAuthenticatedUser(req)) {
    return sendErrorResponse(res, 401, 'AUTHENTICATION_REQUIRED', 'Authentication is required');
  }

  // Get fresh user data from database
  const user = await User.findById(req.user.id);
  if (!user || !isValidUser(user)) {
    return sendErrorResponse(res, 404, 'USER_NOT_FOUND', 'User not found');
  }

  // Remove sensitive data from response
  const safeUserData = extractSafeUserData(user);

  sendSuccessResponse(res, { user: safeUserData });
});

/**
 * Request password reset
 * Validation handled by middleware
 */
export const requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

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
 * Validation handled by middleware
 */
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, password } = req.body;

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
 * Validation handled by middleware
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

    const { current_password, new_password } = req.body;

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
 * Validation handled by middleware
 */
export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.body;

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
 * Logout user by blacklisting tokens
 */
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Extract tokens from request
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const { refresh_token } = req.body;

    if (!accessToken) {
      res.status(400).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required for logout',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Logout user by blacklisting tokens
    await authService.logout(accessToken, refresh_token);

    res.status(200).json({
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user from all devices
 */
export const logoutAllDevices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    // Logout user from all devices
    await authService.logoutAllDevices(req.user.id);

    res.status(200).json({
      message: 'Logged out from all devices successfully'
    });
  } catch (error) {
    next(error);
  }
};