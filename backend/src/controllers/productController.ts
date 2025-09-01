import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product';
import { logger } from '../utils/logger';
import { ResponseHelper } from '../utils/responseHelpers';
import { analyticsService } from '../services/analyticsService';
import { IProduct } from '../types/database';
import { STRING_LIMITS, HTTP_STATUS, BARCODE_LIMITS, VALIDATION_PATTERNS } from '../constants';

/**
 * Search products with advanced filtering
 * Validation and sanitization handled by middleware
 */
export const searchProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      q: searchTerm,
      category_id,
      set_name,
      series,
      retailer_id,
      min_price,
      max_price,
      availability,
      is_active = true,
      page,
      limit,
      sort_by,
      sort_order
    } = req.query as any;

    // Additional validation for sanitized parameters
    if (searchTerm && typeof searchTerm === 'string' && searchTerm.length > STRING_LIMITS.SEARCH_TERM_MAX) {
      ResponseHelper.error(res, 'INVALID_SEARCH_TERM', 'Search term is too long', HTTP_STATUS.BAD_REQUEST);
      return;
    }

    if (set_name && typeof set_name === 'string' && set_name.length > STRING_LIMITS.PRODUCT_SET_NAME_MAX) {
      ResponseHelper.error(res, 'INVALID_SET_NAME', 'Set name is too long', HTTP_STATUS.BAD_REQUEST);
      return;
    }

    if (series && typeof series === 'string' && series.length > STRING_LIMITS.PRODUCT_SERIES_MAX) {
      ResponseHelper.error(res, 'INVALID_SERIES', 'Series name is too long', HTTP_STATUS.BAD_REQUEST);
      return;
    }

    const searchOptions = {
      category_id,
      set_name,
      series,
      retailer_id,
      min_price,
      max_price,
      availability,
      is_active,
      page,
      limit,
      sort_by,
      sort_order
    };

    const results = await Product.searchWithFilters(searchTerm || '', searchOptions);

    // Track search analytics
    analyticsService.trackProductSearch(searchTerm || '', results.data.length);
    
    logger.info('Product search performed', {
      searchTerm,
      filters: searchOptions,
      resultCount: results.data.length,
      totalResults: results.total,
      correlationId: req.correlationId
    });

    ResponseHelper.successWithPagination(res, results.data, {
      page: results.page,
      limit: results.limit,
      total: results.total
    });
  } catch (error) {
    logger.error('Error searching products', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: req.query,
      correlationId: req.correlationId
    });
    next(error);
  }
};

/**
 * Get product by ID with availability information
 * Validation and sanitization handled by middleware
 */
export const getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    // Additional validation for sanitized UUID
    if (!id || id.trim().length === 0) {
      ResponseHelper.error(res, 'INVALID_PRODUCT_ID', 'Product ID cannot be empty', HTTP_STATUS.BAD_REQUEST);
      return;
    }

    const product = await Product.getProductWithAvailability(id);
    if (!product) {
      ResponseHelper.notFound(res, 'Product');
      return;
    }

    // Track product view for analytics
    analyticsService.trackProductView(id, { source: 'api' });

    logger.info('Product viewed', { 
      productId: id, 
      productName: product.name,
      correlationId: req.correlationId 
    });

    ResponseHelper.success(res, { product });
  } catch (error) {
    logger.error('Error retrieving product', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId: req.params.id,
      correlationId: req.correlationId
    });
    next(error);
  }
};

/**
 * Batch fetch products by IDs (with availability)
 * Accepts body: { ids: string[] }
 */
export const getProductsByIds = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      ResponseHelper.badRequest(res, 'ids array is required');
      return;
    }

    // Basic UUID format check and limit
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const uniqueIds = Array.from(new Set(ids)).filter((id: any) => typeof id === 'string' && uuidRegex.test(id));
    if (uniqueIds.length === 0) {
      ResponseHelper.badRequest(res, 'No valid UUIDs provided');
      return;
    }
    if (uniqueIds.length > 200) {
      ResponseHelper.badRequest(res, 'Too many IDs requested (max 200)');
      return;
    }

    const products = await Product.findByIdsWithAvailability(uniqueIds);
    ResponseHelper.success(res, { products });
  } catch (error) {
    logger.error('Error in getProductsByIds', {
      error: error instanceof Error ? error.message : 'Unknown error',
      count: Array.isArray((req.body || {}).ids) ? (req.body as any).ids.length : 0,
    });
    next(error);
  }
};

