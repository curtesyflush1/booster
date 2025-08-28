import { Request, Response, NextFunction } from 'express';
import { ProductCategory } from '../models/ProductCategory';
import { logger } from '../utils/logger';
import { IProductCategory } from '../types/database';

/**
 * Get all categories with hierarchy
 * Validation handled by middleware
 */
export const getAllCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const includeProductCount = req.query.include_product_count === 'true';
    const asTree = req.query.as_tree === 'true';

    let categories;

    if (includeProductCount) {
      categories = await ProductCategory.getCategoriesWithProductCount();
    } else if (asTree) {
      categories = await ProductCategory.getCategoryTree();
    } else {
      categories = await ProductCategory.getAllWithHierarchy();
    }

    res.status(200).json({
      categories
    });
  } catch (error) {
    logger.error('Error retrieving categories', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
};

/**
 * Get category by ID
 * Validation handled by middleware
 */
export const getCategoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const category = await ProductCategory.findById<IProductCategory>(id);
    if (!category) {
      res.status(404).json({
        error: {
          code: 'CATEGORY_NOT_FOUND',
          message: 'Category not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Get additional data if requested
    const includeChildren = req.query.include_children === 'true';
    const includePath = req.query.include_path === 'true';

    let responseData: any = { category };

    if (includeChildren) {
      const children = await ProductCategory.getChildCategories(id);
      responseData.children = children;
    }

    if (includePath) {
      const path = await ProductCategory.getCategoryPath(id);
      responseData.path = path;
    }

    res.status(200).json(responseData);
  } catch (error) {
    logger.error('Error retrieving category', {
      error: error instanceof Error ? error.message : 'Unknown error',
      categoryId: req.params.id
    });
    next(error);
  }
};

/**
 * Get category by slug
 */
export const getCategoryBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { slug } = req.params;
    if (!slug) {
      res.status(400).json({
        error: {
          code: 'MISSING_SLUG',
          message: 'Category slug is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const category = await ProductCategory.findBySlug(slug);
    if (!category) {
      res.status(404).json({
        error: {
          code: 'CATEGORY_NOT_FOUND',
          message: 'Category not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Get additional data if requested
    const includeChildren = req.query.include_children === 'true';
    const includePath = req.query.include_path === 'true';

    let responseData: any = { category };

    if (includeChildren) {
      const children = await ProductCategory.getChildCategories(category.id);
      responseData.children = children;
    }

    if (includePath) {
      const path = await ProductCategory.getCategoryPath(category.id);
      responseData.path = path;
    }

    logger.info('Category viewed by slug', { slug, categoryId: category.id });

    res.status(200).json(responseData);
  } catch (error) {
    logger.error('Error retrieving category by slug', {
      error: error instanceof Error ? error.message : 'Unknown error',
      slug: req.params.slug
    });
    next(error);
  }
};

/**
 * Get root categories
 */
export const getRootCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await ProductCategory.getRootCategories();

    res.status(200).json({
      categories
    });
  } catch (error) {
    logger.error('Error retrieving root categories', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
};

/**
 * Get child categories
 */
export const getChildCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { parentId } = req.params;
    if (!parentId) {
      res.status(400).json({
        error: {
          code: 'MISSING_PARENT_ID',
          message: 'Parent category ID is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const categories = await ProductCategory.getChildCategories(parentId);

    res.status(200).json({
      categories
    });
  } catch (error) {
    logger.error('Error retrieving child categories', {
      error: error instanceof Error ? error.message : 'Unknown error',
      parentId: req.params.parentId
    });
    next(error);
  }
};

/**
 * Get category tree
 */
export const getCategoryTree = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categoryId = req.query.category_id as string;
    
    const tree = await ProductCategory.getCategoryTree(categoryId);

    res.status(200).json({
      tree
    });
  } catch (error) {
    logger.error('Error retrieving category tree', {
      error: error instanceof Error ? error.message : 'Unknown error',
      categoryId: req.query.category_id
    });
    next(error);
  }
};

/**
 * Get category path (breadcrumb)
 */
export const getCategoryPath = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        error: {
          code: 'MISSING_CATEGORY_ID',
          message: 'Category ID is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const path = await ProductCategory.getCategoryPath(id);

    res.status(200).json({
      path
    });
  } catch (error) {
    logger.error('Error retrieving category path', {
      error: error instanceof Error ? error.message : 'Unknown error',
      categoryId: req.params.id
    });
    next(error);
  }
};

/**
 * Get category statistics
 */
export const getCategoryStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await ProductCategory.getCategoryStats();

    res.status(200).json({
      stats
    });
  } catch (error) {
    logger.error('Error retrieving category statistics', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
};