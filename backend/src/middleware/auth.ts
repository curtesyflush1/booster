import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { logger } from '../utils/logger';
import { IUser } from '../types/database';
import { AuthResponseFactory } from '../utils/authResponseFactory';
import { SubscriptionTier, SubscriptionValidator } from '../types/subscription';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: Omit<IUser, 'password_hash'>;
    }
  }
}

/**
 * Extract and validate Bearer token from request headers
 */
const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  return token.length > 0 ? token : null;
};

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      AuthResponseFactory.sendMissingToken(res);
      return;
    }

    // Validate token and get user
    const user = await authService.validateAccessToken(token);
    req.user = user;

    next();
  } catch (error) {
    logger.error('Authentication failed', { 
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    AuthResponseFactory.sendInvalidToken(res);
  }
};

/**
 * Middleware to check if user has required subscription tier
 */
export const requireSubscription = (requiredTier: SubscriptionTier) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      AuthResponseFactory.sendAuthenticationRequired(res);
      return;
    }

    const userTier = req.user.subscription_tier as SubscriptionTier;
    
    if (!SubscriptionValidator.hasRequiredTier(userTier, requiredTier)) {
      AuthResponseFactory.sendInsufficientSubscription(res, requiredTier);
      return;
    }

    next();
  };
};

/**
 * Middleware to check if user's email is verified
 */
export const requireEmailVerification = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    AuthResponseFactory.sendAuthenticationRequired(res);
    return;
  }

  if (!req.user.email_verified) {
    AuthResponseFactory.sendEmailNotVerified(res);
    return;
  }

  next();
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (token) {
      const user = await authService.validateAccessToken(token);
      req.user = user;
    }

    next();
  } catch (error) {
    // Log but don't fail - this is optional auth
    logger.debug('Optional authentication failed', { 
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
      method: req.method
    });
    next();
  }
};