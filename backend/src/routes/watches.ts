import { Router } from 'express';
import { WatchController } from '../controllers/watchController';
import { WatchPackController } from '../controllers/watchPackController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';
import multer from 'multer';



const router = Router();

// Configure multer for CSV file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Watch management routes
router.get(
  '/',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
    query('product_id').optional().isUUID().withMessage('product_id must be a valid UUID'),
    query('retailer_id').optional().isUUID().withMessage('retailer_id must be a valid UUID')
  ],
  validateRequest,
  WatchController.getUserWatches
);

router.get(
  '/stats',
  authenticate,
  WatchController.getWatchStats
);

router.get(
  '/export',
  authenticate,
  [
    query('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
  ],
  validateRequest,
  WatchController.exportWatches
);

router.post(
  '/import',
  authenticate,
  upload.single('csv'),
  WatchController.bulkImportWatches as any
);

router.get(
  '/:watchId',
  authenticate,
  [
    param('watchId').isUUID().withMessage('Watch ID must be a valid UUID')
  ],
  validateRequest,
  WatchController.getWatch
);

router.post(
  '/',
  authenticate,
  [
    body('product_id').isUUID().withMessage('Product ID must be a valid UUID'),
    body('retailer_ids').optional().isArray().withMessage('Retailer IDs must be an array'),
    body('retailer_ids.*').optional().isUUID().withMessage('Each retailer ID must be a valid UUID'),
    body('max_price').optional().isFloat({ min: 0 }).withMessage('Max price must be a positive number'),
    body('availability_type').optional().isIn(['online', 'in_store', 'both']).withMessage('Invalid availability type'),
    body('zip_code').optional().matches(/^\d{5}(-\d{4})?$/).withMessage('ZIP code must be in format 12345 or 12345-6789'),
    body('radius_miles').optional().isInt({ min: 1, max: 500 }).withMessage('Radius must be between 1 and 500 miles'),
    body('alert_preferences').optional().isObject().withMessage('Alert preferences must be an object')
  ],
  validateRequest,
  WatchController.createWatch
);

router.put(
  '/:watchId',
  authenticate,
  [
    param('watchId').isUUID().withMessage('Watch ID must be a valid UUID'),
    body('retailer_ids').optional().isArray().withMessage('Retailer IDs must be an array'),
    body('retailer_ids.*').optional().isUUID().withMessage('Each retailer ID must be a valid UUID'),
    body('max_price').optional().isFloat({ min: 0 }).withMessage('Max price must be a positive number'),
    body('availability_type').optional().isIn(['online', 'in_store', 'both']).withMessage('Invalid availability type'),
    body('zip_code').optional().matches(/^\d{5}(-\d{4})?$/).withMessage('ZIP code must be in format 12345 or 12345-6789'),
    body('radius_miles').optional().isInt({ min: 1, max: 500 }).withMessage('Radius must be between 1 and 500 miles'),
    body('alert_preferences').optional().isObject().withMessage('Alert preferences must be an object'),
    body('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
  ],
  validateRequest,
  WatchController.updateWatch
);

router.delete(
  '/:watchId',
  authenticate,
  [
    param('watchId').isUUID().withMessage('Watch ID must be a valid UUID')
  ],
  validateRequest,
  WatchController.deleteWatch
);

router.patch(
  '/:watchId/toggle',
  authenticate,
  [
    param('watchId').isUUID().withMessage('Watch ID must be a valid UUID')
  ],
  validateRequest,
  WatchController.toggleWatch
);

router.get(
  '/:watchId/health',
  authenticate,
  [
    param('watchId').isUUID().withMessage('Watch ID must be a valid UUID')
  ],
  validateRequest,
  WatchController.getWatchHealth
);

router.get(
  '/health/all',
  authenticate,
  WatchController.getUserWatchesHealth
);

router.get(
  '/metrics/performance',
  authenticate,
  WatchController.getWatchPerformanceMetrics
);

router.get(
  '/admin/health/system',
  authenticate,
  // TODO: Add admin middleware
  WatchController.getSystemWatchHealth
);

router.post(
  '/admin/cleanup',
  authenticate,
  // TODO: Add admin middleware
  WatchController.cleanupWatches
);

// Watch Pack routes
router.get(
  '/packs',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().isString().withMessage('Search must be a string')
  ],
  validateRequest,
  WatchPackController.getWatchPacks
);

router.get(
  '/packs/popular',
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ],
  validateRequest,
  WatchPackController.getPopularWatchPacks
);

