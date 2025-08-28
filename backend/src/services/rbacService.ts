/**
 * Role-Based Access Control (RBAC) Service
 * Manages permissions, roles, and access control throughout the application
 */

import { 
  Permission, 
  SystemRole, 
  SystemRoles, 
  DefaultRoleConfigurations,
  PermissionMetadataMap,
  PermissionCheck,
  Role,
  PermissionCategory
} from '../types/permissions';
import { IUser } from '../types/database';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export class RBACService {
  /**
   * Check if a user has a specific permission
   */
  static hasPermission(user: IUser, permission: Permission): boolean {
    // Super admins have all permissions
    if (user.role === SystemRoles.SUPER_ADMIN) {
      return true;
    }

    // Check if user has the permission directly
    const adminPermissions = Array.isArray(user.admin_permissions) ? user.admin_permissions : [];
    if (adminPermissions.includes(permission)) {
      return true;
    }

    // Check if user's role includes the permission
    const rolePermissions = DefaultRoleConfigurations[user.role as SystemRole];
    if (rolePermissions && rolePermissions.includes(permission)) {
      return true;
    }

    return false;
  }

  /**
   * Check if a user has any of the specified permissions
   */
  static hasAnyPermission(user: IUser, permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(user, permission));
  }

  /**
   * Check if a user has all of the specified permissions
   */
  static hasAllPermissions(user: IUser, permissions: Permission[]): boolean {
    return permissions.every(permission => this.hasPermission(user, permission));
  }

  /**
   * Get detailed permission check result with reasoning
   */
  static checkPermission(user: IUser, permission: Permission): PermissionCheck {
    const hasPermission = this.hasPermission(user, permission);
    
    if (hasPermission) {
      return { hasPermission: true };
    }

    const metadata = PermissionMetadataMap[permission];
    const missingPermissions = [permission];
    
    // Check for missing dependencies
    if (metadata.dependencies) {
      const missingDeps = metadata.dependencies.filter(dep => !this.hasPermission(user, dep));
      missingPermissions.push(...missingDeps);
    }

    return {
      hasPermission: false,
      reason: `Missing required permission: ${permission}`,
      missingPermissions: Array.from(new Set(missingPermissions))
    };
  }

  /**
   * Get all permissions for a user (from role + direct permissions)
   */
  static getUserPermissions(user: IUser): Permission[] {
    const permissions = new Set<Permission>();

    // Super admins get all permissions
    if (user.role === SystemRoles.SUPER_ADMIN) {
      return Object.values(Permission);
    }

    // Add role-based permissions
    const rolePermissions = DefaultRoleConfigurations[user.role as SystemRole];
    if (rolePermissions) {
      rolePermissions.forEach(permission => permissions.add(permission));
    }

    // Add direct permissions
    const adminPermissions = Array.isArray(user.admin_permissions) ? user.admin_permissions : [];
    adminPermissions.forEach(permission => {
      if (Object.values(Permission).includes(permission as Permission)) {
        permissions.add(permission as Permission);
      }
    });

    return Array.from(permissions);
  }

  /**
   * Get permissions grouped by category for a user
   */
  static getUserPermissionsByCategory(user: IUser): Record<PermissionCategory, Permission[]> {
    const userPermissions = this.getUserPermissions(user);
    const categorized: Record<PermissionCategory, Permission[]> = {} as any;

    // Initialize categories
    Object.values(PermissionCategory).forEach(category => {
      categorized[category] = [];
    });

    // Group permissions by category
    userPermissions.forEach(permission => {
      const metadata = PermissionMetadataMap[permission];
      if (metadata) {
        categorized[metadata.category].push(permission);
      }
    });

    return categorized;
  }

  /**
   * Check if a user can perform an action on another user (hierarchy check)
   */
  static canManageUser(actor: IUser, target: IUser): boolean {
    // Super admins can manage anyone except other super admins
    if (actor.role === SystemRoles.SUPER_ADMIN) {
      return true;
    }

    // Admins can manage users and other admins (but not super admins)
    if (actor.role === SystemRoles.ADMIN) {
      return target.role !== SystemRoles.SUPER_ADMIN;
    }

    // User managers can only manage regular users
    if (actor.role === SystemRoles.USER_MANAGER) {
      return target.role === SystemRoles.USER;
    }

    // Regular users cannot manage other users
    return false;
  }

  /**
   * Validate if a role assignment is allowed
   */
  static canAssignRole(actor: IUser, targetRole: SystemRole): boolean {
    // Super admins can assign any role
    if (actor.role === SystemRoles.SUPER_ADMIN) {
      return true;
    }

    // Admins can assign roles below super admin
    if (actor.role === SystemRoles.ADMIN) {
      return targetRole !== SystemRoles.SUPER_ADMIN;
    }

    // User managers can only assign user role
    if (actor.role === SystemRoles.USER_MANAGER) {
      return targetRole === SystemRoles.USER;
    }

    return false;
  }

  /**
   * Validate if permission assignment is allowed
   */
  static canAssignPermission(actor: IUser, permission: Permission): boolean {
    // Must have the permission to assign it
    if (!this.hasPermission(actor, permission)) {
      return false;
    }

    // Check if permission requires approval and actor can approve
    const metadata = PermissionMetadataMap[permission];
    if (metadata.requiresApproval) {
      // Only super admins can assign permissions that require approval
      return actor.role === SystemRoles.SUPER_ADMIN;
    }

    return true;
  }

  /**
   * Add permission to user
   */
  static async addPermissionToUser(
    actorId: string, 
    userId: string, 
    permission: Permission,
    reason?: string
  ): Promise<boolean> {
    try {
      const actor = await User.findByIdWithPermissions(actorId);
      const user = await User.findByIdWithPermissions(userId);

      if (!actor || !user) {
        return false;
      }

      // Check if actor can assign this permission
      if (!this.canAssignPermission(actor, permission)) {
        logger.warn('Unauthorized permission assignment attempt', {
          actorId,
          userId,
          permission,
          actorRole: actor.role,
          reason: 'Insufficient privileges'
        });
        return false;
      }

      // Add permission if not already present
      const currentPermissions = Array.isArray(user.admin_permissions) ? user.admin_permissions : [];
      if (!currentPermissions.includes(permission)) {
        const updatedPermissions = [...currentPermissions, permission];
        
        const success = await User.updateById<IUser>(userId, {
          admin_permissions: JSON.stringify(updatedPermissions)
        });

        if (success) {
          logger.info('Permission added to user', {
            actorId,
            userId,
            permission,
            reason,
            timestamp: new Date().toISOString()
          });
        }

        return success !== null;
      }

      return true; // Permission already exists
    } catch (error) {
      logger.error('Error adding permission to user', {
        error: error instanceof Error ? error.message : String(error),
        actorId,
        userId,
        permission
      });
      return false;
    }
  }

  /**
   * Remove permission from user
   */
  static async removePermissionFromUser(
    actorId: string, 
    userId: string, 
    permission: Permission,
    reason?: string
  ): Promise<boolean> {
    try {
      const actor = await User.findByIdWithPermissions(actorId);
      const user = await User.findByIdWithPermissions(userId);

      if (!actor || !user) {
        return false;
      }

      // Check if actor can manage this user
      if (!this.canManageUser(actor, user)) {
        logger.warn('Unauthorized permission removal attempt', {
          actorId,
          userId,
          permission,
          actorRole: actor.role,
          targetRole: user.role,
          reason: 'Cannot manage target user'
        });
        return false;
      }

      // Remove permission if present
      const currentPermissions = Array.isArray(user.admin_permissions) ? user.admin_permissions : [];
      const updatedPermissions = currentPermissions.filter(p => p !== permission);
      
      const success = await User.updateById<IUser>(userId, {
        admin_permissions: JSON.stringify(updatedPermissions)
      });

      if (success) {
        logger.info('Permission removed from user', {
          actorId,
          userId,
          permission,
          reason,
          timestamp: new Date().toISOString()
        });
      }

      return success !== null;
    } catch (error) {
      logger.error('Error removing permission from user', {
        error: error instanceof Error ? error.message : String(error),
        actorId,
        userId,
        permission
      });
      return false;
    }
  }

  /**
   * Update user role with permission validation
   */
  static async updateUserRole(
    actorId: string,
    userId: string,
    newRole: SystemRole,
    reason?: string
  ): Promise<boolean> {
    try {
      const actor = await User.findByIdWithPermissions(actorId);
      const user = await User.findByIdWithPermissions(userId);

      if (!actor || !user) {
        return false;
      }

      // Check if actor can assign this role
      if (!this.canAssignRole(actor, newRole)) {
        logger.warn('Unauthorized role assignment attempt', {
          actorId,
          userId,
          newRole,
          actorRole: actor.role,
          reason: 'Cannot assign this role'
        });
        return false;
      }

      // Check if actor can manage target user
      if (!this.canManageUser(actor, user)) {
        logger.warn('Unauthorized role change attempt', {
          actorId,
          userId,
          newRole,
          actorRole: actor.role,
          targetRole: user.role,
          reason: 'Cannot manage target user'
        });
        return false;
      }

      const oldRole = user.role;
      const success = await User.updateById<IUser>(userId, {
        role: newRole
      });

      if (success) {
        logger.info('User role updated', {
          actorId,
          userId,
          oldRole,
          newRole,
          reason,
          timestamp: new Date().toISOString()
        });
      }

      return success !== null;
    } catch (error) {
      logger.error('Error updating user role', {
        error: error instanceof Error ? error.message : String(error),
        actorId,
        userId,
        newRole
      });
      return false;
    }
  }

  /**
   * Get role hierarchy level (higher number = more privileges)
   */
  static getRoleLevel(role: SystemRole): number {
    const roleLevels: Record<SystemRole, number> = {
      [SystemRoles.USER]: 0,
      [SystemRoles.SUPPORT_AGENT]: 1,
      [SystemRoles.CONTENT_MANAGER]: 2,
      [SystemRoles.ANALYST]: 2,
      [SystemRoles.ML_ENGINEER]: 3,
      [SystemRoles.BILLING_MANAGER]: 3,
      [SystemRoles.SECURITY_OFFICER]: 4,
      [SystemRoles.USER_MANAGER]: 4,
      [SystemRoles.ADMIN]: 5,
      [SystemRoles.SUPER_ADMIN]: 6
    };

    return roleLevels[role] || 0;
  }

  /**
   * Check if one role is higher than another in hierarchy
   */
  static isHigherRole(role1: SystemRole, role2: SystemRole): boolean {
    return this.getRoleLevel(role1) > this.getRoleLevel(role2);
  }

  /**
   * Get available roles that a user can assign
   */
  static getAssignableRoles(actor: IUser): SystemRole[] {
    const actorLevel = this.getRoleLevel(actor.role as SystemRole);
    
    return Object.values(SystemRoles).filter(role => {
      const roleLevel = this.getRoleLevel(role);
      
      // Super admins can assign any role
      if (actor.role === SystemRoles.SUPER_ADMIN) {
        return true;
      }
      
      // Others can only assign roles below their level
      return roleLevel < actorLevel;
    });
  }

  /**
   * Validate permission dependencies
   */
  static validatePermissionDependencies(permissions: Permission[]): {
    valid: boolean;
    missingDependencies: Permission[];
  } {
    const missingDependencies: Permission[] = [];
    const permissionSet = new Set(permissions);

    permissions.forEach(permission => {
      const metadata = PermissionMetadataMap[permission];
      if (metadata.dependencies) {
        metadata.dependencies.forEach(dependency => {
          if (!permissionSet.has(dependency)) {
            missingDependencies.push(dependency);
          }
        });
      }
    });

    return {
      valid: missingDependencies.length === 0,
      missingDependencies: Array.from(new Set(missingDependencies))
    };
  }

  /**
   * Get permission suggestions based on role
   */
  static getPermissionSuggestions(role: SystemRole): Permission[] {
    return DefaultRoleConfigurations[role] || [];
  }

  /**
   * Audit user permissions and identify potential issues
   */
  static auditUserPermissions(user: IUser): {
    excessivePermissions: Permission[];
    missingDependencies: Permission[];
    riskScore: number;
  } {
    const userPermissions = this.getUserPermissions(user);
    const rolePermissions = DefaultRoleConfigurations[user.role as SystemRole] || [];
    
    // Find permissions not in default role
    const excessivePermissions = userPermissions.filter(
      permission => !rolePermissions.includes(permission)
    );

    // Check dependencies
    const { missingDependencies } = this.validatePermissionDependencies(userPermissions);

    // Calculate risk score based on high-risk permissions
    let riskScore = 0;
    userPermissions.forEach(permission => {
      const metadata = PermissionMetadataMap[permission];
      switch (metadata.riskLevel) {
        case 'critical':
          riskScore += 4;
          break;
        case 'high':
          riskScore += 3;
          break;
        case 'medium':
          riskScore += 2;
          break;
        case 'low':
          riskScore += 1;
          break;
      }
    });

    return {
      excessivePermissions,
      missingDependencies,
      riskScore
    };
  }

  /**
   * Initialize default roles for a new user
   */
  static async initializeUserRole(userId: string, role: SystemRole = SystemRoles.USER): Promise<boolean> {
    try {
      const defaultPermissions = DefaultRoleConfigurations[role] || [];
      
      const success = await User.updateById<IUser>(userId, {
        role,
        admin_permissions: defaultPermissions
      });

      if (success) {
        logger.info('User role initialized', {
          userId,
          role,
          permissionCount: defaultPermissions.length,
          timestamp: new Date().toISOString()
        });
      }

      return success !== null;
    } catch (error) {
      logger.error('Error initializing user role', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        role
      });
      return false;
    }
  }
}