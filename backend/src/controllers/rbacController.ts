/**
 * RBAC Controller
 * Handles Role-Based Access Control operations
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { RBACService } from '../services/rbacService';
import { 
  Permission, 
  SystemRole, 
  SystemRoles, 
  PermissionMetadataMap,
  DefaultRoleConfigurations,
  PermissionCategory
} from '../types/permissions';
import { IUser } from '../types/database';
import { User } from '../models/User';
import { logger } from '../utils/logger';

// Validation schemas
const updatePermissionsSchema = Joi.object({
  permissions: Joi.array().items(
    Joi.string().valid(...Object.values(Permission))
  ).required(),
  reason: Joi.string().optional()
});

const updateRoleSchema = Joi.object({
  role: Joi.string().valid(...Object.values(SystemRoles)).required(),
  reason: Joi.string().optional()
});

const addPermissionSchema = Joi.object({
  permission: Joi.string().valid(...Object.values(Permission)).required(),
  reason: Joi.string().optional()
});

const removePermissionSchema = Joi.object({
  permission: Joi.string().valid(...Object.values(Permission)).required(),
  reason: Joi.string().optional()
});

/**
 * Get all available permissions with metadata
 */
export const getAvailablePermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user as IUser;
    
    // Group permissions by category
    const permissionsByCategory: Record<PermissionCategory, any[]> = {} as any;
    
    Object.values(PermissionCategory).forEach(category => {
      permissionsByCategory[category] = [];
    });

    Object.values(Permission).forEach(permission => {
      const metadata = PermissionMetadataMap[permission];
      const hasPermission = RBACService.hasPermission(user, permission);
      
      permissionsByCategory[metadata.category].push({
        permission,
        description: metadata.description,
        riskLevel: metadata.riskLevel,
        requiresApproval: metadata.requiresApproval || false,
        dependencies: metadata.dependencies || [],
        userHasPermission: hasPermission,
        canAssign: RBACService.canAssignPermission(user, permission)
      });
    });

    res.status(200).json({
      success: true,
      data: {
        permissionsByCategory,
        totalPermissions: Object.values(Permission).length,
        userPermissionCount: RBACService.getUserPermissions(user).length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all available roles with their permissions
 */
export const getAvailableRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user as IUser;
    const assignableRoles = RBACService.getAssignableRoles(user);
    
    const rolesWithPermissions = Object.values(SystemRoles).map(role => {
      const permissions = DefaultRoleConfigurations[role] || [];
      const roleLevel = RBACService.getRoleLevel(role);
      
      return {
        role,
        name: role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        permissions,
        permissionCount: permissions.length,
        level: roleLevel,
        canAssign: assignableRoles.includes(role),
        isSystemRole: true
      };
    });

    // Sort by role level
    rolesWithPermissions.sort((a, b) => a.level - b.level);

    res.status(200).json({
      success: true,
      data: {
        roles: rolesWithPermissions,
        userRole: user.role,
        userRoleLevel: RBACService.getRoleLevel(user.role as SystemRole),
        assignableRoles
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user permissions with detailed information
 */
export const getUserPermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const actor = req.user as IUser;

    if (!userId) {
      res.status(400).json({
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const targetUser = await User.findByIdWithPermissions(userId);
    if (!targetUser) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Check if actor can view this user's permissions
    if (!RBACService.canManageUser(actor, targetUser) && actor.id !== userId) {
      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Cannot view permissions for this user',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const userPermissions = RBACService.getUserPermissions(targetUser);
    const permissionsByCategory = RBACService.getUserPermissionsByCategory(targetUser);
    const auditResult = RBACService.auditUserPermissions(targetUser);
    
    // Get role-based vs direct permissions
    const rolePermissions = DefaultRoleConfigurations[targetUser.role as SystemRole] || [];
    const directPermissions = Array.isArray(targetUser.admin_permissions) ? targetUser.admin_permissions : [];
    
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: targetUser.id,
          email: targetUser.email,
          role: targetUser.role,
          roleLevel: RBACService.getRoleLevel(targetUser.role as SystemRole)
        },
        permissions: {
          all: userPermissions,
          byCategory: permissionsByCategory,
          fromRole: rolePermissions,
          direct: directPermissions,
          total: userPermissions.length
        },
        audit: auditResult,
        canManage: RBACService.canManageUser(actor, targetUser)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user permissions (replace all direct permissions)
 */
export const updateUserPermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { error, value } = updatePermissionsSchema.validate(req.body);
    const actor = req.user as IUser;

    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    if (!userId) {
      res.status(400).json({
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const targetUser = await User.findByIdWithPermissions(userId);
    if (!targetUser) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Check if actor can manage this user
    if (!RBACService.canManageUser(actor, targetUser)) {
      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Cannot manage permissions for this user',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { permissions, reason } = value;

    // Validate that actor can assign all requested permissions
    const cannotAssign = permissions.filter((permission: Permission) => 
      !RBACService.canAssignPermission(actor, permission)
    );

    if (cannotAssign.length > 0) {
      res.status(403).json({
        error: {
          code: 'CANNOT_ASSIGN_PERMISSIONS',
          message: 'Cannot assign some of the requested permissions',
          details: {
            cannotAssign
          },
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate permission dependencies
    const dependencyCheck = RBACService.validatePermissionDependencies(permissions);
    if (!dependencyCheck.valid) {
      res.status(400).json({
        error: {
          code: 'MISSING_DEPENDENCIES',
          message: 'Some permissions are missing their dependencies',
          details: {
            missingDependencies: dependencyCheck.missingDependencies
          },
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Update permissions
    const success = await User.updateById<IUser>(userId, {
      admin_permissions: permissions
    });

    if (!success) {
      res.status(500).json({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update user permissions',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Log the change
    logger.info('User permissions updated', {
      actorId: actor.id,
      actorEmail: actor.email,
      targetUserId: userId,
      targetUserEmail: targetUser.email,
      oldPermissions: targetUser.admin_permissions,
      newPermissions: permissions,
      reason,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'User permissions updated successfully',
      data: {
        userId,
        permissions,
        permissionCount: permissions.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add a single permission to user
 */
export const addUserPermission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { error, value } = addPermissionSchema.validate(req.body);
    const actor = req.user as IUser;

    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { permission, reason } = value;

    const success = await RBACService.addPermissionToUser(actor.id, userId, permission, reason);

    if (!success) {
      res.status(400).json({
        error: {
          code: 'PERMISSION_ADD_FAILED',
          message: 'Failed to add permission to user',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Permission added successfully',
      data: {
        userId,
        permission,
        reason
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove a single permission from user
 */
export const removeUserPermission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { error, value } = removePermissionSchema.validate(req.body);
    const actor = req.user as IUser;

    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { permission, reason } = value;

    const success = await RBACService.removePermissionFromUser(actor.id, userId, permission, reason);

    if (!success) {
      res.status(400).json({
        error: {
          code: 'PERMISSION_REMOVE_FAILED',
          message: 'Failed to remove permission from user',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Permission removed successfully',
      data: {
        userId,
        permission,
        reason
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user role
 */
export const updateUserRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { error, value } = updateRoleSchema.validate(req.body);
    const actor = req.user as IUser;

    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { role, reason } = value;

    const success = await RBACService.updateUserRole(actor.id, userId, role, reason);

    if (!success) {
      res.status(400).json({
        error: {
          code: 'ROLE_UPDATE_FAILED',
          message: 'Failed to update user role',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: {
        userId,
        role,
        reason
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Audit user permissions
 */
export const auditUserPermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const actor = req.user as IUser;

    if (!userId) {
      res.status(400).json({
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const targetUser = await User.findByIdWithPermissions(userId);
    if (!targetUser) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const auditResult = RBACService.auditUserPermissions(targetUser);
    const userPermissions = RBACService.getUserPermissions(targetUser);
    
    // Get detailed information about excessive permissions
    const excessivePermissionDetails = auditResult.excessivePermissions.map(permission => ({
      permission,
      metadata: PermissionMetadataMap[permission],
      canActorRevoke: RBACService.canManageUser(actor, targetUser)
    }));

    // Get suggestions for role-appropriate permissions
    const roleSuggestions = RBACService.getPermissionSuggestions(targetUser.role as SystemRole);
    const missingSuggestions = roleSuggestions.filter(permission => 
      !userPermissions.includes(permission)
    );

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: targetUser.id,
          email: targetUser.email,
          role: targetUser.role,
          roleLevel: RBACService.getRoleLevel(targetUser.role as SystemRole)
        },
        audit: {
          ...auditResult,
          excessivePermissionDetails,
          missingSuggestions,
          totalPermissions: userPermissions.length,
          rolePermissions: roleSuggestions.length
        },
        recommendations: {
          removeExcessive: auditResult.excessivePermissions.length > 0,
          addMissing: missingSuggestions.length > 0,
          reviewHighRisk: auditResult.riskScore > 20
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's permissions (for self-service)
 */
export const getMyPermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user as IUser;
    
    const userPermissions = RBACService.getUserPermissions(user);
    const permissionsByCategory = RBACService.getUserPermissionsByCategory(user);
    const rolePermissions = DefaultRoleConfigurations[user.role as SystemRole] || [];
    
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          roleLevel: RBACService.getRoleLevel(user.role as SystemRole)
        },
        permissions: {
          all: userPermissions,
          byCategory: permissionsByCategory,
          fromRole: rolePermissions,
          direct: Array.isArray(user.admin_permissions) ? user.admin_permissions : [],
          total: userPermissions.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
};