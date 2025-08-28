import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin, requireSuperAdmin, requirePermission, AdminPermissions } from '../middleware/adminAuth';
import * as adminController from '../controllers/adminController';

const router = Router();

// All admin routes require authentication
router.use(authenticate);

/**
 * Dashboard and Overview Routes
 */

// Get admin dashboard statistics
router.get('/dashboard/stats', requireAdmin, adminController.getDashboardStats);

// Get system health status
router.get('/system/health', requireAdmin, adminController.getSystemHealth);

/**
 * User Management Routes
 */

// Get users with filtering and pagination
router.get('/users', requirePermission(AdminPermissions.USER_MANAGEMENT), adminController.getUsers);

// Get user statistics
router.get('/users/stats', requirePermission(AdminPermissions.ANALYTICS_VIEW), adminController.getUserStats);

// Get specific user details
router.get('/users/:userId', requirePermission(AdminPermissions.USER_MANAGEMENT), adminController.getUserDetails);

// Update user role and permissions
router.put('/users/:userId/role', requireSuperAdmin, adminController.updateUserRole);

// Suspend or unsuspend user
router.put('/users/:userId/suspend', requirePermission(AdminPermissions.USER_SUSPEND), adminController.suspendUser);

// Delete user (super admin only)
router.delete('/users/:userId', requireSuperAdmin, adminController.deleteUser);

/**
 * ML Model Management Routes
 */

// Get all ML models
router.get('/ml/models', requirePermission(AdminPermissions.ML_MODEL_TRAINING), adminController.getMLModels);

// Get ML statistics
router.get('/ml/stats', requirePermission(AdminPermissions.ML_MODEL_TRAINING), adminController.getMLStats);

// Create new ML model training job
router.post('/ml/models', requirePermission(AdminPermissions.ML_MODEL_TRAINING), adminController.createMLModel);

// Deploy ML model
router.post('/ml/models/:modelId/deploy', requirePermission(AdminPermissions.ML_MODEL_TRAINING), adminController.deployMLModel);

// Trigger model retraining
router.post('/ml/models/:modelName/retrain', requirePermission(AdminPermissions.ML_MODEL_TRAINING), adminController.triggerRetraining);

/**
 * ML Training Data Management Routes
 */

// Get training data for review
router.get('/ml/training-data', requirePermission(AdminPermissions.ML_DATA_REVIEW), adminController.getTrainingData);

// Review training data (approve/reject)
router.put('/ml/training-data/:dataId/review', requirePermission(AdminPermissions.ML_DATA_REVIEW), adminController.reviewTrainingData);

/**
 * Audit and Monitoring Routes
 */

// Get audit logs
router.get('/audit/logs', requirePermission(AdminPermissions.AUDIT_LOG_VIEW), adminController.getAuditLogs);

export default router;