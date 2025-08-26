import { Router } from 'express';
import { validate } from '../middleware/validationMiddleware';
import { productValidationSchemas } from '../validators/productValidators';
import * as productController from '../controllers/productController';

const router = Router();

// Search products with advanced filtering
router.get(
  '/search',
  validate(productValidationSchemas.searchProducts),
  productController.searchProducts
);

// Get product by ID
router.get(
  '/:id',
  validate(productValidationSchemas.productById),
  productController.getProductById
);

// Get product by slug
router.get(
  '/slug/:slug',
  validate(productValidationSchemas.productBySlug),
  productController.getProductBySlug
);

// Barcode lookup
router.get(
  '/barcode/lookup',
  validate(productValidationSchemas.barcodeSearch),
  productController.lookupByBarcode
);

// Get popular products
router.get(
  '/lists/popular',
  validate(productValidationSchemas.popularProducts),
  productController.getPopularProducts
);

// Get recent products
router.get(
  '/lists/recent',
  validate(productValidationSchemas.popularProducts), // Same schema
  productController.getRecentProducts
);

// Get upcoming products
router.get(
  '/lists/upcoming',
  validate(productValidationSchemas.popularProducts), // Same schema
  productController.getUpcomingProducts
);

// Get products by category
router.get(
  '/category/:categoryId',
  validate(productValidationSchemas.productsByCategory),
  productController.getProductsByCategory
);

// Get products by set
router.get(
  '/set/:setName',
  validate(productValidationSchemas.productsBySet),
  productController.getProductsBySet
);

// Get product price history
router.get(
  '/:id/price-history',
  validate(productValidationSchemas.priceHistory),
  productController.getProductPriceHistory
);

// Get product statistics
router.get(
  '/admin/stats',
  productController.getProductStats
);

export default router;