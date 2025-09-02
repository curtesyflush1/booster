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
import { validateJoi, validateJoiBody, validateJoiQuery, validateJoiParams, adminSchemas, transactionsSchemas } from '../validators';
import { addJob as enqueuePurchase } from '../services/PurchaseQueue';
import { Product } from '../models/Product';
import { AlertProcessingService } from '../services/alertProcessingService';
import { transactionService } from '../services/transactionService';

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
// Allow unknown query keys to avoid hard failures if UI passes extra flags
router.get(
  '/users',
  requirePermission(Permission.USER_VIEW),
  validateJoiQuery(adminSchemas.getUsers.query, { allowUnknown: true }),
  adminController.getUsers
);

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

// Get active price model metadata (file-based runner)
router.get('/ml/models/price/metadata', requirePermission(Permission.ML_MODEL_VIEW), adminController.getPriceModelMetadata);

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

/**
 * Temporary test route to enqueue a simulated purchase job
 * Requires SYSTEM_HEALTH_VIEW permission
 */
router.post(
  '/test-purchase',
  // In development, allow any authenticated user to trigger a simulated purchase
  (process.env.NODE_ENV === 'development' ? (_req, _res, next) => next() : requirePermission(Permission.SYSTEM_HEALTH_VIEW)),
  validateJoiBody(adminSchemas.testPurchase.body),
  (req, res) => {
  const { productId, retailerSlug, maxPrice, qty, alertAt } = req.body || {};
  const userId = req.user?.id || 'test-user';
  const job = {
    userId,
    productId,
    retailerSlug,
    maxPrice,
    qty,
    alertAt: alertAt || new Date().toISOString(),
  };
  enqueuePurchase(job);
  res.json({ queued: true, job });
});

/**
 * Catalog ingestion dry-run (no writes)
 * Requires PRODUCT_BULK_IMPORT permission
 */
router.post(
  '/catalog/ingestion/dry-run',
  requirePermission(Permission.PRODUCT_BULK_IMPORT),
  adminController.catalogIngestionDryRun
);

/**
 * Admin test route to simulate a restock alert and exercise the auto-purchase pipeline
 */
router.post(
  '/test-alert/restock',
  (process.env.NODE_ENV === 'development' ? (_req, _res, next) => next() : requirePermission(Permission.SYSTEM_HEALTH_VIEW)),
  validateJoiBody(adminSchemas.testRestockAlert.body),
  async (req, res) => {
    try {
      const { userId, productId, retailerSlug, price, productUrl, watchId } = req.body || {};
      const product = await Product.findById<any>(productId);
      if (!product) {
        return res.status(404).json({
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Product not found',
            timestamp: new Date().toISOString()
          }
        });
      }

      const retailerNames: Record<string, string> = {
        'best-buy': 'Best Buy',
        'walmart': 'Walmart',
        'costco': 'Costco',
        'sams-club': "Sam's Club",
      };
      const retailerWebsites: Record<string, string> = {
        'best-buy': 'https://www.bestbuy.com',
        'walmart': 'https://www.walmart.com',
        'costco': 'https://www.costco.com',
        'sams-club': 'https://www.samsclub.com',
      };

      const url = productUrl || `${retailerWebsites[retailerSlug] || 'https://example.com'}/${product.slug || productId}`;
      const data = {
        product_name: product.name,
        retailer_name: retailerNames[retailerSlug] || retailerSlug,
        product_url: url,
        ...(price !== undefined ? { price: Number(price) } : {})
      };

      const result = await AlertProcessingService.generateAlert({
        userId,
        productId,
        retailerId: retailerSlug,
        watchId,
        type: 'restock',
        data
      });

      return res.json({ success: true, data: result });
    } catch (error) {
      return res.status(500).json({
        error: {
          code: 'TEST_RESTOCK_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * Admin: recent transactions for quick validation
 */
router.get(
  '/purchases/transactions/recent',
  (process.env.NODE_ENV === 'development' ? (_req, _res, next) => next() : requirePermission(Permission.SYSTEM_HEALTH_VIEW)),
  validateJoiQuery(transactionsSchemas.recent.query),
  async (req, res) => {
    const { limit = 50 } = req.query as any;
    const rows = await transactionService.getRecentTransactions(Number(limit));
    res.json({ success: true, data: rows });
  }
);

export default router;
