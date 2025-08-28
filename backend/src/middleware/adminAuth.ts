import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { IUser } from '../types/database';
import { RBACService } from '../services/rbacService';
import { Permission, SystemRoles, SystemRole } from '../types/permissions';

/**
 * Enhanced middleware to require specific permission using RBAC
 */
export const requirePermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const user = req.user as IUser;
    
    // Check permission using RBAC service
    const permissionCheck = RBACService.checkPermission(user, permission);
    
    if (!permissionCheck.hasPermission) {
      logger.warn('Insufficient permissions for action', {
        userId: user.id,
        email: user.email,
        role: user.role,
        requiredPermission: permission,
        userPermissions: user.admin_permissions,
        missingPermissions: permissionCheck.missingPermissions,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.headers['x-request-id']
      });

      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: permissionCheck.reason || `Permission '${permission}' required`,
          details: {
            requiredPermission: permission,
            missingPermissions: permissionCheck.missingPermissions
          },
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to require any of the specified permissions
 */
export const requireAnyPermission = (permissions: Permission[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const user = req.user as IUser;
    
    // Check if user has any of the required permissions
    const hasAnyPermission = RBACService.hasAnyPermission(user, permissions);
    
    if (!hasAnyPermission) {
      logger.warn('Insufficient permissions for action (any required)', {
        userId: user.id,
        email: user.email,
        role: user.role,
        requiredPermissions: permissions,
        userPermissions: user.admin_permissions,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.headers['x-request-id']
      });

      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `One of the following permissions required: ${permissions.join(', ')}`,
          details: {
            requiredPermissions: permissions,
            hasAnyPermission: false
          },
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to require all of the specified permissions
 */
export const requireAllPermissions = (permissions: Permission[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const user = req.user as IUser;
    
    // Check if user has all required permissions
    const hasAllPermissions = RBACService.hasAllPermissions(user, permissions);
    
    if (!hasAllPermissions) {
      const missingPermissions = permissions.filter(permission => 
        !RBACService.hasPermission(user, permission)
      );

      logger.warn('Insufficient permissions for action (all required)', {
        userId: user.id,
        email: user.email,
        role: user.role,
        requiredPermissions: permissions,
        missingPermissions,
        userPermissions: user.admin_permissions,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.headers['x-request-id']
      });

      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `All of the following permissions required: ${permissions.join(', ')}`,
          details: {
            requiredPermissions: permissions,
            missingPermissions,
            hasAllPermissions: false
          },
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to require specific role (backwards compatibility)
 */
export const requireRole = (role: SystemRole) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const user = req.user as IUser;
    
    if (user.role !== role) {
      logger.warn('Insufficient role for action', {
        userId: user.id,
        email: user.email,
        userRole: user.role,
        requiredRole: role,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.headers['x-request-id']
      });

      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_ROLE',
          message: `Role '${role}' required`,
          details: {
            userRole: user.role,
            requiredRole: role
          },
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to require minimum role level
 */
export const requireMinimumRole = (minimumRole: SystemRole) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const user = req.user as IUser;
    const userRoleLevel = RBACService.getRoleLevel(user.role as SystemRole);
    const requiredRoleLevel = RBACService.getRoleLevel(minimumRole);
    
    if (userRoleLevel < requiredRoleLevel) {
      logger.warn('Insufficient role level for action', {
        userId: user.id,
        email: user.email,
        userRole: user.role,
        userRoleLevel,
        requiredRole: minimumRole,
        requiredRoleLevel,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.headers['x-request-id']
      });

      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_ROLE_LEVEL',
          message: `Minimum role '${minimumRole}' required`,
          details: {
            userRole: user.role,
            userRoleLevel,
            requiredRole: minimumRole,
            requiredRoleLevel
          },
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    next();
  };
};

/**
 * Legacy middleware for backwards compatibility
 */
export const requireAdmin = requireMinimumRole(SystemRoles.ADMIN);
export const requireSuperAdmin = requireRole(SystemRoles.SUPER_ADMIN);

/**
 * Legacy admin permissions constants for backwards compatibility
 * @deprecated Use Permission enum from types/permissions.ts instead
 */
export const AdminPermissions = {
  USER_MANAGEMENT: Permission.USER_VIEW,
  USER_SUSPEND: Permission.USER_SUSPEND,
  USER_DELETE: Permission.USER_DELETE,
  ML_MODEL_TRAINING: Permission.ML_MODEL_TRAIN,
  ML_DATA_REVIEW: Permission.ML_DATA_REVIEW,
  SYSTEM_MONITORING: Permission.SYSTEM_HEALTH_VIEW,
  ANALYTICS_VIEW: Permission.ANALYTICS_VIEW,
  AUDIT_LOG_VIEW: Permission.SECURITY_AUDIT_VIEW
} as const;

export type AdminPermission = typeof AdminPermissions[keyof typeof AdminPermissions];