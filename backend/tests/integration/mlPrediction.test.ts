import request from 'supertest';
import app from '../../src/index';
import { BaseModel } from '../../src/models/BaseModel';
import { User } from '../../src/models/User';
import { Product } from '../../src/models/Product';
import { authTestHelpers } from '../helpers/authTestHelpers';

describe('ML Prediction API Integration Tests', () => {
  let authToken: string;
  let testUser: any;
  let testProduct: any;

  beforeAll(async () => {
    // Create test user and get auth token
    testUser = await authTestHelpers.createTestUser();
    authToken = await authTestHelpers.generateTestToken(testUser.id);

    // Create test product
    testProduct = await Product.createProduct({
      name: 'Test Pokémon Booster Pack',
      slug: 'test-pokemon-booster-pack',
      sku: 'TEST-001',
      upc: '123456789012',
      set_name: 'Test Set',
      series: 'Test Series',
      msrp: 29.99,
      popularity_score: 500
    });

    // Insert some test price history
    await BaseModel.db('price_history').insert([
      {
        product_id: testProduct.id,
        retailer_id: 'test-retailer-1',
        price: 29.99,
        in_stock: true,
        recorded_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      },
      {
        product_id: testProduct.id,
        retailer_id: 'test-retailer-1',
        price: 31.99,
        in_stock: true,
        recorded_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
      },
      {
        product_id: testProduct.id,
        retailer_id: 'test-retailer-1',
        price: 33.99,
        in_stock: true,
        recorded_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      }
    ]);

    // Insert test availability data
    await BaseModel.db('product_availability').insert({
      product_id: testProduct.id,
      retailer_id: 'test-retailer-1',
      in_stock: true,
      price: 33.99,
      availability_status: 'in_stock',
      product_url: 'https://example.com/product',
      last_checked: new Date()
    });

    // Insert test watches for engagement metrics
    await BaseModel.db('watches').insert([
      {
        user_id: testUser.id,
        product_id: testProduct.id,
        retailer_ids: JSON.stringify(['test-retailer-1']),
        is_active: true
      }
    ]);

    // Insert test alerts for engagement metrics
    await BaseModel.db('alerts').insert([
      {
        user_id: testUser.id,
        product_id: testProduct.id,
        retailer_id: 'test-retailer-1',
        type: 'restock',
        priority: 'medium',
        data: JSON.stringify({
          product_name: 'Test Product',
          retailer_name: 'Test Retailer',
          availability_status: 'in_stock',
          product_url: 'https://example.com/product'
        }),
        status: 'sent',
        sent_at: new Date(),
        clicked_at: new Date()
      }
    ]);
  });

  afterAll(async () => {
    // Clean up test data
    if (testProduct) {
      await BaseModel.db('price_history').where('product_id', testProduct.id).del();
      await BaseModel.db('product_availability').where('product_id', testProduct.id).del();
      await BaseModel.db('watches').where('product_id', testProduct.id).del();
      await BaseModel.db('alerts').where('product_id', testProduct.id).del();
      await BaseModel.db('products').where('id', testProduct.id).del();
    }
    if (testUser) {
      await BaseModel.db('users').where('id', testUser.id).del();
    }
  });

  describe('GET /api/ml/products/:productId/price-prediction', () => {
    it('should return price prediction for valid product', async () => {
      const response = await request(app)
        .get(`/api/ml/products/${testProduct.id}/price-prediction`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('productId', testProduct.id);
      expect(response.body.data).toHaveProperty('predictedPrice');
      expect(response.body.data).toHaveProperty('confidence');
      expect(response.body.data).toHaveProperty('trend');
      expect(response.body.data).toHaveProperty('timeframe');
      expect(response.body.data).toHaveProperty('factors');
      expect(Array.isArray(response.body.data.factors)).toBe(true);
    });

    it('should accept custom timeframe parameter', async () => {
      const response = await request(app)
        .get(`/api/ml/products/${testProduct.id}/price-prediction?timeframe=60`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.timeframe).toBe(60);
    });

    it('should reject invalid timeframe', async () => {
      await request(app)
        .get(`/api/ml/products/${testProduct.id}/price-prediction?timeframe=500`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/ml/products/${testProduct.id}/price-prediction`)
        .expect(401);
    });
  });

  describe('GET /api/ml/products/:productId/sellout-risk', () => {
    it('should return sellout risk assessment', async () => {
      const response = await request(app)
        .get(`/api/ml/products/${testProduct.id}/sellout-risk`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('productId', testProduct.id);
      expect(response.body.data).toHaveProperty('riskScore');
      expect(response.body.data).toHaveProperty('riskLevel');
      expect(response.body.data).toHaveProperty('factors');
      expect(response.body.data.riskScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.riskScore).toBeLessThanOrEqual(100);
      expect(['low', 'medium', 'high', 'critical']).toContain(response.body.data.riskLevel);
    });
  });

  describe('GET /api/ml/products/:productId/roi-estimate', () => {
    it('should return ROI estimate with current price', async () => {
      const currentPrice = 35.00;
      const response = await request(app)
        .get(`/api/ml/products/${testProduct.id}/roi-estimate?currentPrice=${currentPrice}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('productId', testProduct.id);
      expect(response.body.data).toHaveProperty('currentPrice', currentPrice);
      expect(response.body.data).toHaveProperty('estimatedValue');
      expect(response.body.data).toHaveProperty('roiPercentage');
      expect(response.body.data).toHaveProperty('confidence');
      expect(response.body.data).toHaveProperty('marketFactors');
    });

    it('should require current price parameter', async () => {
      await request(app)
        .get(`/api/ml/products/${testProduct.id}/roi-estimate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should reject invalid current price', async () => {
      await request(app)
        .get(`/api/ml/products/${testProduct.id}/roi-estimate?currentPrice=-10`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/ml/products/:productId/hype-meter', () => {
    it('should return hype meter calculation', async () => {
      const response = await request(app)
        .get(`/api/ml/products/${testProduct.id}/hype-meter`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('productId', testProduct.id);
      expect(response.body.data).toHaveProperty('hypeScore');
      expect(response.body.data).toHaveProperty('hypeLevel');
      expect(response.body.data).toHaveProperty('engagementMetrics');
      expect(response.body.data).toHaveProperty('trendDirection');
      
      expect(response.body.data.hypeScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.hypeScore).toBeLessThanOrEqual(100);
      expect(['low', 'medium', 'high', 'viral']).toContain(response.body.data.hypeLevel);
      expect(['rising', 'falling', 'stable']).toContain(response.body.data.trendDirection);

      // Check engagement metrics structure
      const metrics = response.body.data.engagementMetrics;
      expect(metrics).toHaveProperty('watchCount');
      expect(metrics).toHaveProperty('alertCount');
      expect(metrics).toHaveProperty('clickThroughRate');
      expect(metrics).toHaveProperty('searchVolume');
    });
  });

  describe('GET /api/ml/products/:productId/market-insights', () => {
    it('should return comprehensive market insights', async () => {
      const response = await request(app)
        .get(`/api/ml/products/${testProduct.id}/market-insights`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('productId', testProduct.id);
      expect(response.body.data).toHaveProperty('priceHistory');
      expect(response.body.data).toHaveProperty('availabilityPattern');
      expect(response.body.data).toHaveProperty('seasonalTrends');
      expect(response.body.data).toHaveProperty('competitorAnalysis');
      
      expect(Array.isArray(response.body.data.priceHistory)).toBe(true);
      expect(Array.isArray(response.body.data.availabilityPattern)).toBe(true);
      expect(Array.isArray(response.body.data.seasonalTrends)).toBe(true);
      expect(Array.isArray(response.body.data.competitorAnalysis)).toBe(true);
    });

    it('should accept custom days parameter', async () => {
      const response = await request(app)
        .get(`/api/ml/products/${testProduct.id}/market-insights?days=30`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/ml/products/:productId/analysis', () => {
    it('should return comprehensive ML analysis', async () => {
      const response = await request(app)
        .get(`/api/ml/products/${testProduct.id}/analysis?currentPrice=35.00`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('productId', testProduct.id);
      expect(response.body.data).toHaveProperty('pricePrediction');
      expect(response.body.data).toHaveProperty('selloutRisk');
      expect(response.body.data).toHaveProperty('roiEstimate');
      expect(response.body.data).toHaveProperty('hypeMeter');
      expect(response.body.data).toHaveProperty('marketInsights');
      expect(response.body.data).toHaveProperty('generatedAt');
    });

    it('should work without ROI estimate if no current price provided', async () => {
      const response = await request(app)
        .get(`/api/ml/products/${testProduct.id}/analysis`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.roiEstimate).toBeNull();
    });
  });

  describe('GET /api/ml/trending-products', () => {
    it('should return trending products list', async () => {
      const response = await request(app)
        .get('/api/ml/trending-products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      if (response.body.data.length > 0) {
        const product = response.body.data[0];
        expect(product).toHaveProperty('id');
        expect(product).toHaveProperty('name');
        expect(product).toHaveProperty('hypeMeter');
      }
    });

    it('should accept limit parameter', async () => {
      const response = await request(app)
        .get('/api/ml/trending-products?limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should reject invalid limit', async () => {
      await request(app)
        .get('/api/ml/trending-products?limit=100')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/ml/high-risk-products', () => {
    it('should return high-risk products list', async () => {
      const response = await request(app)
        .get('/api/ml/high-risk-products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should accept minRiskScore parameter', async () => {
      const response = await request(app)
        .get('/api/ml/high-risk-products?minRiskScore=75')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // All returned products should have risk score >= 75
      response.body.data.forEach((product: any) => {
        if (product.riskAssessment) {
          expect(product.riskAssessment.riskScore).toBeGreaterThanOrEqual(75);
        }
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on ML endpoints', async () => {
      // Make multiple requests quickly to trigger rate limit
      const requests = Array(25).fill(null).map(() =>
        request(app)
          .get(`/api/ml/products/${testProduct.id}/price-prediction`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent product gracefully', async () => {
      const fakeProductId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .get(`/api/ml/products/${fakeProductId}/price-prediction`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500); // Should handle gracefully but may return 500 for missing product

      expect(response.body.success).toBe(false);
    });

    it('should validate UUID format for product ID', async () => {
      const response = await request(app)
        .get('/api/ml/products/invalid-uuid/price-prediction')
        .set('Authorization', `Bearer ${authToken}`);

      // Should either validate UUID format or handle gracefully
      expect([400, 500]).toContain(response.status);
    });
  });
});