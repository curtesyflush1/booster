import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product';
import { logger } from '../utils/logger';
import { ResponseHelper } from '../utils/responseHelpers';
import { analyticsService } from '../services/analyticsService';
import { IProduct } from '../types/database';

/**
 * Search products with advanced filtering
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
    } = req.query as any; // Validation handled by middleware

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
      totalResults: results.total
    });

    ResponseHelper.successWithPagination(res, results.data, {
      page: results.page,
      limit: results.limit,
      total: results.total
    });
  } catch (error) {
    logger.error('Error searching products', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: req.query
    });
    next(error);
  }
};

/**
 * Get product by ID with availability information
 */
export const getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params; // Validation handled by middleware
    
    // TypeScript assertion: validation middleware ensures id exists
    if (!id) {
      ResponseHelper.badRequest(res, 'Product ID is required');
      return;
    }

    const product = await Product.getProductWithAvailability(id);
    if (!product) {
      ResponseHelper.notFound(res, 'Product');
      return;
    }

    // Track product view for analytics
    analyticsService.trackProductView(id, { source: 'api' });

    logger.info('Product viewed', { productId: id, productName: product.name });

    ResponseHelper.success(res, { product });
  } catch (error) {
    logger.error('Error retrieving product', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId: req.params.id
    });
    next(error);
  }
};

/**
 * Get product by slug
 */
export const getProductBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { slug } = req.params; // Validation handled by middleware
    
    if (!slug) {
      ResponseHelper.badRequest(res, 'Product slug is required');
      return;
    }

    const product = await Product.findBySlug(slug);
    if (!product) {
      ResponseHelper.notFound(res, 'Product');
      return;
    }

    const productWithAvailability = await Product.getProductWithAvailability(product.id);

    // Track product view for analytics
    analyticsService.trackProductView(product.id, { source: 'slug', slug });

    logger.info('Product viewed by slug', { slug, productId: product.id });

    ResponseHelper.success(res, { product: productWithAvailability });
  } catch (error) {
    logger.error('Error retrieving product by slug', {
      error: error instanceof Error ? error.message : 'Unknown error',
      slug: req.params.slug
    });
    next(error);
  }
};

/**
 * Barcode lookup for UPC-to-product mapping
 */
export const lookupByBarcode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { upc } = req.query as { upc: string }; // Validation handled by middleware

    const product = await Product.findByUPC(upc);
    if (!product) {
      ResponseHelper.error(res, 'PRODUCT_NOT_FOUND', 'No product found for this UPC code', 404);
      return;
    }

    const productWithAvailability = await Product.getProductWithAvailability(product.id);

    // Track barcode scan for analytics (higher weight)
    analyticsService.trackProductScan(product.id, { upc });

    logger.info('Product found by UPC', { upc, productId: product.id, productName: product.name });

    ResponseHelper.success(res, { product: productWithAvailability });
  } catch (error) {
    logger.error('Error looking up product by UPC', {
      error: error instanceof Error ? error.message : 'Unknown error',
      upc: req.query.upc
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
 */
export const getProductsByCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { categoryId } = req.params; // Validation handled by middleware
    
    if (!categoryId) {
      ResponseHelper.badRequest(res, 'Category ID is required');
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

    ResponseHelper.successWithPagination(res, results.data, {
      page: results.page,
      limit: results.limit,
      total: results.total
    });
  } catch (error) {
    logger.error('Error retrieving products by category', {
      error: error instanceof Error ? error.message : 'Unknown error',
      categoryId: req.params.categoryId
    });
    next(error);
  }
};

/**
 * Get products by set name
 */
export const getProductsBySet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { setName } = req.params; // Validation handled by middleware
    
    if (!setName) {
      ResponseHelper.badRequest(res, 'Set name is required');
      return;
    }

    const products = await Product.findBySet(decodeURIComponent(setName));

    ResponseHelper.success(res, { products });
  } catch (error) {
    logger.error('Error retrieving products by set', {
      error: error instanceof Error ? error.message : 'Unknown error',
      setName: req.params.setName
    });
    next(error);
  }
};

/**
 * Get product pricing history
 */
export const getProductPriceHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params; // Validation handled by middleware
    
    if (!id) {
      ResponseHelper.badRequest(res, 'Product ID is required');
      return;
    }
    
    const { days, retailer_id } = req.query as { days?: string; retailer_id?: string };

    const priceHistory = await Product.getPriceHistory(
      id, 
      Math.min(parseInt(days || '30'), 365), 
      retailer_id
    );

    ResponseHelper.success(res, { priceHistory });
  } catch (error) {
    logger.error('Error retrieving product price history', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId: req.params.id
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