/**
 * Get product by slug
 * Validation and sanitization handled by middleware
 */
export const getProductBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { slug } = req.params;

    // Additional validation for sanitized slug
    if (!slug || slug.trim().length === 0) {
      ResponseHelper.error(res, 'INVALID_SLUG', 'Slug cannot be empty', 400);
      return;
    }

    if (slug.length > 100) {
      ResponseHelper.error(res, 'INVALID_SLUG', 'Slug is too long', 400);
      return;
    }

    // Use optimized single-query method that combines product and availability lookup
    const productWithAvailability = await Product.getProductWithAvailabilityBySlug(slug);
    if (!productWithAvailability) {
      ResponseHelper.notFound(res, 'Product');
      return;
    }

    // Track product view for analytics
    analyticsService.trackProductView(productWithAvailability.id, { source: 'slug', slug });

    logger.info('Product viewed by slug', { 
      slug, 
      productId: productWithAvailability.id,
      correlationId: req.correlationId 
    });

    ResponseHelper.success(res, { product: productWithAvailability });
  } catch (error) {
    logger.error('Error retrieving product by slug', {
      error: error instanceof Error ? error.message : 'Unknown error',
      slug: req.params.slug,
      correlationId: req.correlationId
    });
    next(error);
  }
};

/**
 * Barcode lookup for UPC-to-product mapping
 * Validation and sanitization handled by middleware
 */
export const lookupByBarcode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { upc } = req.query as { upc: string };

    // Additional validation for sanitized UPC
    if (!upc || upc.trim().length === 0) {
      ResponseHelper.error(res, 'INVALID_UPC', 'UPC cannot be empty', 400);
      return;
    }

    // UPC should be 8-14 digits after sanitization
    if (!/^\d{8,14}$/.test(upc)) {
      ResponseHelper.error(res, 'INVALID_UPC', 'UPC must be 8-14 digits', 400);
      return;
    }

    const product = await Product.findByUPC(upc);
    if (!product) {
      ResponseHelper.error(res, 'PRODUCT_NOT_FOUND', 'No product found for this UPC code', 404);
      return;
    }

    // Use optimized single-query method for getting product with availability
    const productWithAvailability = await Product.getProductWithAvailability(product.id);

    // Track barcode scan for analytics (higher weight)
    analyticsService.trackProductScan(product.id, { upc });

    logger.info('Product found by UPC', { 
      upc, 
      productId: product.id, 
      productName: product.name,
      correlationId: req.correlationId 
    });

    ResponseHelper.success(res, { product: productWithAvailability });
  } catch (error) {
    logger.error('Error looking up product by UPC', {
      error: error instanceof Error ? error.message : 'Unknown error',
      upc: req.query.upc,
      correlationId: req.correlationId
    });
    next(error);
  }
};

/**
 * Get popular products
 */
