/**
 * Comprehensive Role-Based Access Control (RBAC) system for BoosterBeacon
 * This replaces the simple subscription tier system with granular permissions
 */

// Core permission categories
export enum PermissionCategory {
  USER_MANAGEMENT = 'user_management',
  SYSTEM_ADMINISTRATION = 'system_administration',
  ML_OPERATIONS = 'ml_operations',
  ANALYTICS = 'analytics',
  CONTENT_MANAGEMENT = 'content_management',
  SECURITY = 'security',
  BILLING = 'billing',
  MONITORING = 'monitoring'
}

// Granular permissions with clear naming convention
export enum Permission {
  // User Management Permissions
  USER_VIEW = 'user:view',
  USER_CREATE = 'user:create',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_SUSPEND = 'user:suspend',
  USER_ROLE_MANAGE = 'user:role:manage',
  USER_PERMISSIONS_MANAGE = 'user:permissions:manage',
  USER_IMPERSONATE = 'user:impersonate',
  USER_EXPORT = 'user:export',
  USER_BULK_OPERATIONS = 'user:bulk:operations',

  // System Administration Permissions
  SYSTEM_HEALTH_VIEW = 'system:health:view',
  SYSTEM_METRICS_VIEW = 'system:metrics:view',
  SYSTEM_CONFIG_VIEW = 'system:config:view',
  SYSTEM_CONFIG_UPDATE = 'system:config:update',
  SYSTEM_MAINTENANCE = 'system:maintenance',
  SYSTEM_BACKUP = 'system:backup',
  SYSTEM_RESTORE = 'system:restore',
  SYSTEM_LOGS_VIEW = 'system:logs:view',
  SYSTEM_LOGS_DELETE = 'system:logs:delete',

  // ML Operations Permissions
  ML_MODEL_VIEW = 'ml:model:view',
  ML_MODEL_CREATE = 'ml:model:create',
  ML_MODEL_UPDATE = 'ml:model:update',
  ML_MODEL_DELETE = 'ml:model:delete',
  ML_MODEL_TRAIN = 'ml:model:train',
  ML_MODEL_DEPLOY = 'ml:model:deploy',
  ML_DATA_VIEW = 'ml:data:view',
  ML_DATA_REVIEW = 'ml:data:review',
  ML_DATA_APPROVE = 'ml:data:approve',
  ML_DATA_DELETE = 'ml:data:delete',
  ML_PREDICTIONS_VIEW = 'ml:predictions:view',

  // Analytics Permissions
  ANALYTICS_VIEW = 'analytics:view',
  ANALYTICS_EXPORT = 'analytics:export',
  ANALYTICS_USER_BEHAVIOR = 'analytics:user:behavior',
  ANALYTICS_BUSINESS_METRICS = 'analytics:business:metrics',
  ANALYTICS_SYSTEM_PERFORMANCE = 'analytics:system:performance',
  ANALYTICS_FINANCIAL = 'analytics:financial',

  // Content Management Permissions
  PRODUCT_VIEW = 'product:view',
  PRODUCT_CREATE = 'product:create',
  PRODUCT_UPDATE = 'product:update',
  PRODUCT_DELETE = 'product:delete',
  PRODUCT_BULK_IMPORT = 'product:bulk:import',
  RETAILER_VIEW = 'retailer:view',
  RETAILER_CREATE = 'retailer:create',
  RETAILER_UPDATE = 'retailer:update',
  RETAILER_DELETE = 'retailer:delete',
  RETAILER_CONFIG = 'retailer:config',

  // Security Permissions
  SECURITY_AUDIT_VIEW = 'security:audit:view',
  SECURITY_AUDIT_EXPORT = 'security:audit:export',
  SECURITY_TOKENS_REVOKE = 'security:tokens:revoke',
  SECURITY_SESSIONS_MANAGE = 'security:sessions:manage',
  SECURITY_PERMISSIONS_AUDIT = 'security:permissions:audit',
  SECURITY_BREACH_RESPONSE = 'security:breach:response',

