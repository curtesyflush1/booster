/**
 * KMS Routes
 * 
 * This module defines the routes for Key Management Service operations.
 * All routes require admin authentication and appropriate permissions.
 */

import { Router } from 'express';
import { KMSController } from '../controllers/kmsController';
import { requireAdmin } from '../middleware/adminAuth';
import { createRateLimit } from '../middleware/rateLimiter';

const router = Router();
const kmsController = new KMSController();

// Apply admin authentication to all KMS routes
router.use(requireAdmin);

// Apply rate limiting to prevent abuse
router.use(createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50, // Limit each IP to 50 requests per windowMs
  message: 'Too many KMS requests from this IP, please try again later.'
}));

/**
 * @route GET /api/admin/kms/health
 * @desc Get KMS service health status
 * @access Admin
 */
router.get('/health', kmsController.getHealthStatus.bind(kmsController));

/**
 * @route GET /api/admin/kms/key/metadata
 * @desc Get encryption key metadata
 * @access Admin
 */
router.get('/key/metadata', kmsController.getKeyMetadata.bind(kmsController));

/**
 * @route POST /api/admin/kms/key/rotate
 * @desc Rotate the encryption key
 * @access Admin
 */
router.post('/key/rotate', kmsController.rotateKey.bind(kmsController));

/**
 * @route POST /api/admin/kms/key/create
 * @desc Create a new encryption key
 * @access Admin
 */
router.post('/key/create', kmsController.createKey.bind(kmsController));

/**
 * @route GET /api/admin/kms/config
 * @desc Get current KMS configuration
 * @access Admin
 */
router.get('/config', kmsController.getConfiguration.bind(kmsController));

/**
 * @route POST /api/admin/kms/config/test
 * @desc Test KMS configuration
 * @access Admin
 */
router.post('/config/test', kmsController.testConfiguration.bind(kmsController));

/**
 * @route PUT /api/admin/kms/config
 * @desc Update KMS configuration
 * @access Admin
 */
router.put('/config', kmsController.updateConfiguration.bind(kmsController));

export default router;