export const getPopularProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { limit, category_id } = req.query as { limit?: string; category_id?: string };
    
    const products = await Product.getPopularProducts(
      Math.min(parseInt(limit || '10'), 50), 
      category_id
    );

    ResponseHelper.success(res, { products });
  } catch (error) {
    logger.error('Error retrieving popular products', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
};

/**
 * Get recently released products
 */
export const getRecentProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { limit, category_id } = req.query as { limit?: string; category_id?: string };

    const products = await Product.getRecentProducts(
      Math.min(parseInt(limit || '10'), 50), 
      category_id
    );

    ResponseHelper.success(res, { products });
  } catch (error) {
    logger.error('Error retrieving recent products', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
};

/**
 * Get upcoming products
 */
export const getUpcomingProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { limit, category_id } = req.query as { limit?: string; category_id?: string };

    const products = await Product.getUpcomingProducts(
      Math.min(parseInt(limit || '10'), 50), 
      category_id
    );

    ResponseHelper.success(res, { products });
  } catch (error) {
    logger.error('Error retrieving upcoming products', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
};

/**
 * Get products by category
 * Validation and sanitization handled by middleware
 */
export const getProductsByCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { categoryId } = req.params;
    
    // Additional validation for sanitized category ID
    if (!categoryId || categoryId.trim().length === 0) {
      ResponseHelper.error(res, 'INVALID_CATEGORY_ID', 'Category ID cannot be empty', 400);
      return;
    }
    
    const { page, limit, is_active } = req.query as { 
      page?: string; 
      limit?: string; 
      is_active?: string; 
    };

    const results = await Product.findByCategory(categoryId, {
      is_active: is_active !== 'false',
      page: Math.max(parseInt(page || '1'), 1),
      limit: Math.min(parseInt(limit || '20'), 100)
    });

    logger.info('Products retrieved by category', {
      categoryId,
      productCount: results.data.length,
      page: results.page,
      correlationId: req.correlationId
    });

    ResponseHelper.successWithPagination(res, results.data, {
      page: results.page,
      limit: results.limit,
      total: results.total
    });
  } catch (error) {
    logger.error('Error retrieving products by category', {
      error: error instanceof Error ? error.message : 'Unknown error',
      categoryId: req.params.categoryId,
      correlationId: req.correlationId
    });
    next(error);
  }
};

/**
 * Get products by set name
 * Validation and sanitization handled by middleware
 */
export const getProductsBySet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { setName } = req.params;

    // Parameter is already sanitized by middleware, no need for decodeURIComponent
    // Additional validation to ensure setName is safe for database query
    if (!setName || setName.trim().length === 0) {
      ResponseHelper.error(res, 'INVALID_SET_NAME', 'Set name cannot be empty', 400);
      return;
    }

    if (setName.length > 100) {
      ResponseHelper.error(res, 'INVALID_SET_NAME', 'Set name is too long', 400);
      return;
    }

    const products = await Product.findBySet(setName);

    logger.info('Products retrieved by set', { 
      setName, 
      productCount: products.data.length,
      totalProducts: products.total,
      correlationId: req.correlationId 
    });

    ResponseHelper.success(res, { products });
  } catch (error) {
    logger.error('Error retrieving products by set', {
      error: error instanceof Error ? error.message : 'Unknown error',
      setName: req.params.setName,
      correlationId: req.correlationId
    });
    next(error);
  }
};

/**
 * Get product pricing history
 * Validation and sanitization handled by middleware
 */
export const getProductPriceHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Additional validation for sanitized product ID
    if (!id || id.trim().length === 0) {
      ResponseHelper.error(res, 'INVALID_PRODUCT_ID', 'Product ID cannot be empty', 400);
      return;
    }
    
    const { days, retailer_id } = req.query as { days?: string; retailer_id?: string };

    // Validate retailer_id if provided (already sanitized by middleware)
    if (retailer_id && retailer_id.trim().length === 0) {
      ResponseHelper.error(res, 'INVALID_RETAILER_ID', 'Retailer ID cannot be empty', 400);
      return;
    }

    const priceHistory = await Product.getPriceHistory(
      id, 
      Math.min(parseInt(days || '30'), 365), 
      retailer_id
    );

    logger.info('Product price history retrieved', {
      productId: id,
      days: days || '30',
      retailerId: retailer_id,
      historyCount: priceHistory.length,
      correlationId: req.correlationId
    });

    ResponseHelper.success(res, { priceHistory });
  } catch (error) {
    logger.error('Error retrieving product price history', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId: req.params.id,
      correlationId: req.correlationId
    });
    next(error);
  }
};

/**
 * Get product statistics
 */
export const getProductStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await Product.getProductStats();

    ResponseHelper.success(res, { stats });
  } catch (error) {
    logger.error('Error retrieving product statistics', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
};