  // Billing Permissions
  BILLING_VIEW = 'billing:view',
  BILLING_MANAGE = 'billing:manage',
  BILLING_REFUNDS = 'billing:refunds',
  BILLING_SUBSCRIPTIONS_MANAGE = 'billing:subscriptions:manage',
  BILLING_REPORTS = 'billing:reports',

  // Monitoring Permissions
  MONITORING_ALERTS_VIEW = 'monitoring:alerts:view',
  MONITORING_ALERTS_MANAGE = 'monitoring:alerts:manage',
  MONITORING_DASHBOARDS_VIEW = 'monitoring:dashboards:view',
  MONITORING_DASHBOARDS_MANAGE = 'monitoring:dashboards:manage',
  MONITORING_NOTIFICATIONS_MANAGE = 'monitoring:notifications:manage'
}

// Role definitions with associated permissions
export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystemRole: boolean;
  category: PermissionCategory[];
  createdAt: Date;
  updatedAt: Date;
}

// Predefined system roles
export const SystemRoles = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER_MANAGER: 'user_manager',
  CONTENT_MANAGER: 'content_manager',
  ML_ENGINEER: 'ml_engineer',
  ANALYST: 'analyst',
  SUPPORT_AGENT: 'support_agent',
  BILLING_MANAGER: 'billing_manager',
  SECURITY_OFFICER: 'security_officer',
  USER: 'user'
} as const;

export type SystemRole = typeof SystemRoles[keyof typeof SystemRoles];

// Permission groups for easier management
export const PermissionGroups = {
  USER_MANAGEMENT_FULL: [
    Permission.USER_VIEW,
    Permission.USER_CREATE,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.USER_SUSPEND,
    Permission.USER_EXPORT,
    Permission.USER_BULK_OPERATIONS
  ],
  USER_MANAGEMENT_READ: [
    Permission.USER_VIEW
  ],
  SYSTEM_ADMIN_FULL: [
    Permission.SYSTEM_HEALTH_VIEW,
    Permission.SYSTEM_METRICS_VIEW,
    Permission.SYSTEM_CONFIG_VIEW,
    Permission.SYSTEM_CONFIG_UPDATE,
    Permission.SYSTEM_MAINTENANCE,
    Permission.SYSTEM_BACKUP,
    Permission.SYSTEM_RESTORE,
    Permission.SYSTEM_LOGS_VIEW,
    Permission.SYSTEM_LOGS_DELETE
  ],
  ML_OPERATIONS_FULL: [
    Permission.ML_MODEL_VIEW,
    Permission.ML_MODEL_CREATE,
    Permission.ML_MODEL_UPDATE,
    Permission.ML_MODEL_DELETE,
    Permission.ML_MODEL_TRAIN,
    Permission.ML_MODEL_DEPLOY,
    Permission.ML_DATA_VIEW,
    Permission.ML_DATA_REVIEW,
    Permission.ML_DATA_APPROVE,
    Permission.ML_DATA_DELETE,
    Permission.ML_PREDICTIONS_VIEW
  ],
  ANALYTICS_FULL: [
    Permission.ANALYTICS_VIEW,
    Permission.ANALYTICS_EXPORT,
    Permission.ANALYTICS_USER_BEHAVIOR,
    Permission.ANALYTICS_BUSINESS_METRICS,
    Permission.ANALYTICS_SYSTEM_PERFORMANCE,
    Permission.ANALYTICS_FINANCIAL
  ],
  CONTENT_MANAGEMENT_FULL: [
    Permission.PRODUCT_VIEW,
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_UPDATE,
    Permission.PRODUCT_DELETE,
    Permission.PRODUCT_BULK_IMPORT,
    Permission.RETAILER_VIEW,
    Permission.RETAILER_CREATE,
    Permission.RETAILER_UPDATE,
    Permission.RETAILER_DELETE,
    Permission.RETAILER_CONFIG
  ],
  SECURITY_FULL: [
    Permission.SECURITY_AUDIT_VIEW,
    Permission.SECURITY_AUDIT_EXPORT,
    Permission.SECURITY_TOKENS_REVOKE,
    Permission.SECURITY_SESSIONS_MANAGE,
    Permission.SECURITY_PERMISSIONS_AUDIT,
    Permission.SECURITY_BREACH_RESPONSE
  ],
  BILLING_FULL: [
    Permission.BILLING_VIEW,
    Permission.BILLING_MANAGE,
    Permission.BILLING_REFUNDS,
    Permission.BILLING_SUBSCRIPTIONS_MANAGE,
    Permission.BILLING_REPORTS
  ],
  MONITORING_FULL: [
    Permission.MONITORING_ALERTS_VIEW,
    Permission.MONITORING_ALERTS_MANAGE,
    Permission.MONITORING_DASHBOARDS_VIEW,
    Permission.MONITORING_DASHBOARDS_MANAGE,
    Permission.MONITORING_NOTIFICATIONS_MANAGE
  ]
} as const;

