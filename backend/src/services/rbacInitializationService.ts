/**
 * RBAC Initialization Service
 * Handles initialization and setup of the RBAC system
 */

import { BaseModel } from '../models/BaseModel';
import { 
  SystemRoles, 
  DefaultRoleConfigurations, 
  Permission,
  SystemRole
} from '../types/permissions';
import { IUser } from '../types/database';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export class RBACInitializationService {
  /**
   * Initialize the RBAC system with default roles and permissions
   */
  static async initializeRBAC(): Promise<void> {
    try {
      logger.info('Initializing RBAC system...');

      // Update system roles with their default permissions
      await this.updateSystemRolePermissions();

      // Migrate existing users to new RBAC structure
      await this.migrateExistingUsers();

      // Create audit log entry for initialization
      await this.logRBACInitialization();

      logger.info('RBAC system initialization completed successfully');
    } catch (error) {
      logger.error('Failed to initialize RBAC system', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Update system roles with their default permissions
   */
  private static async updateSystemRolePermissions(): Promise<void> {
    const knex = BaseModel.getKnex();

    for (const [roleSlug, permissions] of Object.entries(DefaultRoleConfigurations)) {
      try {
        const permissionStrings = permissions.map(p => p.toString());
        
        await knex('roles')
          .where('slug', roleSlug)
          .update({
            permissions: JSON.stringify(permissionStrings),
            updated_at: knex.fn.now()
          });

        logger.debug(`Updated role ${roleSlug} with ${permissions.length} permissions`);
      } catch (error) {
        logger.error(`Failed to update role ${roleSlug}`, {
          error: error instanceof Error ? error.message : String(error),
          roleSlug,
          permissionCount: permissions.length
        });
      }
    }
  }

  /**
   * Migrate existing users to the new RBAC structure
   */
  private static async migrateExistingUsers(): Promise<void> {
    const knex = BaseModel.getKnex();

    try {
      // Get all users
      const users = await knex('users').select('id', 'role', 'admin_permissions');

      for (const user of users) {
        await this.migrateUserPermissions(user);
      }

      logger.info(`Migrated ${users.length} users to new RBAC structure`);
    } catch (error) {
      logger.error('Failed to migrate existing users', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Migrate a single user's permissions
   */
  private static async migrateUserPermissions(user: any): Promise<void> {
    const knex = BaseModel.getKnex();

    try {
      const userRole = user.role as SystemRole;
      const existingPermissions = user.admin_permissions || [];
      
      // Get default permissions for the user's role
      const defaultRolePermissions = DefaultRoleConfigurations[userRole] || [];
      
      // Combine existing permissions with role defaults, removing duplicates
      const allPermissions = Array.from(new Set([
        ...defaultRolePermissions.map(p => p.toString()),
        ...existingPermissions
      ]));

      // Filter out any invalid permissions
      const validPermissions = allPermissions.filter(permission => 
        Object.values(Permission).includes(permission as Permission)
      );

      // Update user with migrated permissions
      await knex('users')
        .where('id', user.id)
        .update({
          admin_permissions: JSON.stringify(validPermissions),
          direct_permissions: JSON.stringify(existingPermissions),
          role_last_updated: knex.fn.now(),
          updated_at: knex.fn.now()
        });

      logger.debug(`Migrated user ${user.id}`, {
        role: userRole,
        oldPermissionCount: existingPermissions.length,
        newPermissionCount: validPermissions.length,
        directPermissionCount: existingPermissions.length
      });
    } catch (error) {
      logger.error(`Failed to migrate user ${user.id}`, {
        error: error instanceof Error ? error.message : String(error),
        userId: user.id,
        userRole: user.role
      });
    }
  }

  /**
   * Create initial super admin user if none exists
   */
  static async createInitialSuperAdmin(
    email: string, 
    password: string, 
    firstName?: string, 
    lastName?: string
  ): Promise<IUser | null> {
    try {
      // Check if any super admin exists
      const existingSuperAdmin = await User.findOneBy<IUser>({ role: SystemRoles.SUPER_ADMIN });
      
      if (existingSuperAdmin) {
        logger.info('Super admin already exists, skipping creation');
        return existingSuperAdmin;
      }

      // Create the super admin user
      const superAdmin = await User.createUser({
        email,
        password,
        first_name: firstName,
        last_name: lastName
      });

      // Update to super admin role
      await User.updateById<IUser>(superAdmin.id, {
        role: SystemRoles.SUPER_ADMIN,
        email_verified: true,
        admin_permissions: DefaultRoleConfigurations[SystemRoles.SUPER_ADMIN].map(p => p.toString()),
        role_last_updated: new Date()
      });

      logger.info('Initial super admin created', {
        userId: superAdmin.id,
        email: superAdmin.email
      });

      return superAdmin;
    } catch (error) {
      logger.error('Failed to create initial super admin', {
        error: error instanceof Error ? error.message : String(error),
        email
      });
      return null;
    }
  }

  /**
   * Validate RBAC system integrity
   */
  static async validateRBACIntegrity(): Promise<{
    valid: boolean;
    issues: string[];
    stats: {
      totalUsers: number;
      totalRoles: number;
      usersWithInvalidRoles: number;
      usersWithInvalidPermissions: number;
    };
  }> {
    const knex = BaseModel.getKnex();
    const issues: string[] = [];

    try {
      // Get system statistics
      const [userCount, roleCount] = await Promise.all([
        knex('users').count('id as count').first(),
        knex('roles').count('id as count').first()
      ]);

      const totalUsers = parseInt(userCount?.count as string) || 0;
      const totalRoles = parseInt(roleCount?.count as string) || 0;

      // Check for users with invalid roles
      const usersWithInvalidRoles = await knex('users')
        .whereNotIn('role', Object.values(SystemRoles))
        .count('id as count')
        .first();

      const invalidRoleCount = parseInt(usersWithInvalidRoles?.count as string) || 0;
      if (invalidRoleCount > 0) {
        issues.push(`${invalidRoleCount} users have invalid roles`);
      }

      // Check for users with invalid permissions
      const users = await knex('users').select('id', 'admin_permissions');
      let usersWithInvalidPermissions = 0;

      for (const user of users) {
        const permissions = user.admin_permissions || [];
        const invalidPermissions = permissions.filter((permission: string) => 
          !Object.values(Permission).includes(permission as Permission)
        );

        if (invalidPermissions.length > 0) {
          usersWithInvalidPermissions++;
        }
      }

      if (usersWithInvalidPermissions > 0) {
        issues.push(`${usersWithInvalidPermissions} users have invalid permissions`);
      }

      // Check for missing system roles
      const existingRoles = await knex('roles')
        .where('is_system_role', true)
        .pluck('slug');

      const missingRoles = Object.values(SystemRoles).filter(role => 
        !existingRoles.includes(role)
      );

      if (missingRoles.length > 0) {
        issues.push(`Missing system roles: ${missingRoles.join(', ')}`);
      }

      return {
        valid: issues.length === 0,
        issues,
        stats: {
          totalUsers,
          totalRoles,
          usersWithInvalidRoles: invalidRoleCount,
          usersWithInvalidPermissions
        }
      };
    } catch (error) {
      logger.error('Failed to validate RBAC integrity', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        valid: false,
        issues: ['Failed to perform validation check'],
        stats: {
          totalUsers: 0,
          totalRoles: 0,
          usersWithInvalidRoles: 0,
          usersWithInvalidPermissions: 0
        }
      };
    }
  }

  /**
   * Repair RBAC system issues
   */
  static async repairRBACIssues(): Promise<{
    success: boolean;
    repaired: string[];
    errors: string[];
  }> {
    const knex = BaseModel.getKnex();
    const repaired: string[] = [];
    const errors: string[] = [];

    try {
      // Fix users with invalid roles
      const usersWithInvalidRoles = await knex('users')
        .whereNotIn('role', Object.values(SystemRoles))
        .select('id', 'role');

      for (const user of usersWithInvalidRoles) {
        try {
          await knex('users')
            .where('id', user.id)
            .update({
              role: SystemRoles.USER,
              admin_permissions: JSON.stringify([]),
              role_last_updated: knex.fn.now()
            });

          repaired.push(`Fixed invalid role for user ${user.id}: ${user.role} -> ${SystemRoles.USER}`);
        } catch (error) {
          errors.push(`Failed to fix role for user ${user.id}: ${error}`);
        }
      }

      // Fix users with invalid permissions
      const users = await knex('users').select('id', 'admin_permissions');

      for (const user of users) {
        const permissions = user.admin_permissions || [];
        const validPermissions = permissions.filter((permission: string) => 
          Object.values(Permission).includes(permission as Permission)
        );

        if (validPermissions.length !== permissions.length) {
          try {
            await knex('users')
              .where('id', user.id)
              .update({
                admin_permissions: JSON.stringify(validPermissions),
                updated_at: knex.fn.now()
              });

            repaired.push(`Cleaned invalid permissions for user ${user.id}`);
          } catch (error) {
            errors.push(`Failed to clean permissions for user ${user.id}: ${error}`);
          }
        }
      }

      // Ensure all system roles exist
      const existingRoles = await knex('roles')
        .where('is_system_role', true)
        .pluck('slug');

      const missingRoles = Object.values(SystemRoles).filter(role => 
        !existingRoles.includes(role)
      );

      for (const roleSlug of missingRoles) {
        try {
          await knex('roles').insert({
            id: knex.raw('gen_random_uuid()'),
            name: roleSlug.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            slug: roleSlug,
            description: `System role: ${roleSlug}`,
            permissions: JSON.stringify(DefaultRoleConfigurations[roleSlug]?.map(p => p.toString()) || []),
            is_system_role: true,
            level: this.getRoleLevel(roleSlug),
            created_at: knex.fn.now(),
            updated_at: knex.fn.now()
          });

          repaired.push(`Created missing system role: ${roleSlug}`);
        } catch (error) {
          errors.push(`Failed to create system role ${roleSlug}: ${error}`);
        }
      }

      return {
        success: errors.length === 0,
        repaired,
        errors
      };
    } catch (error) {
      logger.error('Failed to repair RBAC issues', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        repaired,
        errors: [`System error: ${error}`]
      };
    }
  }

  /**
   * Log RBAC initialization
   */
  private static async logRBACInitialization(): Promise<void> {
    const knex = BaseModel.getKnex();

    try {
      await knex('permission_audit_log').insert({
        id: knex.raw('gen_random_uuid()'),
        actor_user_id: knex.raw('gen_random_uuid()'), // System user
        target_user_id: knex.raw('gen_random_uuid()'), // System user
        action: 'rbac_initialization',
        permission_or_role: 'system',
        old_value: JSON.stringify({}),
        new_value: JSON.stringify({ initialized: true }),
        reason: 'RBAC system initialization',
        metadata: JSON.stringify({
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }),
        created_at: knex.fn.now()
      });
    } catch (error) {
      logger.warn('Failed to log RBAC initialization', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get role level for hierarchy
   */
  private static getRoleLevel(role: string): number {
    const roleLevels: Record<string, number> = {
      [SystemRoles.USER]: 0,
      [SystemRoles.SUPPORT_AGENT]: 30,
      [SystemRoles.CONTENT_MANAGER]: 50,
      [SystemRoles.ANALYST]: 40,
      [SystemRoles.ML_ENGINEER]: 50,
      [SystemRoles.BILLING_MANAGER]: 50,
      [SystemRoles.SECURITY_OFFICER]: 70,
      [SystemRoles.USER_MANAGER]: 60,
      [SystemRoles.ADMIN]: 80,
      [SystemRoles.SUPER_ADMIN]: 100
    };

    return roleLevels[role] || 0;
  }
}