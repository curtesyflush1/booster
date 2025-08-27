import { Router } from 'express';
import { RetailerController } from '../controllers/retailerController';
import { authenticate } from '../middleware/auth';
import { createRateLimit } from '../middleware/rateLimiter';

const router = Router();
const retailerController = new RetailerController();

// Apply authentication middleware to all retailer routes
router.use(authenticate);

// Apply rate limiting to prevent abuse
router.use(createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many retailer API requests, please try again later'
}));

/**
 * @route GET /api/retailers/availability/:productId
 * @desc Check product availability across retailers
 * @access Private
 * @params productId - Product ID to check
 * @query sku - Product SKU (optional)
 * @query upc - Product UPC (optional)
 * @query zipCode - ZIP code for store availability (optional)
 * @query radiusMiles - Search radius in miles (optional)
 * @query retailers - Comma-separated list of retailer IDs (optional)
 */
router.get('/availability/:productId', retailerController.checkAvailability);

/**
 * @route GET /api/retailers/search
 * @desc Search products across retailers
 * @access Private
 * @query q - Search query (required)
 * @query retailers - Comma-separated list of retailer IDs (optional)
 */
router.get('/search', retailerController.searchProducts);

/**
 * @route GET /api/retailers/health
 * @desc Get health status of all retailers
 * @access Private
 */
router.get('/health', retailerController.getHealthStatus);

/**
 * @route GET /api/retailers/metrics
 * @desc Get performance metrics for all retailers
 * @access Private
 */
router.get('/metrics', retailerController.getMetrics);

/**
 * @route GET /api/retailers/config
 * @desc Get configuration for all retailers
 * @access Private
 */
router.get('/config', retailerController.getConfigurations);

/**
 * @route GET /api/retailers/:retailerId/config
 * @desc Get configuration for a specific retailer
 * @access Private
 * @params retailerId - Retailer ID
 */
router.get('/:retailerId/config', retailerController.getRetailerConfig);

/**
 * @route PUT /api/retailers/:retailerId/status
 * @desc Enable or disable a retailer
 * @access Private (Admin only)
 * @params retailerId - Retailer ID
 * @body isActive - Boolean to enable/disable retailer
 */
router.put('/:retailerId/status', retailerController.setRetailerStatus);

/**
 * @route POST /api/retailers/:retailerId/circuit-breaker/reset
 * @desc Reset circuit breaker for a retailer
 * @access Private (Admin only)
 * @params retailerId - Retailer ID
 */
router.post('/:retailerId/circuit-breaker/reset', retailerController.resetCircuitBreaker);

export default router;