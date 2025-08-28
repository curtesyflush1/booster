import { Router } from 'express';
import { WatchController } from '../controllers/watchController';
import { WatchPackController } from '../controllers/watchPackController';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';
import { validateJoi, validateJoiBody, validateJoiQuery, validateJoiParams, watchSchemas, watchPackSchemas } from '../validators';
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
  validateJoiQuery(watchSchemas.getUserWatches.query),
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
  validateJoiQuery(watchSchemas.exportWatches.query),
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
  validateJoiParams(watchSchemas.getById.params),
  WatchController.getWatch
);

router.post(
  '/',
  authenticate,
  validateJoiBody(watchSchemas.create),
  WatchController.createWatch
);

router.put(
  '/:watchId',
  authenticate,
  validateJoi({
    params: watchSchemas.update.params,
    body: watchSchemas.update.body
  }),
  WatchController.updateWatch
);

router.delete(
  '/:watchId',
  authenticate,
  validateJoiParams(watchSchemas.deleteWatch.params),
  WatchController.deleteWatch
);

router.patch(
  '/:watchId/toggle',
  authenticate,
  validateJoiParams(watchSchemas.toggleWatch.params),
  WatchController.toggleWatch
);

router.get(
  '/:watchId/health',
  authenticate,
  validateJoiParams(watchSchemas.getWatchHealth.params),
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
  requireAdmin,
  WatchController.getSystemWatchHealth
);

router.post(
  '/admin/cleanup',
  authenticate,
  requireAdmin,
  WatchController.cleanupWatches
);

// Watch Pack routes
router.get(
  '/packs',
  validateJoiQuery(watchPackSchemas.getWatchPacks.query),
  WatchPackController.getWatchPacks
);

router.get(
  '/packs/popular',
  validateJoiQuery(watchPackSchemas.getPopularWatchPacks.query),
  WatchPackController.getPopularWatchPacks
);

router.get(
  '/packs/subscriptions',
  authenticate,
  validateJoiQuery(watchPackSchemas.getUserSubscriptions.query),
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
  validateJoiParams(watchPackSchemas.getWatchPack.params),
  WatchPackController.getWatchPack
);

router.get(
  '/packs/:packId/stats',
  validateJoiParams(watchPackSchemas.getWatchPackStats.params),
  WatchPackController.getWatchPackStats
);

router.post(
  '/packs',
  authenticate,
  requireAdmin,
  validateJoiBody(watchPackSchemas.createWatchPack.body),
  WatchPackController.createWatchPack
);

router.put(
  '/packs/:packId',
  authenticate,
  requireAdmin,
  validateJoi({
    params: watchPackSchemas.updateWatchPack.params,
    body: watchPackSchemas.updateWatchPack.body
  }),
  WatchPackController.updateWatchPack
);

router.delete(
  '/packs/:packId',
  authenticate,
  requireAdmin,
  validateJoiParams(watchPackSchemas.deleteWatchPack.params),
  WatchPackController.deleteWatchPack
);

router.post(
  '/packs/:packId/subscribe',
  authenticate,
  validateJoi({
    params: watchPackSchemas.subscribeToWatchPack.params,
    body: watchPackSchemas.subscribeToWatchPack.body
  }),
  WatchPackController.subscribeToWatchPack
);

router.delete(
  '/packs/:packId/subscribe',
  authenticate,
  validateJoi({
    params: watchPackSchemas.unsubscribeFromWatchPack.params,
    body: watchPackSchemas.unsubscribeFromWatchPack.body
  }),
  WatchPackController.unsubscribeFromWatchPack
);

router.put(
  '/packs/:packId/customizations',
  authenticate,
  validateJoi({
    params: watchPackSchemas.updateSubscriptionCustomizations.params,
    body: watchPackSchemas.updateSubscriptionCustomizations.body
  }),
  WatchPackController.updateSubscriptionCustomizations
);

router.get(
  '/products/:productId/packs',
  validateJoiParams(watchPackSchemas.findPacksContainingProduct.params),
  WatchPackController.findPacksContainingProduct
);

export default router;