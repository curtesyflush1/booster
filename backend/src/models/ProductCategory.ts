import { BaseModel } from './BaseModel';
import { IProductCategory, IValidationError, IPaginatedResult } from '../types/database';
import { safeCount } from '../utils/database';
import { handleDatabaseError } from '../config/database';
import { logger } from '../utils/logger';

export class ProductCategory extends BaseModel<IProductCategory> {
  protected static override tableName = 'product_categories';

  // Validation rules for category data
  validate(data: Partial<IProductCategory>): IValidationError[] {
    const errors: IValidationError[] = [];

    // Name validation
    if (data.name !== undefined) {
      const nameError = ProductCategory.validateRequired(data.name, 'name') ||
        ProductCategory.validateLength(data.name, 'name', 1, 255);
      if (nameError) errors.push(nameError);
    }

    // Slug validation
    if (data.slug !== undefined) {
      const slugError = ProductCategory.validateRequired(data.slug, 'slug') ||
        ProductCategory.validateLength(data.slug, 'slug', 1, 255);
      if (slugError) errors.push(slugError);

      // Slug format validation (lowercase, hyphens, alphanumeric)
      if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) {
        errors.push({
          field: 'slug',
          message: 'Slug must contain only lowercase letters, numbers, and hyphens',
          value: data.slug
        });
      }
    }

    // Description validation
    if (data.description !== undefined && data.description !== null) {
      const descError = ProductCategory.validateLength(data.description, 'description', 0, 1000);
      if (descError) errors.push(descError);
    }

    // Sort order validation
    if (data.sort_order !== undefined) {
      const sortError = ProductCategory.validateNumeric(data.sort_order, 'sort_order', 0, 9999);
      if (sortError) errors.push(sortError);
    }