// Default role configurations
export const DefaultRoleConfigurations: Record<SystemRole, Permission[]> = {
  [SystemRoles.SUPER_ADMIN]: Object.values(Permission), // All permissions
  [SystemRoles.ADMIN]: [
    ...PermissionGroups.USER_MANAGEMENT_FULL,
    ...PermissionGroups.SYSTEM_ADMIN_FULL,
    ...PermissionGroups.ANALYTICS_FULL,
    ...PermissionGroups.CONTENT_MANAGEMENT_FULL,
    ...PermissionGroups.SECURITY_FULL,
    ...PermissionGroups.MONITORING_FULL,
    Permission.ML_MODEL_VIEW,
    Permission.ML_MODEL_TRAIN,
    Permission.ML_DATA_VIEW,
    Permission.ML_PREDICTIONS_VIEW
  ],
  [SystemRoles.USER_MANAGER]: [
    ...PermissionGroups.USER_MANAGEMENT_FULL,
    Permission.ANALYTICS_VIEW,
    Permission.ANALYTICS_USER_BEHAVIOR,
    Permission.SECURITY_AUDIT_VIEW,
    Permission.SECURITY_SESSIONS_MANAGE
  ],
  [SystemRoles.CONTENT_MANAGER]: [
    ...PermissionGroups.CONTENT_MANAGEMENT_FULL,
    Permission.USER_VIEW,
    Permission.ANALYTICS_VIEW,
    Permission.SYSTEM_HEALTH_VIEW
  ],
  [SystemRoles.ML_ENGINEER]: [
    ...PermissionGroups.ML_OPERATIONS_FULL,
    Permission.SYSTEM_HEALTH_VIEW,
    Permission.SYSTEM_METRICS_VIEW,
    Permission.ANALYTICS_VIEW,
    Permission.ANALYTICS_SYSTEM_PERFORMANCE
  ],
  [SystemRoles.ANALYST]: [
    ...PermissionGroups.ANALYTICS_FULL,
    Permission.USER_VIEW,
    Permission.SYSTEM_HEALTH_VIEW,
    Permission.SYSTEM_METRICS_VIEW,
    Permission.ML_PREDICTIONS_VIEW,
    Permission.PRODUCT_VIEW,
    Permission.RETAILER_VIEW
  ],
  [SystemRoles.SUPPORT_AGENT]: [
    Permission.USER_VIEW,
    Permission.USER_UPDATE,
    Permission.USER_SUSPEND,
    Permission.ANALYTICS_VIEW,
    Permission.SECURITY_AUDIT_VIEW,
    Permission.SYSTEM_HEALTH_VIEW,
    Permission.PRODUCT_VIEW,
    Permission.RETAILER_VIEW
  ],
  [SystemRoles.BILLING_MANAGER]: [
    ...PermissionGroups.BILLING_FULL,
    Permission.USER_VIEW,
    Permission.ANALYTICS_VIEW,
    Permission.ANALYTICS_FINANCIAL,
    Permission.SECURITY_AUDIT_VIEW
  ],
  [SystemRoles.SECURITY_OFFICER]: [
    ...PermissionGroups.SECURITY_FULL,
    Permission.USER_VIEW,
    Permission.USER_SUSPEND,
    Permission.SYSTEM_HEALTH_VIEW,
    Permission.SYSTEM_LOGS_VIEW,
    Permission.ANALYTICS_VIEW,
    Permission.MONITORING_ALERTS_VIEW,
    Permission.MONITORING_ALERTS_MANAGE
  ],
  [SystemRoles.USER]: [] // Regular users have no admin permissions
};

