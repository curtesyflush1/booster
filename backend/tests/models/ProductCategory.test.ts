import { ProductCategory } from '../../src/models/ProductCategory';

describe('ProductCategory Model', () => {
  describe('validation', () => {
    it('should validate required fields', () => {
      const category = new ProductCategory();
      
      const errors = category.validate({});
      expect(errors).toHaveLength(0); // No required fields in partial validation

      const errorsWithName = category.validate({ name: '' });
      expect(errorsWithName.length).toBeGreaterThan(0);
      expect(errorsWithName[0]?.field).toBe('name');
    });

    it('should validate slug format', () => {
      const category = new ProductCategory();
      
      const validSlug = category.validate({ slug: 'valid-slug-123' });
      expect(validSlug).toHaveLength(0);

      const invalidSlug = category.validate({ slug: 'Invalid Slug!' });
      expect(invalidSlug.length).toBeGreaterThan(0);
      expect(invalidSlug[0]?.field).toBe('slug');
    });

    it('should validate field lengths', () => {
      const category = new ProductCategory();
      
      const longName = 'a'.repeat(256);
      const errors = category.validate({ name: longName });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.field).toBe('name');
    });

    it('should validate sort order range', () => {
      const category = new ProductCategory();
      
      const validOrder = category.validate({ sort_order: 100 });
      expect(validOrder).toHaveLength(0);

      const invalidOrder = category.validate({ sort_order: -1 });
      expect(invalidOrder.length).toBeGreaterThan(0);
      expect(invalidOrder[0]?.field).toBe('sort_order');
    });
  });

  describe('sanitization', () => {
    it('should trim string fields', () => {
      const category = new ProductCategory();
      
      const sanitized = category.sanitize({
        name: '  Test Category  ',
        slug: '  test-category  ',
        description: '  Test description  '
      });

      expect(sanitized.name).toBe('Test Category');
      expect(sanitized.slug).toBe('test-category');
      expect(sanitized.description).toBe('Test description');
    });

    it('should convert slug to lowercase', () => {
      const category = new ProductCategory();
      
      const sanitized = category.sanitize({
        slug: 'TEST-CATEGORY'
      });

      expect(sanitized.slug).toBe('test-category');
    });

    it('should set default sort order', () => {
      const category = new ProductCategory();
      
      const sanitized = category.sanitize({
        name: 'Test Category'
      });

      expect(sanitized.sort_order).toBe(0);
    });
  });

  describe('static methods', () => {
    beforeEach(() => {
      // Mock database methods
      jest.spyOn(ProductCategory, 'create').mockImplementation(async (data) => ({
        id: '550e8400-e29b-41d4-a716-446655440000',
        created_at: new Date(),
        updated_at: new Date(),
        ...data
      } as any));

      jest.spyOn(ProductCategory, 'findOneBy').mockImplementation(async (criteria: any) => {
        if (criteria.slug === 'existing-category') {
          return {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Existing Category',
            slug: 'existing-category',
            sort_order: 0,
            created_at: new Date(),
            updated_at: new Date()
          } as any;
        }
        return null;
      });
    });

    it('should create category with validation', async () => {
      const categoryData = {
        name: 'Test Category',
        slug: 'test-category',
        description: 'Test description'
      };

      const result = await ProductCategory.createCategory(categoryData);
      
      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Test Category');
      expect(result.slug).toBe('test-category');
    });

    it('should find category by slug', async () => {
      const result = await ProductCategory.findBySlug('existing-category');
      
      expect(result).not.toBeNull();
      expect(result?.slug).toBe('existing-category');
    });

    it('should return null for non-existent slug', async () => {
      const result = await ProductCategory.findBySlug('non-existent');
      
      expect(result).toBeNull();
    });

    it('should handle case-insensitive slug search', async () => {
      const result = await ProductCategory.findBySlug('EXISTING-CATEGORY');
      
      expect(ProductCategory.findOneBy).toHaveBeenCalledWith({ 
        slug: 'existing-category' 
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});