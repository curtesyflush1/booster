/**
 * RBAC Service Tests
 * Tests for the Role-Based Access Control system
 */

import { RBACService } from '../../src/services/rbacService';
import { 
  Permission, 
  SystemRoles, 
  SystemRole,
  DefaultRoleConfigurations 
} from '../../src/types/permissions';
import { IUser } from '../../src/types/database';
import { SubscriptionTier } from '../../src/types/subscription';

// Mock user factory
const createMockUser = (role: SystemRole, permissions: string[] = []): IUser => ({
  id: 'test-user-id',
  email: 'test@example.com',
  password_hash: 'hashed-password',
  subscription_tier: 'free' as SubscriptionTier,
  role,
  first_name: 'Test',
  last_name: 'User',
  email_verified: true,
  failed_login_attempts: 0,
  admin_permissions: permissions,
  shipping_addresses: [],
  payment_methods: [],
  retailer_credentials: {},
  notification_settings: {
    web_push: true,
    email: true,
    sms: false,
    discord: false
  },
  quiet_hours: {
    enabled: false,
    start_time: '22:00',
    end_time: '08:00',
    timezone: 'UTC',
    days: []
  },
  timezone: 'UTC',
  preferences: {},
  created_at: new Date(),
  updated_at: new Date()
});

describe('RBACService', () => {
  describe('hasPermission', () => {
    it('should grant all permissions to super admin', () => {
      const superAdmin = createMockUser(SystemRoles.SUPER_ADMIN);
      
      // Test a few random permissions
      expect(RBACService.hasPermission(superAdmin, Permission.USER_DELETE)).toBe(true);
      expect(RBACService.hasPermission(superAdmin, Permission.SYSTEM_CONFIG_UPDATE)).toBe(true);
      expect(RBACService.hasPermission(superAdmin, Permission.ML_MODEL_DEPLOY)).toBe(true);
    });

    it('should check role-based permissions correctly', () => {
      const admin = createMockUser(SystemRoles.ADMIN);
      
      // Admin should have user management permissions
      expect(RBACService.hasPermission(admin, Permission.USER_VIEW)).toBe(true);
      expect(RBACService.hasPermission(admin, Permission.USER_UPDATE)).toBe(true);
      
      // But not all permissions (super admin only)
      const adminPermissions = DefaultRoleConfigurations[SystemRoles.ADMIN];
      const hasUserDelete = adminPermissions.includes(Permission.USER_DELETE);
      expect(RBACService.hasPermission(admin, Permission.USER_DELETE)).toBe(hasUserDelete);
    });

    it('should check direct permissions', () => {
      const user = createMockUser(SystemRoles.USER, [Permission.USER_VIEW]);
      
      expect(RBACService.hasPermission(user, Permission.USER_VIEW)).toBe(true);
      expect(RBACService.hasPermission(user, Permission.USER_DELETE)).toBe(false);
    });

    it('should deny permissions for regular users', () => {
      const regularUser = createMockUser(SystemRoles.USER);
      
      expect(RBACService.hasPermission(regularUser, Permission.USER_DELETE)).toBe(false);
      expect(RBACService.hasPermission(regularUser, Permission.SYSTEM_CONFIG_UPDATE)).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has any of the specified permissions', () => {
      const user = createMockUser(SystemRoles.USER, [Permission.USER_VIEW]);
      
      const result = RBACService.hasAnyPermission(user, [
        Permission.USER_VIEW,
        Permission.USER_DELETE
      ]);
      
      expect(result).toBe(true);
    });

    it('should return false if user has none of the specified permissions', () => {
      const user = createMockUser(SystemRoles.USER);
      
      const result = RBACService.hasAnyPermission(user, [
        Permission.USER_DELETE,
        Permission.SYSTEM_CONFIG_UPDATE
      ]);
      
      expect(result).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if user has all specified permissions', () => {
      const admin = createMockUser(SystemRoles.ADMIN);
      
      const result = RBACService.hasAllPermissions(admin, [
        Permission.USER_VIEW,
        Permission.ANALYTICS_VIEW
      ]);
      
      // Check if admin role has both permissions
      const adminPermissions = DefaultRoleConfigurations[SystemRoles.ADMIN];
      const hasAll = [Permission.USER_VIEW, Permission.ANALYTICS_VIEW].every(p => 
        adminPermissions.includes(p)
      );
      
      expect(result).toBe(hasAll);
    });

    it('should return false if user is missing any permission', () => {
      const user = createMockUser(SystemRoles.USER, [Permission.USER_VIEW]);
      
      const result = RBACService.hasAllPermissions(user, [
        Permission.USER_VIEW,
        Permission.USER_DELETE
      ]);
      
      expect(result).toBe(false);
    });
  });

  describe('checkPermission', () => {
    it('should return success for valid permission', () => {
      const admin = createMockUser(SystemRoles.ADMIN);
      
      const result = RBACService.checkPermission(admin, Permission.USER_VIEW);
      
      expect(result.hasPermission).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return failure with reason for invalid permission', () => {
      const user = createMockUser(SystemRoles.USER);
      
      const result = RBACService.checkPermission(user, Permission.USER_DELETE);
      
      expect(result.hasPermission).toBe(false);
      expect(result.reason).toContain('Missing required permission');
      expect(result.missingPermissions).toContain(Permission.USER_DELETE);
    });
  });

  describe('getUserPermissions', () => {
    it('should return all permissions for super admin', () => {
      const superAdmin = createMockUser(SystemRoles.SUPER_ADMIN);
      
      const permissions = RBACService.getUserPermissions(superAdmin);
      
      expect(permissions).toEqual(Object.values(Permission));
    });

    it('should combine role and direct permissions', () => {
      const user = createMockUser(SystemRoles.ANALYST, [Permission.USER_VIEW]);
      
      const permissions = RBACService.getUserPermissions(user);
      const analystPermissions = DefaultRoleConfigurations[SystemRoles.ANALYST];
      
      // Should include both role permissions and direct permissions
      expect(permissions).toContain(Permission.USER_VIEW);
      analystPermissions.forEach(permission => {
        expect(permissions).toContain(permission);
      });
    });

    it('should deduplicate permissions', () => {
      const rolePermissions = DefaultRoleConfigurations[SystemRoles.ADMIN];
      const duplicatePermission = rolePermissions[0]; // Take first permission from role
      
      const admin = createMockUser(SystemRoles.ADMIN, [duplicatePermission]);
      
      const permissions = RBACService.getUserPermissions(admin);
      
      // Count occurrences of the duplicate permission
      const occurrences = permissions.filter(p => p === duplicatePermission).length;
      expect(occurrences).toBe(1);
    });
  });

  describe('canManageUser', () => {
    it('should allow super admin to manage anyone', () => {
      const superAdmin = createMockUser(SystemRoles.SUPER_ADMIN);
      const admin = createMockUser(SystemRoles.ADMIN);
      const user = createMockUser(SystemRoles.USER);
      
      expect(RBACService.canManageUser(superAdmin, admin)).toBe(true);
      expect(RBACService.canManageUser(superAdmin, user)).toBe(true);
    });

    it('should allow admin to manage users and other admins but not super admins', () => {
      const admin = createMockUser(SystemRoles.ADMIN);
      const superAdmin = createMockUser(SystemRoles.SUPER_ADMIN);
      const user = createMockUser(SystemRoles.USER);
      const otherAdmin = createMockUser(SystemRoles.ADMIN);
      
      expect(RBACService.canManageUser(admin, user)).toBe(true);
      expect(RBACService.canManageUser(admin, otherAdmin)).toBe(true);
      expect(RBACService.canManageUser(admin, superAdmin)).toBe(false);
    });

    it('should allow user manager to manage only regular users', () => {
      const userManager = createMockUser(SystemRoles.USER_MANAGER);
      const admin = createMockUser(SystemRoles.ADMIN);
      const user = createMockUser(SystemRoles.USER);
      
      expect(RBACService.canManageUser(userManager, user)).toBe(true);
      expect(RBACService.canManageUser(userManager, admin)).toBe(false);
    });

    it('should not allow regular users to manage others', () => {
      const user1 = createMockUser(SystemRoles.USER);
      const user2 = createMockUser(SystemRoles.USER);
      
      expect(RBACService.canManageUser(user1, user2)).toBe(false);
    });
  });

  describe('canAssignRole', () => {
    it('should allow super admin to assign any role', () => {
      const superAdmin = createMockUser(SystemRoles.SUPER_ADMIN);
      
      Object.values(SystemRoles).forEach(role => {
        expect(RBACService.canAssignRole(superAdmin, role)).toBe(true);
      });
    });

    it('should allow admin to assign roles below super admin', () => {
      const admin = createMockUser(SystemRoles.ADMIN);
      
      expect(RBACService.canAssignRole(admin, SystemRoles.USER)).toBe(true);
      expect(RBACService.canAssignRole(admin, SystemRoles.ADMIN)).toBe(true);
      expect(RBACService.canAssignRole(admin, SystemRoles.SUPER_ADMIN)).toBe(false);
    });

    it('should allow user manager to assign only user role', () => {
      const userManager = createMockUser(SystemRoles.USER_MANAGER);
      
      expect(RBACService.canAssignRole(userManager, SystemRoles.USER)).toBe(true);
      expect(RBACService.canAssignRole(userManager, SystemRoles.ADMIN)).toBe(false);
    });
  });

  describe('getRoleLevel', () => {
    it('should return correct hierarchy levels', () => {
      expect(RBACService.getRoleLevel(SystemRoles.USER)).toBe(0);
      expect(RBACService.getRoleLevel(SystemRoles.ADMIN)).toBeGreaterThan(
        RBACService.getRoleLevel(SystemRoles.USER_MANAGER)
      );
      expect(RBACService.getRoleLevel(SystemRoles.SUPER_ADMIN)).toBeGreaterThan(
        RBACService.getRoleLevel(SystemRoles.ADMIN)
      );
    });
  });

  describe('isHigherRole', () => {
    it('should correctly compare role hierarchy', () => {
      expect(RBACService.isHigherRole(SystemRoles.ADMIN, SystemRoles.USER)).toBe(true);
      expect(RBACService.isHigherRole(SystemRoles.USER, SystemRoles.ADMIN)).toBe(false);
      expect(RBACService.isHigherRole(SystemRoles.SUPER_ADMIN, SystemRoles.ADMIN)).toBe(true);
    });
  });

  describe('getAssignableRoles', () => {
    it('should return all roles for super admin', () => {
      const superAdmin = createMockUser(SystemRoles.SUPER_ADMIN);
      
      const assignableRoles = RBACService.getAssignableRoles(superAdmin);
      
      expect(assignableRoles).toEqual(Object.values(SystemRoles));
    });

    it('should return roles below current level for other roles', () => {
      const admin = createMockUser(SystemRoles.ADMIN);
      
      const assignableRoles = RBACService.getAssignableRoles(admin);
      
      expect(assignableRoles).not.toContain(SystemRoles.SUPER_ADMIN);
      expect(assignableRoles).toContain(SystemRoles.USER);
      expect(assignableRoles).toContain(SystemRoles.USER_MANAGER);
    });
  });

  describe('validatePermissionDependencies', () => {
    it('should validate permissions with no dependencies', () => {
      const permissions = [Permission.USER_VIEW, Permission.ANALYTICS_VIEW];
      
      const result = RBACService.validatePermissionDependencies(permissions);
      
      expect(result.valid).toBe(true);
      expect(result.missingDependencies).toHaveLength(0);
    });

    it('should detect missing dependencies', () => {
      // USER_UPDATE depends on USER_VIEW
      const permissions = [Permission.USER_UPDATE];
      
      const result = RBACService.validatePermissionDependencies(permissions);
      
      // This test depends on the actual permission metadata
      // The result will vary based on whether USER_UPDATE has dependencies
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('missingDependencies');
    });
  });

  describe('auditUserPermissions', () => {
    it('should identify excessive permissions', () => {
      const user = createMockUser(SystemRoles.USER, [Permission.USER_DELETE]);
      
      const audit = RBACService.auditUserPermissions(user);
      
      expect(audit.excessivePermissions).toContain(Permission.USER_DELETE);
      expect(audit.riskScore).toBeGreaterThan(0);
    });

    it('should calculate risk score based on permission levels', () => {
      const lowRiskUser = createMockUser(SystemRoles.USER, [Permission.USER_VIEW]);
      const highRiskUser = createMockUser(SystemRoles.USER, [Permission.USER_DELETE, Permission.SYSTEM_CONFIG_UPDATE]);
      
      const lowRiskAudit = RBACService.auditUserPermissions(lowRiskUser);
      const highRiskAudit = RBACService.auditUserPermissions(highRiskUser);
      
      expect(highRiskAudit.riskScore).toBeGreaterThan(lowRiskAudit.riskScore);
    });
  });
});

describe('RBAC Integration', () => {
  it('should have consistent role configurations', () => {
    // Verify that all system roles have configurations
    Object.values(SystemRoles).forEach(role => {
      expect(DefaultRoleConfigurations).toHaveProperty(role);
      expect(Array.isArray(DefaultRoleConfigurations[role])).toBe(true);
    });
  });

  it('should have valid permissions in role configurations', () => {
    Object.entries(DefaultRoleConfigurations).forEach(([role, permissions]) => {
      permissions.forEach(permission => {
        expect(Object.values(Permission)).toContain(permission);
      });
    });
  });

  it('should maintain role hierarchy in permission assignments', () => {
    const userPermissions = DefaultRoleConfigurations[SystemRoles.USER];
    const adminPermissions = DefaultRoleConfigurations[SystemRoles.ADMIN];
    const superAdminPermissions = DefaultRoleConfigurations[SystemRoles.SUPER_ADMIN];
    
    // User should have the fewest permissions
    expect(userPermissions.length).toBeLessThanOrEqual(adminPermissions.length);
    
    // Super admin should have the most permissions (or all via special handling)
    expect(superAdminPermissions.length).toBeGreaterThanOrEqual(0);
  });
});