// Permission metadata for UI and documentation
export interface PermissionMetadata {
  permission: Permission;
  category: PermissionCategory;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresApproval?: boolean;
  dependencies?: Permission[];
}

export const PermissionMetadataMap: Record<Permission, PermissionMetadata> = {
  // User Management
  [Permission.USER_VIEW]: {
    permission: Permission.USER_VIEW,
    category: PermissionCategory.USER_MANAGEMENT,
    description: 'View user profiles and basic information',
    riskLevel: 'low'
  },
  [Permission.USER_CREATE]: {
    permission: Permission.USER_CREATE,
    category: PermissionCategory.USER_MANAGEMENT,
    description: 'Create new user accounts',
    riskLevel: 'medium'
  },
  [Permission.USER_UPDATE]: {
    permission: Permission.USER_UPDATE,
    category: PermissionCategory.USER_MANAGEMENT,
    description: 'Update user profiles and settings',
    riskLevel: 'medium',
    dependencies: [Permission.USER_VIEW]
  },
  [Permission.USER_DELETE]: {
    permission: Permission.USER_DELETE,
    category: PermissionCategory.USER_MANAGEMENT,
    description: 'Permanently delete user accounts',
    riskLevel: 'critical',
    requiresApproval: true,
    dependencies: [Permission.USER_VIEW]
  },
  [Permission.USER_SUSPEND]: {
    permission: Permission.USER_SUSPEND,
    category: PermissionCategory.USER_MANAGEMENT,
    description: 'Suspend or unsuspend user accounts',
    riskLevel: 'high',
    dependencies: [Permission.USER_VIEW]
  },
  [Permission.USER_ROLE_MANAGE]: {
    permission: Permission.USER_ROLE_MANAGE,
    category: PermissionCategory.USER_MANAGEMENT,
    description: 'Assign and modify user roles',
    riskLevel: 'critical',
    requiresApproval: true,
    dependencies: [Permission.USER_VIEW]
  },
  [Permission.USER_PERMISSIONS_MANAGE]: {
    permission: Permission.USER_PERMISSIONS_MANAGE,
    category: PermissionCategory.USER_MANAGEMENT,
    description: 'Assign and modify user permissions',
    riskLevel: 'critical',
    requiresApproval: true,
    dependencies: [Permission.USER_VIEW, Permission.USER_ROLE_MANAGE]
  },
  [Permission.USER_IMPERSONATE]: {
    permission: Permission.USER_IMPERSONATE,
    category: PermissionCategory.USER_MANAGEMENT,
    description: 'Impersonate other users for support purposes',
    riskLevel: 'critical',
    requiresApproval: true,
    dependencies: [Permission.USER_VIEW]
  },
  [Permission.USER_EXPORT]: {
    permission: Permission.USER_EXPORT,
    category: PermissionCategory.USER_MANAGEMENT,
    description: 'Export user data and reports',
    riskLevel: 'medium',
    dependencies: [Permission.USER_VIEW]
  },
  [Permission.USER_BULK_OPERATIONS]: {
    permission: Permission.USER_BULK_OPERATIONS,
    category: PermissionCategory.USER_MANAGEMENT,
    description: 'Perform bulk operations on multiple users',
    riskLevel: 'high',
    dependencies: [Permission.USER_VIEW, Permission.USER_UPDATE]
  },

  // System Administration
  [Permission.SYSTEM_HEALTH_VIEW]: {
    permission: Permission.SYSTEM_HEALTH_VIEW,
    category: PermissionCategory.SYSTEM_ADMINISTRATION,
    description: 'View system health and status information',
    riskLevel: 'low'
  },
  [Permission.SYSTEM_METRICS_VIEW]: {
    permission: Permission.SYSTEM_METRICS_VIEW,
    category: PermissionCategory.SYSTEM_ADMINISTRATION,
    description: 'View detailed system metrics and performance data',
    riskLevel: 'low'
  },
  [Permission.SYSTEM_CONFIG_VIEW]: {
    permission: Permission.SYSTEM_CONFIG_VIEW,
    category: PermissionCategory.SYSTEM_ADMINISTRATION,
    description: 'View system configuration settings',
    riskLevel: 'medium'
  },
  [Permission.SYSTEM_CONFIG_UPDATE]: {
    permission: Permission.SYSTEM_CONFIG_UPDATE,
    category: PermissionCategory.SYSTEM_ADMINISTRATION,
    description: 'Modify system configuration settings',
    riskLevel: 'critical',
    requiresApproval: true,
    dependencies: [Permission.SYSTEM_CONFIG_VIEW]
  },
  [Permission.SYSTEM_MAINTENANCE]: {
    permission: Permission.SYSTEM_MAINTENANCE,
    category: PermissionCategory.SYSTEM_ADMINISTRATION,
    description: 'Perform system maintenance operations',
    riskLevel: 'high',
    dependencies: [Permission.SYSTEM_HEALTH_VIEW]
  },
  [Permission.SYSTEM_BACKUP]: {
    permission: Permission.SYSTEM_BACKUP,
    category: PermissionCategory.SYSTEM_ADMINISTRATION,
    description: 'Create and manage system backups',
    riskLevel: 'medium'
  },
  [Permission.SYSTEM_RESTORE]: {
    permission: Permission.SYSTEM_RESTORE,
    category: PermissionCategory.SYSTEM_ADMINISTRATION,
    description: 'Restore system from backups',
    riskLevel: 'critical',
    requiresApproval: true,
    dependencies: [Permission.SYSTEM_BACKUP]
  },
  [Permission.SYSTEM_LOGS_VIEW]: {
    permission: Permission.SYSTEM_LOGS_VIEW,
    category: PermissionCategory.SYSTEM_ADMINISTRATION,
    description: 'View system logs and audit trails',
    riskLevel: 'medium'
  },
  [Permission.SYSTEM_LOGS_DELETE]: {
    permission: Permission.SYSTEM_LOGS_DELETE,
    category: PermissionCategory.SYSTEM_ADMINISTRATION,
    description: 'Delete system logs and audit trails',
    riskLevel: 'high',
    requiresApproval: true,
    dependencies: [Permission.SYSTEM_LOGS_VIEW]
  },

  // ML Operations
  [Permission.ML_MODEL_VIEW]: {
    permission: Permission.ML_MODEL_VIEW,
    category: PermissionCategory.ML_OPERATIONS,
    description: 'View ML models and their configurations',
    riskLevel: 'low'
  },
  [Permission.ML_MODEL_CREATE]: {
    permission: Permission.ML_MODEL_CREATE,
    category: PermissionCategory.ML_OPERATIONS,
    description: 'Create new ML models',
    riskLevel: 'medium'
  },
  [Permission.ML_MODEL_UPDATE]: {
    permission: Permission.ML_MODEL_UPDATE,
    category: PermissionCategory.ML_OPERATIONS,
    description: 'Update ML model configurations',
    riskLevel: 'medium',
    dependencies: [Permission.ML_MODEL_VIEW]
  },
  [Permission.ML_MODEL_DELETE]: {
    permission: Permission.ML_MODEL_DELETE,
    category: PermissionCategory.ML_OPERATIONS,
    description: 'Delete ML models',
    riskLevel: 'high',
    dependencies: [Permission.ML_MODEL_VIEW]
  },
  [Permission.ML_MODEL_TRAIN]: {
    permission: Permission.ML_MODEL_TRAIN,
    category: PermissionCategory.ML_OPERATIONS,
    description: 'Train and retrain ML models',
    riskLevel: 'medium',
    dependencies: [Permission.ML_MODEL_VIEW]
  },
  [Permission.ML_MODEL_DEPLOY]: {
    permission: Permission.ML_MODEL_DEPLOY,
    category: PermissionCategory.ML_OPERATIONS,
    description: 'Deploy ML models to production',
    riskLevel: 'high',
    requiresApproval: true,
    dependencies: [Permission.ML_MODEL_VIEW, Permission.ML_MODEL_TRAIN]
  },
  [Permission.ML_DATA_VIEW]: {
    permission: Permission.ML_DATA_VIEW,
    category: PermissionCategory.ML_OPERATIONS,
    description: 'View ML training data and datasets',
    riskLevel: 'low'
  },
  [Permission.ML_DATA_REVIEW]: {
    permission: Permission.ML_DATA_REVIEW,
    category: PermissionCategory.ML_OPERATIONS,
    description: 'Review ML training data for quality',
    riskLevel: 'medium',
    dependencies: [Permission.ML_DATA_VIEW]
  },
  [Permission.ML_DATA_APPROVE]: {
    permission: Permission.ML_DATA_APPROVE,
    category: PermissionCategory.ML_OPERATIONS,
    description: 'Approve or reject ML training data',
    riskLevel: 'medium',
    dependencies: [Permission.ML_DATA_VIEW, Permission.ML_DATA_REVIEW]
  },
  [Permission.ML_DATA_DELETE]: {
    permission: Permission.ML_DATA_DELETE,
    category: PermissionCategory.ML_OPERATIONS,
    description: 'Delete ML training data',
    riskLevel: 'high',
    dependencies: [Permission.ML_DATA_VIEW]
  },
  [Permission.ML_PREDICTIONS_VIEW]: {
    permission: Permission.ML_PREDICTIONS_VIEW,
    category: PermissionCategory.ML_OPERATIONS,
    description: 'View ML predictions and insights',
    riskLevel: 'low'
  },

  // Analytics
  [Permission.ANALYTICS_VIEW]: {
    permission: Permission.ANALYTICS_VIEW,
    category: PermissionCategory.ANALYTICS,
    description: 'View basic analytics and reports',
    riskLevel: 'low'
  },
  [Permission.ANALYTICS_EXPORT]: {
    permission: Permission.ANALYTICS_EXPORT,
    category: PermissionCategory.ANALYTICS,
    description: 'Export analytics data and reports',
    riskLevel: 'medium',
    dependencies: [Permission.ANALYTICS_VIEW]
  },
  [Permission.ANALYTICS_USER_BEHAVIOR]: {
    permission: Permission.ANALYTICS_USER_BEHAVIOR,
    category: PermissionCategory.ANALYTICS,
    description: 'View user behavior analytics',
    riskLevel: 'medium',
    dependencies: [Permission.ANALYTICS_VIEW]
  },
  [Permission.ANALYTICS_BUSINESS_METRICS]: {
    permission: Permission.ANALYTICS_BUSINESS_METRICS,
    category: PermissionCategory.ANALYTICS,
    description: 'View business metrics and KPIs',
    riskLevel: 'medium',
    dependencies: [Permission.ANALYTICS_VIEW]
  },
  [Permission.ANALYTICS_SYSTEM_PERFORMANCE]: {
    permission: Permission.ANALYTICS_SYSTEM_PERFORMANCE,
    category: PermissionCategory.ANALYTICS,
    description: 'View system performance analytics',
    riskLevel: 'low',
    dependencies: [Permission.ANALYTICS_VIEW]
  },
  [Permission.ANALYTICS_FINANCIAL]: {
    permission: Permission.ANALYTICS_FINANCIAL,
    category: PermissionCategory.ANALYTICS,
    description: 'View financial analytics and revenue data',
    riskLevel: 'high',
    dependencies: [Permission.ANALYTICS_VIEW]
  },

  // Content Management
  [Permission.PRODUCT_VIEW]: {
    permission: Permission.PRODUCT_VIEW,
    category: PermissionCategory.CONTENT_MANAGEMENT,
    description: 'View product catalog and information',
    riskLevel: 'low'
  },
  [Permission.PRODUCT_CREATE]: {
    permission: Permission.PRODUCT_CREATE,
    category: PermissionCategory.CONTENT_MANAGEMENT,
    description: 'Create new products in the catalog',
    riskLevel: 'medium'
  },
  [Permission.PRODUCT_UPDATE]: {
    permission: Permission.PRODUCT_UPDATE,
    category: PermissionCategory.CONTENT_MANAGEMENT,
    description: 'Update product information and metadata',
    riskLevel: 'medium',
    dependencies: [Permission.PRODUCT_VIEW]
  },
  [Permission.PRODUCT_DELETE]: {
    permission: Permission.PRODUCT_DELETE,
    category: PermissionCategory.CONTENT_MANAGEMENT,
    description: 'Delete products from the catalog',
    riskLevel: 'high',
    dependencies: [Permission.PRODUCT_VIEW]
  },
  [Permission.PRODUCT_BULK_IMPORT]: {
    permission: Permission.PRODUCT_BULK_IMPORT,
    category: PermissionCategory.CONTENT_MANAGEMENT,
    description: 'Bulk import products from external sources',
    riskLevel: 'medium',
    dependencies: [Permission.PRODUCT_CREATE]
  },
  [Permission.RETAILER_VIEW]: {
    permission: Permission.RETAILER_VIEW,
    category: PermissionCategory.CONTENT_MANAGEMENT,
    description: 'View retailer configurations and status',
    riskLevel: 'low'
  },
  [Permission.RETAILER_CREATE]: {
    permission: Permission.RETAILER_CREATE,
    category: PermissionCategory.CONTENT_MANAGEMENT,
    description: 'Add new retailer integrations',
    riskLevel: 'medium'
  },
  [Permission.RETAILER_UPDATE]: {
    permission: Permission.RETAILER_UPDATE,
    category: PermissionCategory.CONTENT_MANAGEMENT,
    description: 'Update retailer configurations',
    riskLevel: 'medium',
    dependencies: [Permission.RETAILER_VIEW]
  },
  [Permission.RETAILER_DELETE]: {
    permission: Permission.RETAILER_DELETE,
    category: PermissionCategory.CONTENT_MANAGEMENT,
    description: 'Remove retailer integrations',
    riskLevel: 'high',
    dependencies: [Permission.RETAILER_VIEW]
  },
  [Permission.RETAILER_CONFIG]: {
    permission: Permission.RETAILER_CONFIG,
    category: PermissionCategory.CONTENT_MANAGEMENT,
    description: 'Configure retailer API settings and credentials',
    riskLevel: 'high',
    dependencies: [Permission.RETAILER_VIEW]
  },

  // Security
  [Permission.SECURITY_AUDIT_VIEW]: {
    permission: Permission.SECURITY_AUDIT_VIEW,
    category: PermissionCategory.SECURITY,
    description: 'View security audit logs and events',
    riskLevel: 'medium'
  },
  [Permission.SECURITY_AUDIT_EXPORT]: {
    permission: Permission.SECURITY_AUDIT_EXPORT,
    category: PermissionCategory.SECURITY,
    description: 'Export security audit data',
    riskLevel: 'high',
    dependencies: [Permission.SECURITY_AUDIT_VIEW]
  },
  [Permission.SECURITY_TOKENS_REVOKE]: {
    permission: Permission.SECURITY_TOKENS_REVOKE,
    category: PermissionCategory.SECURITY,
    description: 'Revoke user authentication tokens',
    riskLevel: 'high'
  },
  [Permission.SECURITY_SESSIONS_MANAGE]: {
    permission: Permission.SECURITY_SESSIONS_MANAGE,
    category: PermissionCategory.SECURITY,
    description: 'Manage user sessions and force logouts',
    riskLevel: 'high'
  },
  [Permission.SECURITY_PERMISSIONS_AUDIT]: {
    permission: Permission.SECURITY_PERMISSIONS_AUDIT,
    category: PermissionCategory.SECURITY,
    description: 'Audit user permissions and role changes',
    riskLevel: 'medium'
  },
  [Permission.SECURITY_BREACH_RESPONSE]: {
    permission: Permission.SECURITY_BREACH_RESPONSE,
    category: PermissionCategory.SECURITY,
    description: 'Respond to security breaches and incidents',
    riskLevel: 'critical',
    requiresApproval: true
  },

  // Billing
  [Permission.BILLING_VIEW]: {
    permission: Permission.BILLING_VIEW,
    category: PermissionCategory.BILLING,
    description: 'View billing information and transactions',
    riskLevel: 'medium'
  },
  [Permission.BILLING_MANAGE]: {
    permission: Permission.BILLING_MANAGE,
    category: PermissionCategory.BILLING,
    description: 'Manage billing settings and payment methods',
    riskLevel: 'high',
    dependencies: [Permission.BILLING_VIEW]
  },
  [Permission.BILLING_REFUNDS]: {
    permission: Permission.BILLING_REFUNDS,
    category: PermissionCategory.BILLING,
    description: 'Process refunds and billing adjustments',
    riskLevel: 'high',
    dependencies: [Permission.BILLING_VIEW]
  },
  [Permission.BILLING_SUBSCRIPTIONS_MANAGE]: {
    permission: Permission.BILLING_SUBSCRIPTIONS_MANAGE,
    category: PermissionCategory.BILLING,
    description: 'Manage user subscriptions and billing cycles',
    riskLevel: 'high',
    dependencies: [Permission.BILLING_VIEW]
  },
  [Permission.BILLING_REPORTS]: {
    permission: Permission.BILLING_REPORTS,
    category: PermissionCategory.BILLING,
    description: 'Generate and view billing reports',
    riskLevel: 'medium',
    dependencies: [Permission.BILLING_VIEW]
  },

  // Monitoring
  [Permission.MONITORING_ALERTS_VIEW]: {
    permission: Permission.MONITORING_ALERTS_VIEW,
    category: PermissionCategory.MONITORING,
    description: 'View system monitoring alerts',
    riskLevel: 'low'
  },
  [Permission.MONITORING_ALERTS_MANAGE]: {
    permission: Permission.MONITORING_ALERTS_MANAGE,
    category: PermissionCategory.MONITORING,
    description: 'Manage monitoring alert rules and notifications',
    riskLevel: 'medium',
    dependencies: [Permission.MONITORING_ALERTS_VIEW]
  },
  [Permission.MONITORING_DASHBOARDS_VIEW]: {
    permission: Permission.MONITORING_DASHBOARDS_VIEW,
    category: PermissionCategory.MONITORING,
    description: 'View monitoring dashboards',
    riskLevel: 'low'
  },
  [Permission.MONITORING_DASHBOARDS_MANAGE]: {
    permission: Permission.MONITORING_DASHBOARDS_MANAGE,
    category: PermissionCategory.MONITORING,
    description: 'Create and modify monitoring dashboards',
    riskLevel: 'medium',
    dependencies: [Permission.MONITORING_DASHBOARDS_VIEW]
  },
  [Permission.MONITORING_NOTIFICATIONS_MANAGE]: {
    permission: Permission.MONITORING_NOTIFICATIONS_MANAGE,
    category: PermissionCategory.MONITORING,
    description: 'Manage monitoring notification channels',
    riskLevel: 'medium'
  }
};

// Helper type for permission checking
export type PermissionCheck = {
  hasPermission: boolean;
  reason?: string;
  requiredRole?: string;
  missingPermissions?: Permission[];
};
