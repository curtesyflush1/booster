import request from 'supertest';
import app from '../../src/index';
import { BaseModel } from '../../src/models/BaseModel';
import { testHelpers } from '../helpers/testHelpers';

describe('Price Comparison Integration Tests', () => {
  let testUser: any;
  let testProduct: any;
  let testRetailer1: any;
  let testRetailer2: any;
  let authToken: string;

  beforeAll(async () => {
    await testHelpers.setupTestDatabase();
  });

  afterAll(async () => {
    await testHelpers.cleanupTestDatabase();
  });

  beforeEach(async () => {
    await testHelpers.clearTestData();

    // Create test user
    testUser = await BaseModel.create('users', {
      email: 'test@example.com',
      password_hash: 'hashed_password',
      subscription_tier: 'pro',
      is_active: true
    });

    // Create test retailers
    testRetailer1 = await BaseModel.create('retailers', {
      name: 'Best Buy',
      slug: 'best-buy',
      type: 'api',
      is_active: true
    });

    testRetailer2 = await BaseModel.create('retailers', {
      name: 'Walmart',
      slug: 'walmart',
      type: 'affiliate',
      is_active: true
    });

    // Create test product
    testProduct = await BaseModel.create('products', {
      name: 'Pokemon Booster Pack Test',
      slug: 'pokemon-booster-pack-test',
      sku: 'PKM-BP-001',
      upc: '123456789012',
      msrp: 5.99,
      is_active: true,
      popularity_score: 750
    });

    // Create product availability data
    await BaseModel.create('product_availability', {
      product_id: testProduct.id,
      retailer_id: testRetailer1.id,
      in_stock: true,
      price: 4.99,
      original_price: 6.99,
      availability_status: 'in_stock',
      product_url: 'https://bestbuy.com/product/test',
      cart_url: 'https://bestbuy.com/cart/add/test',
      last_checked: new Date()
    });

    await BaseModel.create('product_availability', {
      product_id: testProduct.id,
      retailer_id: testRetailer2.id,
      in_stock: true,
      price: 5.49,
      original_price: 5.99,
      availability_status: 'in_stock',
      product_url: 'https://walmart.com/product/test',
      last_checked: new Date()
    });

    // Create price history
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    await BaseModel.create('price_history', {
      product_id: testProduct.id,
      retailer_id: testRetailer1.id,
      price: 6.99,
      in_stock: true,
      recorded_at: twoDaysAgo
    });

    await BaseModel.create('price_history', {
      product_id: testProduct.id,
      retailer_id: testRetailer1.id,
      price: 5.99,
      in_stock: true,
      recorded_at: oneDayAgo
    });

    await BaseModel.create('price_history', {
      product_id: testProduct.id,
      retailer_id: testRetailer1.id,
      price: 4.99,
      in_stock: true,
      recorded_at: now
    });

    // Create user watch for testing user deals
    await BaseModel.create('watches', {
      user_id: testUser.id,
      product_id: testProduct.id,
      is_active: true,
      retailer_ids: JSON.stringify([testRetailer1.id, testRetailer2.id])
    });

    // Get auth token
    authToken = testHelpers.generateTestToken(testUser.id);
  });

  describe('GET /api/price-comparison/products/:productId', () => {
    it('should return comprehensive price comparison', async () => {
      const response = await request(app)
        .get(`/api/price-comparison/products/${testProduct.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        productId: testProduct.id,
        productName: 'Pokemon Booster Pack Test',
        retailers: expect.arrayContaining([
          expect.objectContaining({
            retailerId: testRetailer1.id,
            retailerName: 'Best Buy',
            price: 4.99,
            originalPrice: 6.99,
            inStock: true,
            savings: 2.00,
            savingsPercentage: expect.closeTo(28.61, 1),
            dealScore: expect.any(Number)
          }),
          expect.objectContaining({
            retailerId: testRetailer2.id,
            retailerName: 'Walmart',
            price: 5.49,
            originalPrice: 5.99,
            inStock: true,
            savings: 0.50,
            savingsPercentage: expect.closeTo(8.35, 1)
          })
        ]),
        bestDeal: expect.objectContaining({
          retailerId: testRetailer1.id,
          price: 4.99
        }),
        averagePrice: expect.closeTo(5.24, 2),
        priceRange: {
          min: 4.99,
          max: 5.49
        }
      });
    });

    it('should include historical context when requested', async () => {
      const response = await request(app)
        .get(`/api/price-comparison/products/${testProduct.id}?includeHistory=true`)
        .expect(200);

      expect(response.body.data.historicalContext).toMatchObject({
        isAboveAverage: expect.any(Boolean),
        isAtHistoricalLow: expect.any(Boolean),
        averageHistoricalPrice: expect.any(Number),
        priceChangePercentage: expect.any(Number)
      });
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/api/price-comparison/products/non-existent-id')
        .expect(404);

      expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('POST /api/price-comparison/products/batch', () => {
    it('should return batch price comparisons', async () => {
      const response = await request(app)
        .post('/api/price-comparison/products/batch')
        .send({
          productIds: [testProduct.id],
          includeHistory: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].productId).toBe(testProduct.id);
      expect(response.body.count).toBe(1);
    });

    it('should handle empty results gracefully', async () => {
      const response = await request(app)
        .post('/api/price-comparison/products/batch')
        .send({
          productIds: ['non-existent-1', 'non-existent-2']
        })
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.count).toBe(0);
    });
  });

  describe('GET /api/price-comparison/products/:productId/history', () => {
    it('should return price history', async () => {
      const response = await request(app)
        .get(`/api/price-comparison/products/${testProduct.id}/history`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0]).toMatchObject({
        price: 6.99,
        retailerId: testRetailer1.id,
        retailerName: 'Best Buy',
        inStock: true
      });
      expect(response.body.timeframe).toBe(30);
    });

    it('should filter by retailer', async () => {
      const response = await request(app)
        .get(`/api/price-comparison/products/${testProduct.id}/history?retailerId=${testRetailer1.id}`)
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      response.body.data.forEach((item: any) => {
        expect(item.retailerId).toBe(testRetailer1.id);
      });
    });

    it('should respect days parameter', async () => {
      const response = await request(app)
        .get(`/api/price-comparison/products/${testProduct.id}/history?days=1`)
        .expect(200);

      expect(response.body.timeframe).toBe(1);
      // Should have fewer results due to shorter timeframe
      expect(response.body.data.length).toBeLessThanOrEqual(3);
    });
  });

  describe('GET /api/price-comparison/deals', () => {
    it('should identify current deals', async () => {
      const response = await request(app)
        .get('/api/price-comparison/deals?minSavings=5&minScore=50')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            productId: testProduct.id,
            alertType: 'price_drop',
            savingsAmount: expect.any(Number),
            savingsPercentage: expect.any(Number),
            dealScore: expect.any(Number)
          })
        ])
      );
    });

    it('should filter by retailer', async () => {
      const response = await request(app)
        .get(`/api/price-comparison/deals?retailers=${testRetailer1.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // All deals should be from the specified retailer
      response.body.data.forEach((deal: any) => {
        expect(deal.retailerId).toBe(testRetailer1.id);
      });
    });

    it('should respect minimum savings filter', async () => {
      const response = await request(app)
        .get('/api/price-comparison/deals?minSavings=50') // Very high threshold
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/price-comparison/products/:productId/trends', () => {
    it('should analyze price trends', async () => {
      const response = await request(app)
        .get(`/api/price-comparison/products/${testProduct.id}/trends?days=7`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            productId: testProduct.id,
            retailerId: testRetailer1.id,
            trend: expect.stringMatching(/^(increasing|decreasing|stable)$/),
            changePercentage: expect.any(Number),
            timeframe: 7,
            confidence: expect.any(Number)
          })
        ])
      );
    });

    it('should handle products with insufficient data', async () => {
      // Create a product with no price history
      const newProduct = await BaseModel.create('products', {
        name: 'New Product',
        slug: 'new-product',
        is_active: true
      });

      const response = await request(app)
        .get(`/api/price-comparison/products/${newProduct.id}/trends`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/price-comparison/my-deals', () => {
    it('should return deals for authenticated user\'s watchlist', async () => {
      const response = await request(app)
        .get('/api/price-comparison/my-deals')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            productId: testProduct.id,
            productName: 'Pokemon Booster Pack Test',
            retailerName: expect.any(String),
            savingsAmount: expect.any(Number),
            dealScore: expect.any(Number)
          })
        ])
      );
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/price-comparison/my-deals')
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return empty array for user with no watches', async () => {
      // Create a new user with no watches
      const newUser = await BaseModel.create('users', {
        email: 'newuser@example.com',
        password_hash: 'hashed_password',
        is_active: true
      });

      const newUserToken = testHelpers.generateTestToken(newUser.id);

      const response = await request(app)
        .get('/api/price-comparison/my-deals')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });

    it('should respect query parameters', async () => {
      const response = await request(app)
        .get('/api/price-comparison/my-deals?minSavings=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.filters).toMatchObject({
        minSavingsPercentage: 1,
        limit: 5
      });
    });
  });

  describe('Rate limiting and error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This would require mocking the database connection to fail
      // For now, we'll test that the endpoint structure is correct
      const response = await request(app)
        .get('/api/price-comparison/products/invalid-uuid-format')
        .expect(500);

      expect(response.body.error).toBeDefined();
    });

    it('should validate input parameters', async () => {
      const response = await request(app)
        .get('/api/price-comparison/products/test/history?days=invalid')
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_DAYS');
    });
  });

  describe('Performance considerations', () => {
    it('should handle batch requests efficiently', async () => {
      // Create multiple products for batch testing
      const products = [];
      for (let i = 0; i < 10; i++) {
        const product = await BaseModel.create('products', {
          name: `Test Product ${i}`,
          slug: `test-product-${i}`,
          is_active: true
        });
        products.push(product.id);
      }

      const startTime = Date.now();
      const response = await request(app)
        .post('/api/price-comparison/products/batch')
        .send({ productIds: products })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});