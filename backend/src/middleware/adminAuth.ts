import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { IUser } from '../types/database';

/**
 * Middleware to require admin role
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
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

  const user = req.user as IUser;
  
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    logger.warn('Unauthorized admin access attempt', {
      userId: user.id,
      email: user.email,
      role: user.role,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    res.status(403).json({
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Admin access required',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  next();
};

/**
 * Middleware to require super admin role
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
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

  const user = req.user as IUser;
  
  if (user.role !== 'super_admin') {
    logger.warn('Unauthorized super admin access attempt', {
      userId: user.id,
      email: user.email,
      role: user.role,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    res.status(403).json({
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Super admin access required',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  next();
};

/**
 * Middleware to check specific admin permissions
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
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

    const user = req.user as IUser;
    
    // Super admins have all permissions
    if (user.role === 'super_admin') {
      next();
      return;
    }

    // Check if user has admin role and specific permission
    if (user.role !== 'admin' || !user.admin_permissions.includes(permission)) {
      logger.warn('Insufficient permissions for admin action', {
        userId: user.id,
        email: user.email,
        role: user.role,
        requiredPermission: permission,
        userPermissions: user.admin_permissions,
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Permission '${permission}' required`,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };
};

/**
 * Admin permissions constants
 */
export const AdminPermissions = {
  USER_MANAGEMENT: 'user_management',
  USER_SUSPEND: 'user_suspend',
  USER_DELETE: 'user_delete',
  ML_MODEL_TRAINING: 'ml_model_training',
  ML_DATA_REVIEW: 'ml_data_review',
  SYSTEM_MONITORING: 'system_monitoring',
  ANALYTICS_VIEW: 'analytics_view',
  AUDIT_LOG_VIEW: 'audit_log_view'
} as const;

export type AdminPermission = typeof AdminPermissions[keyof typeof AdminPermissions];