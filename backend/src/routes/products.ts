import { Router } from 'express';
import * as productController from '../controllers/productController';
import * as categoryController from '../controllers/categoryController';
import { generalRateLimit } from '../middleware/rateLimiter';

const router = Router();

// Product search and catalog endpoints
/**
 * @route   GET /api/products/search
 * @desc    Search products with advanced filtering
 * @access  Public
 */
router.get('/search', generalRateLimit, productController.searchProducts);

/**
 * @route   GET /api/products/barcode
 * @desc    Lookup product by UPC barcode
 * @access  Public
 */
router.get('/barcode', generalRateLimit, productController.lookupByBarcode);

/**
 * @route   GET /api/products/popular
 * @desc    Get popular products
 * @access  Public
 */
router.get('/popular', productController.getPopularProducts);

/**
 * @route   GET /api/products/recent
 * @desc    Get recently released products
 * @access  Public
 */
router.get('/recent', productController.getRecentProducts);

/**
 * @route   GET /api/products/upcoming
 * @desc    Get upcoming products
 * @access  Public
 */
router.get('/upcoming', productController.getUpcomingProducts);

/**
 * @route   GET /api/products/stats
 * @desc    Get product statistics
 * @access  Public
 */
router.get('/stats', productController.getProductStats);

/**
 * @route   GET /api/products/category/:categoryId
 * @desc    Get products by category
 * @access  Public
 */
router.get('/category/:categoryId', productController.getProductsByCategory);

/**
 * @route   GET /api/products/set/:setName
 * @desc    Get products by set name
 * @access  Public
 */
router.get('/set/:setName', productController.getProductsBySet);

/**
 * @route   GET /api/products/:id
 * @desc    Get product by ID with availability
 * @access  Public
 */
router.get('/:id', productController.getProductById);

/**
 * @route   GET /api/products/:id/price-history
 * @desc    Get product pricing history
 * @access  Public
 */
router.get('/:id/price-history', productController.getProductPriceHistory);

/**
 * @route   GET /api/products/slug/:slug
 * @desc    Get product by slug
 * @access  Public
 */
router.get('/slug/:slug', productController.getProductBySlug);

// Category endpoints
/**
 * @route   GET /api/products/categories
 * @desc    Get all categories
 * @access  Public
 */
router.get('/categories', categoryController.getAllCategories);

/**
 * @route   GET /api/products/categories/root
 * @desc    Get root categories
 * @access  Public
 */
router.get('/categories/root', categoryController.getRootCategories);

/**
 * @route   GET /api/products/categories/tree
 * @desc    Get category tree
 * @access  Public
 */
router.get('/categories/tree', categoryController.getCategoryTree);

/**
 * @route   GET /api/products/categories/stats
 * @desc    Get category statistics
 * @access  Public
 */
router.get('/categories/stats', categoryController.getCategoryStats);

/**
 * @route   GET /api/products/categories/:id
 * @desc    Get category by ID
 * @access  Public
 */
router.get('/categories/:id', categoryController.getCategoryById);

/**
 * @route   GET /api/products/categories/:id/path
 * @desc    Get category path (breadcrumb)
 * @access  Public
 */
router.get('/categories/:id/path', categoryController.getCategoryPath);

/**
 * @route   GET /api/products/categories/:parentId/children
 * @desc    Get child categories
 * @access  Public
 */
router.get('/categories/:parentId/children', categoryController.getChildCategories);

/**
 * @route   GET /api/products/categories/slug/:slug
 * @desc    Get category by slug
 * @access  Public
 */
router.get('/categories/slug/:slug', categoryController.getCategoryBySlug);

export default router;