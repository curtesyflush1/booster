import { Router } from 'express';
import { RetailerController } from '../controllers/retailerController';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';
import { URLPatternController } from '../controllers/urlPatternController';
import { createRateLimit } from '../middleware/rateLimiter';
import { sanitizeParameters } from '../middleware/parameterSanitization';

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
 * @route GET /api/retailers
 * @desc Get all retailers
 * @access Public
 */
router.get('/', retailerController.getAllRetailers);

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
router.get('/availability/:productId', sanitizeParameters, retailerController.checkAvailability);

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
router.get('/:retailerId/config', sanitizeParameters, retailerController.getRetailerConfig);

/**
 * @route PUT /api/retailers/:retailerId/status
 * @desc Enable or disable a retailer
 * @access Private (Admin only)
 * @params retailerId - Retailer ID
 * @body isActive - Boolean to enable/disable retailer
 */
router.put('/:retailerId/status', sanitizeParameters, retailerController.setRetailerStatus);

/**
 * @route POST /api/retailers/:retailerId/circuit-breaker/reset
 * @desc Reset circuit breaker for a retailer
 * @access Private (Admin only)
 * @params retailerId - Retailer ID
 */
router.post('/:retailerId/circuit-breaker/reset', sanitizeParameters, retailerController.resetCircuitBreaker);

/**
 * @route GET /api/retailers/candidates
 * @desc Generate current URL candidates (admin/debug)
 * @access Private (Admin only)
 * @query product_id (uuid) - required
 * @query retailer (slug) - required
 * @query sku|upc|name|set_name - optional hints
 */
router.get('/candidates', requireAdmin, sanitizeParameters, URLPatternController.getCandidates);

/**
 * @route GET /api/retailers/url-candidates
 * @desc List URL candidates by product/retailer/status (admin)
 * @access Private (Admin only)
 * @query product_id (uuid), retailer (slug or uuid), status (unknown|valid|invalid|live), limit (<=200)
 */
router.get('/url-candidates', requireAdmin, sanitizeParameters, URLPatternController.listCandidates);

export default router;