    return errors;
  }

  // Sanitize category input
  sanitize(data: Partial<IProductCategory>): Partial<IProductCategory> {
    const sanitized: Partial<IProductCategory> = { ...data };

    // Trim string fields
    if (sanitized.name) {
      sanitized.name = sanitized.name.trim();
    }
    if (sanitized.slug) {
      sanitized.slug = sanitized.slug.trim().toLowerCase();
    }
    if (sanitized.description) {
      sanitized.description = sanitized.description.trim();
    }

    // Set default values
    if (sanitized.sort_order === undefined) {
      sanitized.sort_order = 0;
    }

    return sanitized;
  }

  // Create category with validation
  static async createCategory(categoryData: Partial<IProductCategory>): Promise<IProductCategory> {
    const category = new ProductCategory();
    const sanitizedData = category.sanitize(categoryData);

    // Validate the data
    const errors = category.validate(sanitizedData);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    }

    return this.create<IProductCategory>(sanitizedData);
  }

  // Find category by slug
  static async findBySlug(slug: string): Promise<IProductCategory | null> {
    return this.findOneBy<IProductCategory>({ slug: slug.toLowerCase() });
  }

  // Get all categories with hierarchy
  static async getAllWithHierarchy(): Promise<IProductCategory[]> {
    try {
      const categories = await this.db(this.getTableName())
        .orderBy('sort_order', 'asc')
        .orderBy('name', 'asc');

      return categories;
    } catch (error) {
      logger.error(`Error getting categories with hierarchy:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Get root categories (no parent)
  static async getRootCategories(): Promise<IProductCategory[]> {
    return this.db(this.getTableName())
      .whereNull('parent_id')
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc');
  }

  // Get child categories
  static async getChildCategories(parentId: string): Promise<IProductCategory[]> {
    return this.findBy<IProductCategory>({ parent_id: parentId });
  }

  // Get category tree starting from a specific category
  static async getCategoryTree(categoryId?: string): Promise<any[]> {
    try {
      let categories: IProductCategory[];
      
      if (categoryId) {
        // Get specific category and its children
        categories = await this.db(this.getTableName())
          .where('id', categoryId)
          .orWhere('parent_id', categoryId)
          .orderBy('sort_order', 'asc')
          .orderBy('name', 'asc');
      } else {
        // Get all categories
        categories = await this.getAllWithHierarchy();
      }

      // Build tree structure
      const categoryMap = new Map<string, any>();
      const rootCategories: any[] = [];

      // First pass: create all category objects
      categories.forEach(category => {
        categoryMap.set(category.id, {
          ...category,
          children: []
        });
      });

      // Second pass: build hierarchy
      categories.forEach(category => {
        const categoryNode = categoryMap.get(category.id);
        if (category.parent_id && categoryMap.has(category.parent_id)) {
          const parent = categoryMap.get(category.parent_id);
          parent.children.push(categoryNode);
        } else {
          rootCategories.push(categoryNode);
        }
      });

      return rootCategories;
    } catch (error) {
      logger.error(`Error building category tree:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Get category with product count
  static async getCategoriesWithProductCount(): Promise<any[]> {
    try {
      const categories = await this.db(this.getTableName())
        .select(
          `${this.getTableName()}.*`,
          this.db.raw('COUNT(products.id) as product_count')
        )
        .leftJoin('products', `${this.getTableName()}.id`, 'products.category_id')
        .where('products.is_active', true)
        .groupBy(`${this.getTableName()}.id`)
        .orderBy('sort_order', 'asc')
        .orderBy('name', 'asc');

      return categories.map(category => ({
        ...category,
        product_count: parseInt(category.product_count) || 0
      }));
    } catch (error) {
      logger.error(`Error getting categories with product count:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Update category sort order
  static async updateSortOrder(categoryId: string, sortOrder: number): Promise<boolean> {
    const updated = await this.updateById<IProductCategory>(categoryId, {
      sort_order: Math.max(0, Math.min(9999, sortOrder))
    });
    return updated !== null;
  }

  // Get category path (breadcrumb)
  static async getCategoryPath(categoryId: string): Promise<IProductCategory[]> {
    try {
      const path: IProductCategory[] = [];
      let currentId: string | null = categoryId;

      while (currentId) {
        const category: IProductCategory | null = await this.findById<IProductCategory>(currentId);
        if (!category) break;

        path.unshift(category);
        currentId = category.parent_id || null;
      }

      return path;
    } catch (error) {
      logger.error(`Error getting category path:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Check if category has children
  static async hasChildren(categoryId: string): Promise<boolean> {
    try {
      const result = await this.db(this.getTableName())
        .where('parent_id', categoryId)
        .count('* as count')
        .first();

      return result ? safeCount([result]) > 0 : false;
    } catch (error) {
      logger.error(`Error checking if category has children:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Get category statistics
  static async getCategoryStats(): Promise<{
    total: number;
    rootCategories: number;
    maxDepth: number;
  }> {
    try {
      const totalResults = await this.db(this.getTableName()).count('* as count');
      const rootResults = await this.db(this.getTableName())
        .whereNull('parent_id')
        .count('* as count');

      // Calculate max depth (simplified - could be more sophisticated)
      const maxDepthResult = await this.db.raw(`
        WITH RECURSIVE category_depth AS (
          SELECT id, parent_id, 1 as depth
          FROM ${this.getTableName()}
          WHERE parent_id IS NULL
          
          UNION ALL
          
          SELECT c.id, c.parent_id, cd.depth + 1
          FROM ${this.getTableName()} c
          JOIN category_depth cd ON c.parent_id = cd.id
        )
        SELECT MAX(depth) as max_depth FROM category_depth
      `);

      return {
        total: safeCount(totalResults),
        rootCategories: safeCount(rootResults),
        maxDepth: maxDepthResult.rows?.[0]?.max_depth || 1
      };
    } catch (error) {
      logger.error(`Error getting category statistics:`, error);
      throw handleDatabaseError(error);
    }
  }
}