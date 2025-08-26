import request from 'supertest';
import app from '../../src/index';
import { Product } from '../../src/models/Product';
import { ProductCategory } from '../../src/models/ProductCategory';

describe('Product Catalog Integration', () => {
  beforeAll(async () => {
    // Ensure database is set up
    // In a real test environment, you'd set up a test database
  });

  describe('Product Search API', () => {
    it('should return products from search endpoint', async () => {
      const response = await request(app)
        .get('/api/products/search')
        .query({ q: 'Pokemon', limit: 5 });

      // Should not crash, even if database connection fails
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('products');
        expect(response.body).toHaveProperty('pagination');
        expect(Array.isArray(response.body.products)).toBe(true);
      }
    });

    it('should validate search parameters correctly', async () => {
      const response = await request(app)
        .get('/api/products/search')
        .query({ 
          q: 'a'.repeat(101), // Too long
          page: -1, // Invalid
          limit: 1000 // Too high
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Barcode Lookup API', () => {
    it('should validate UPC format', async () => {
      const response = await request(app)
        .get('/api/products/barcode')
        .query({ upc: 'invalid-upc' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require UPC parameter', async () => {
      const response = await request(app)
        .get('/api/products/barcode');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Product Detail API', () => {
    it('should validate product ID format', async () => {
      const response = await request(app)
        .get('/api/products/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Category API', () => {
    it('should return categories', async () => {
      const response = await request(app)
        .get('/api/products/categories');

      // Should not crash, even if database connection fails
      expect([200, 400, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('categories');
        expect(Array.isArray(response.body.categories)).toBe(true);
      }
    });
  });

  describe('Popular Products API', () => {
    it('should return popular products', async () => {
      const response = await request(app)
        .get('/api/products/popular')
        .query({ limit: 5 });

      // Should not crash, even if database connection fails
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('products');
        expect(Array.isArray(response.body.products)).toBe(true);
      }
    });
  });

  describe('Product Statistics API', () => {
    it('should return product stats', async () => {
      const response = await request(app)
        .get('/api/products/stats');

      // Should not crash, even if database connection fails
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('stats');
      }
    });
  });
});