router.get(
  '/packs/subscriptions',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
  ],
  validateRequest,
  WatchPackController.getUserSubscriptions
);

router.get(
  '/packs/subscriptions/detailed',
  authenticate,
  WatchPackController.getUserSubscriptionsWithPacks
);

router.get(
  '/packs/subscriptions/stats',
  authenticate,
  WatchPackController.getUserSubscriptionStats
);

router.get(
  '/packs/:packId',
  [
    param('packId').custom((value: any) => {
      // Allow either UUID or slug
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const slugRegex = /^[a-z0-9-]+$/;
      if (!uuidRegex.test(value) && !slugRegex.test(value)) {
        throw new Error('Pack ID must be a valid UUID or slug');
      }
      return true;
    })
  ],
  validateRequest,
  WatchPackController.getWatchPack
);

router.get(
  '/packs/:packId/stats',
  [
    param('packId').isUUID().withMessage('Pack ID must be a valid UUID')
  ],
  validateRequest,
  WatchPackController.getWatchPackStats
);

router.post(
  '/packs',
  authenticate,
  // TODO: Add admin authentication middleware
  [
    body('name').notEmpty().isLength({ min: 1, max: 100 }).withMessage('Name is required and must be 1-100 characters'),
    body('slug').notEmpty().matches(/^[a-z0-9-]+$/).withMessage('Slug is required and must contain only lowercase letters, numbers, and hyphens'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
    body('product_ids').isArray({ min: 1 }).withMessage('Product IDs array is required with at least one item'),
    body('product_ids.*').isUUID().withMessage('Each product ID must be a valid UUID'),
    body('auto_update').optional().isBoolean().withMessage('auto_update must be a boolean'),
    body('update_criteria').optional().isString().withMessage('update_criteria must be a string')
  ],
  validateRequest,
  WatchPackController.createWatchPack
);

router.put(
  '/packs/:packId',
  authenticate,
  // TODO: Add admin authentication middleware
  [
    param('packId').isUUID().withMessage('Pack ID must be a valid UUID'),
    body('name').optional().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
    body('product_ids').optional().isArray().withMessage('Product IDs must be an array'),
    body('product_ids.*').optional().isUUID().withMessage('Each product ID must be a valid UUID'),
    body('auto_update').optional().isBoolean().withMessage('auto_update must be a boolean'),
    body('update_criteria').optional().isString().withMessage('update_criteria must be a string'),
    body('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
  ],
  validateRequest,
  WatchPackController.updateWatchPack
);

router.delete(
  '/packs/:packId',
  authenticate,
  // TODO: Add admin authentication middleware
  [
    param('packId').isUUID().withMessage('Pack ID must be a valid UUID')
  ],
  validateRequest,
  WatchPackController.deleteWatchPack
);

router.post(
  '/packs/:packId/subscribe',
  authenticate,
  [
    param('packId').isUUID().withMessage('Pack ID must be a valid UUID'),
    body('customizations').optional().isObject().withMessage('Customizations must be an object')
  ],
  validateRequest,
  WatchPackController.subscribeToWatchPack
);

router.delete(
  '/packs/:packId/subscribe',
  authenticate,
  [
    param('packId').isUUID().withMessage('Pack ID must be a valid UUID'),
    body('remove_watches').optional().isBoolean().withMessage('remove_watches must be a boolean')
  ],
  validateRequest,
  WatchPackController.unsubscribeFromWatchPack
);

router.put(
  '/packs/:packId/customizations',
  authenticate,
  [
    param('packId').isUUID().withMessage('Pack ID must be a valid UUID'),
    body('customizations').isObject().withMessage('Customizations object is required')
  ],
  validateRequest,
  WatchPackController.updateSubscriptionCustomizations
);

router.get(
  '/products/:productId/packs',
  [
    param('productId').isUUID().withMessage('Product ID must be a valid UUID')
  ],
  validateRequest,
  WatchPackController.findPacksContainingProduct
);

export default router;