import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { 
  requirePermission, 
  requireMinimumRole,
  requireAnyPermission,
  requireAllPermissions
} from '../middleware/adminAuth';
import { Permission, SystemRoles } from '../types/permissions';
import * as adminController from '../controllers/adminController';
import * as rbacController from '../controllers/rbacController';
import { sanitizeParameters } from '../middleware/parameterSanitization';
import { contentSanitizationMiddleware } from '../utils/contentSanitization';
import { validateJoi, validateJoiBody, validateJoiQuery, validateJoiParams, adminSchemas } from '../validators';

const router = Router();

// All admin routes require authentication
router.use(authenticate);

/**
 * Dashboard and Overview Routes
 */

// Get admin dashboard statistics - requires analytics view or system monitoring
router.get('/dashboard/stats', 
  requireAnyPermission([Permission.ANALYTICS_VIEW, Permission.SYSTEM_HEALTH_VIEW]), 
  adminController.getDashboardStats
);

// Get system health status
router.get('/system/health', requirePermission(Permission.SYSTEM_HEALTH_VIEW), adminController.getSystemHealth);

// TODO: Implement these methods in adminController.ts
// Get system metrics
// router.get('/system/metrics', requirePermission(Permission.SYSTEM_METRICS_VIEW), adminController.getSystemMetrics);

// Get system configuration (view only)
// router.get('/system/config', requirePermission(Permission.SYSTEM_CONFIG_VIEW), adminController.getSystemConfig);

// Update system configuration
// router.put('/system/config', requirePermission(Permission.SYSTEM_CONFIG_UPDATE), adminController.updateSystemConfig);

/**
 * User Management Routes
 */

// Get users with filtering and pagination
router.get('/users', requirePermission(Permission.USER_VIEW), validateJoiQuery(adminSchemas.getUsers.query), adminController.getUsers);

// Get user statistics
router.get('/users/stats', 
  requireAnyPermission([Permission.ANALYTICS_VIEW, Permission.USER_VIEW]), 
  adminController.getUserStats
);

// Get specific user details
router.get('/users/:userId', sanitizeParameters, requirePermission(Permission.USER_VIEW), adminController.getUserDetails);

// Update user role and permissions - requires both role management and permission management
router.put('/users/:userId/role', 
  sanitizeParameters,
  requireAllPermissions([Permission.USER_ROLE_MANAGE, Permission.USER_PERMISSIONS_MANAGE]), 
  validateJoi({
    params: adminSchemas.updateUserRole.params,
    body: adminSchemas.updateUserRole.body
  }),
  adminController.updateUserRole
);

// Suspend or unsuspend user
router.put('/users/:userId/suspend', sanitizeParameters, requirePermission(Permission.USER_SUSPEND), validateJoi({
  params: adminSchemas.suspendUser.params,
  body: adminSchemas.suspendUser.body
}), adminController.suspendUser);

// Delete user - requires delete permission
router.delete('/users/:userId', sanitizeParameters, requirePermission(Permission.USER_DELETE), adminController.deleteUser);

/**
 * ML Model Management Routes
 */

// Get all ML models
router.get('/ml/models', requirePermission(Permission.ML_MODEL_VIEW), adminController.getMLModels);

// Get ML statistics
router.get('/ml/stats', 
  requireAnyPermission([Permission.ML_MODEL_VIEW, Permission.ANALYTICS_VIEW]), 
  adminController.getMLStats
);

// Create new ML model
router.post('/ml/models', requirePermission(Permission.ML_MODEL_CREATE), validateJoiBody(adminSchemas.createMLModel.body), adminController.createMLModel);

// Deploy ML model to production
router.post('/ml/models/:modelId/deploy', sanitizeParameters, requirePermission(Permission.ML_MODEL_DEPLOY), adminController.deployMLModel);

// Trigger model retraining
router.post('/ml/models/:modelName/retrain', sanitizeParameters, requirePermission(Permission.ML_MODEL_TRAIN), adminController.triggerRetraining);

/**
 * ML Training Data Management Routes
 */

// Get training data
router.get('/ml/training-data', requirePermission(Permission.ML_DATA_VIEW), adminController.getTrainingData);

// Review training data for quality
router.put('/ml/training-data/:dataId/review', sanitizeParameters, contentSanitizationMiddleware.admin, requirePermission(Permission.ML_DATA_REVIEW), validateJoiBody(adminSchemas.reviewTrainingData.body), adminController.reviewTrainingData);

/**
 * Security and Audit Routes
 */

// View audit logs
router.get('/audit/logs', requirePermission(Permission.SECURITY_AUDIT_VIEW), adminController.getAuditLogs);

/**
 * RBAC Management Routes
 */

// Get available permissions
router.get('/rbac/permissions', 
  requireMinimumRole(SystemRoles.ADMIN), 
  rbacController.getAvailablePermissions
);

// Get available roles
router.get('/rbac/roles', 
  requireMinimumRole(SystemRoles.ADMIN), 
  rbacController.getAvailableRoles
);

// Get user permissions
router.get('/rbac/users/:userId/permissions', 
  sanitizeParameters,
  requirePermission(Permission.USER_VIEW), 
  rbacController.getUserPermissions
);

// Update user permissions (replace all)
router.put('/rbac/users/:userId/permissions', 
  sanitizeParameters,
  requirePermission(Permission.USER_PERMISSIONS_MANAGE), 
  rbacController.updateUserPermissions
);

// Add single permission to user
router.post('/rbac/users/:userId/permissions', 
  sanitizeParameters,
  requirePermission(Permission.USER_PERMISSIONS_MANAGE), 
  rbacController.addUserPermission
);

// Remove single permission from user
router.delete('/rbac/users/:userId/permissions', 
  sanitizeParameters,
  requirePermission(Permission.USER_PERMISSIONS_MANAGE), 
  rbacController.removeUserPermission
);

// Update user role
router.put('/rbac/users/:userId/role', 
  sanitizeParameters,
  requirePermission(Permission.USER_ROLE_MANAGE), 
  rbacController.updateUserRole
);

// Audit user permissions
router.get('/rbac/audit/:userId', 
  sanitizeParameters,
  requirePermission(Permission.SECURITY_PERMISSIONS_AUDIT), 
  rbacController.auditUserPermissions
);

// Get current user's own permissions
router.get('/rbac/my-permissions', 
  requireMinimumRole(SystemRoles.USER), 
  rbacController.getMyPermissions
);

export default router;