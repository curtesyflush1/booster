/**
 * Complete User Workflows Integration Tests
 * Tests end-to-end user scenarios across all system components
 */

import request from 'supertest';
import app from '../../src/index';
import { createTestUser, cleanupTestData } from '../helpers/testHelpers';
import { createMockUser } from '../helpers/userTestHelpers';

// Test helper functions for common patterns
class WorkflowTestHelper {
  constructor(private app: any, private authToken: string) {}

  async expectSuccessfulResponse(response: any, expectedStatus = 200) {
    expect(response.status).toBe(expectedStatus);
    return response;
  }

  async expectErrorResponse(response: any, expectedStatus: number, expectedCode?: string) {
    expect(response.status).toBe(expectedStatus);
    if (expectedCode) {
      expect(response.body.error?.code).toBe(expectedCode);
    }
    return response;
  }

  async createWatch(productId: string, options: any = {}) {
    const defaultOptions = {
      productId,
      retailers: ['bestbuy'],
      maxPrice: 50.00,
      alertPreferences: {
        channels: ['web_push'],
        priority: 'medium'
      }
    };

    return request(this.app)
      .post('/api/v1/watches')
      .set('Authorization', `Bearer ${this.authToken}`)
      .send({ ...defaultOptions, ...options });
  }

  async getWithAuth(endpoint: string, query: any = {}) {
    return request(this.app)
      .get(endpoint)
      .set('Authorization', `Bearer ${this.authToken}`)
      .query(query);
  }

  async postWithAuth(endpoint: string, data: any = {}) {
    return request(this.app)
      .post(endpoint)
      .set('Authorization', `Bearer ${this.authToken}`)
      .send(data);
  }

  async putWithAuth(endpoint: string, data: any = {}) {
    return request(this.app)
      .put(endpoint)
      .set('Authorization', `Bearer ${this.authToken}`)
      .send(data);
  }

  async patchWithAuth(endpoint: string, data: any = {}) {
    return request(this.app)
      .patch(endpoint)
      .set('Authorization', `Bearer ${this.authToken}`)
      .send(data);
  }
}

// Test configuration
const TEST_CONFIG = {
  TIMEOUT: 30000,
  DEFAULT_PAGINATION: { limit: 10 },
  TEST_PRODUCT_PREFIX: 'test-pokemon-product',
  TEST_USER_PREFIX: 'workflow-test',
  EXPECTED_STATUSES: {
    SUCCESS: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    RATE_LIMITED: 429
  }
} as const;

// Test data factory for consistent test data creation
class TestDataFactory {
  private static counter = 0;

  static getUniqueEmail(): string {
    return `test-${Date.now()}-${++this.counter}@example.com`;
  }

  static getUniqueProductId(): string {
    return `test-pokemon-product-${Date.now()}-${++this.counter}`;
  }

  static createUserRegistrationData(overrides: any = {}) {
    return {
      email: this.getUniqueEmail(),
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      acceptTerms: true,
      ...overrides
    };
  }

  static createWatchData(productId?: string, overrides: any = {}) {
    return {
      productId: productId || this.getUniqueProductId(),
      retailers: ['bestbuy'],
      maxPrice: 50.00,
      alertPreferences: {
        channels: ['web_push'],
        priority: 'medium'
      },
      ...overrides
    };
  }
}

describe('Complete User Workflows Integration Tests', () => {
  // Set longer timeout for integration tests
  jest.setTimeout(TEST_CONFIG.TIMEOUT);
  let testUserId: string;
  let authToken: string;
  let testHelper: WorkflowTestHelper;
  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];

  beforeAll(async () => {
    // Database should already be initialized by Jest setup
    // Add any additional setup here if needed
  });

  afterAll(async () => {
    // Clean up all test data
    await cleanupTestData(createdUserIds, createdProductIds);
  });

  beforeEach(async () => {
    // Create a test user and get auth token
    const uniqueEmail = TestDataFactory.getUniqueEmail();
    const testUser = await createTestUser(uniqueEmail, {
      first_name: 'Workflow',
      last_name: 'Tester'
    });
    testUserId = testUser.id;
    createdUserIds.push(testUser.id);

    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: uniqueEmail,
        password: 'TestPassword123!'
      });

    if (loginResponse.status === 200) {
      authToken = loginResponse.body.token;
      testHelper = new WorkflowTestHelper(app, authToken);
    } else {
      throw new Error('Failed to login test user');
    }
  });

  describe('New User Onboarding Workflow', () => {
    it('should complete full user registration and setup flow', async () => {
      const registrationData = TestDataFactory.createUserRegistrationData({
        firstName: 'New',
        lastName: 'User'
      });

      // 1. Register new user
      const registrationResponse = await request(app)
        .post('/api/auth/register')
        .send(registrationData);

      await testHelper.expectSuccessfulResponse(registrationResponse, 201);
      expect(registrationResponse.body.user.email).toBe(registrationData.email);

      const newUserToken = registrationResponse.body.token;
      const newUserHelper = new WorkflowTestHelper(app, newUserToken);

      // 2. Update user preferences
      const preferencesData = {
        notificationChannels: ['web_push', 'email'],
        alertFilters: {
          maxPrice: 100,
          retailers: ['bestbuy', 'walmart']
        },
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
          timezone: 'America/New_York'
        }
      };

      const preferencesResponse = await newUserHelper.putWithAuth('/api/users/preferences', preferencesData);
      await testHelper.expectSuccessfulResponse(preferencesResponse);

      // 3. Add shipping address
      const addressData = {
        type: 'shipping',
        firstName: 'New',
        lastName: 'User',
        street: '123 Test St',
        city: 'Test City',
        state: 'NY',
        zipCode: '12345',
        country: 'US',
        isDefault: true
      };

      const addressResponse = await newUserHelper.postWithAuth('/api/users/addresses', addressData);
      await testHelper.expectSuccessfulResponse(addressResponse, 201);

      // 4. Subscribe to web push notifications
      const pushData = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key'
        }
      };

      const pushResponse = await newUserHelper.postWithAuth('/api/notifications/web-push/subscribe', pushData);
      await testHelper.expectSuccessfulResponse(pushResponse, 201);

      // 5. Verify user profile is complete
      const profileResponse = await newUserHelper.getWithAuth('/api/users/profile');
      await testHelper.expectSuccessfulResponse(profileResponse);
      
      expect(profileResponse.body.profile.firstName).toBe('New');
      expect(profileResponse.body.preferences?.notificationChannels).toContain('web_push');
      expect(profileResponse.body.addresses).toHaveLength(1);
    });
  });

  describe('Product Discovery and Watch Management Workflow', () => {
    it('should complete product search, watch creation, and alert flow', async () => {
      // 1. Search for products (may return empty results in test environment)
      const searchResponse = await testHelper.getWithAuth('/api/products/search', {
        q: 'Pokemon TCG',
        category: 'trading-cards',
        limit: 10
      });

      await testHelper.expectSuccessfulResponse(searchResponse);
      expect(searchResponse.body.products).toBeDefined();

      // 2. Use a test product ID for watch creation
      const productId = TestDataFactory.getUniqueProductId();
      
      // Note: In a real test, you might want to create a test product first
      // const testProduct = await createTestProduct(productId);
      // createdProductIds.push(testProduct.id);

      // 3. Create a watch for the product
      const watchData = TestDataFactory.createWatchData(productId, {
        retailers: ['bestbuy', 'walmart'],
        maxPrice: 50.00,
        alertPreferences: {
          channels: ['web_push', 'email'],
          priority: 'high'
        }
      });

      const watchResponse = await testHelper.createWatch(productId, watchData);
      await testHelper.expectSuccessfulResponse(watchResponse, 201);
      
      const watchId = watchResponse.body.watch?.id;
      expect(watchId).toBeDefined();

      // 4. Subscribe to a Watch Pack (may not exist in test environment)
      const watchPackResponse = await testHelper.postWithAuth('/api/v1/watches/packs/popular-pokemon-sets/subscribe');
      // Don't fail if watch pack doesn't exist in test environment
      if (watchPackResponse.status !== 404) {
        await testHelper.expectSuccessfulResponse(watchPackResponse, 201);
      }

      // 5. Check watch status and health
      if (watchId) {
        const watchHealthResponse = await testHelper.getWithAuth(`/api/v1/watches/${watchId}/health`);
        await testHelper.expectSuccessfulResponse(watchHealthResponse);
        expect(watchHealthResponse.body.health?.isActive).toBe(true);
      }

      // 6. Get user's watch list
      const watchListResponse = await testHelper.getWithAuth('/api/v1/watches', { status: 'active' });
      await testHelper.expectSuccessfulResponse(watchListResponse);
      expect(Array.isArray(watchListResponse.body.watches)).toBe(true);

      // 7. Update watch settings
      if (watchId) {
        const updateData = {
          maxPrice: 45.00,
          alertPreferences: {
            channels: ['web_push'],
            priority: 'medium'
          }
        };

        const updateWatchResponse = await testHelper.putWithAuth(`/api/v1/watches/${watchId}`, updateData);
        await testHelper.expectSuccessfulResponse(updateWatchResponse);
      }
    });
  });

  describe('Alert Management and Engagement Workflow', () => {
    it('should handle alert generation, delivery, and user interaction', async () => {
      // 1. Create a watch that will generate alerts
      const productId = TestDataFactory.getUniqueProductId();
      const watchData = TestDataFactory.createWatchData(productId, {
        retailers: ['bestbuy'],
        maxPrice: 100.00,
        alertPreferences: {
          channels: ['web_push', 'email'],
          priority: 'high'
        }
      });

      const watchResponse = await testHelper.createWatch(productId, watchData);
      await testHelper.expectSuccessfulResponse(watchResponse, 201);

      // 2. Get user's alerts (may be empty in test environment)
      const alertsResponse = await testHelper.getWithAuth('/api/alerts', { 
        status: 'unread', 
        limit: 10 
      });
      await testHelper.expectSuccessfulResponse(alertsResponse);

      // 3. Test alert interaction if alerts exist
      if (alertsResponse.body.alerts && alertsResponse.body.alerts.length > 0) {
        const alertId = alertsResponse.body.alerts[0].id;
        
        // Mark alert as clicked
        const clickResponse = await testHelper.patchWithAuth(`/api/alerts/${alertId}/clicked`);
        await testHelper.expectSuccessfulResponse(clickResponse);

        // Mark alert as read
        const readResponse = await testHelper.patchWithAuth(`/api/alerts/${alertId}/read`);
        await testHelper.expectSuccessfulResponse(readResponse);
      }

      // 4. Get alert analytics (should work even with no alerts)
      const analyticsResponse = await testHelper.getWithAuth('/api/alerts/analytics/engagement');
      await testHelper.expectSuccessfulResponse(analyticsResponse);
      expect(analyticsResponse.body.analytics).toBeDefined();
    });
  });

  describe('ML Predictions and Insights Workflow', () => {
    it('should provide ML-powered insights and recommendations', async () => {
      const productId = 'test-pokemon-product-3';

      // 1. Get price prediction
      const pricePredictionResponse = await request(app)
        .get(`/api/ml/products/${productId}/price-prediction`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(pricePredictionResponse.status).toBe(200);
      expect(pricePredictionResponse.body.prediction).toBeDefined();

      // 2. Get sellout risk assessment
      const selloutRiskResponse = await request(app)
        .get(`/api/ml/products/${productId}/sellout-risk`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(selloutRiskResponse.status).toBe(200);
      expect(selloutRiskResponse.body.risk).toBeDefined();

      // 3. Get ROI estimate
      const roiResponse = await request(app)
        .get(`/api/ml/products/${productId}/roi-estimate`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(roiResponse.status).toBe(200);
      expect(roiResponse.body.estimate).toBeDefined();

      // 4. Get hype meter
      const hypeResponse = await request(app)
        .get(`/api/ml/products/${productId}/hype-meter`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(hypeResponse.status).toBe(200);
      expect(hypeResponse.body.hype).toBeDefined();

      // 5. Get comprehensive analysis
      const analysisResponse = await request(app)
        .get(`/api/ml/products/${productId}/analysis`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(analysisResponse.status).toBe(200);
      expect(analysisResponse.body.analysis.pricePrediction).toBeDefined();
      expect(analysisResponse.body.analysis.selloutRisk).toBeDefined();
      expect(analysisResponse.body.analysis.roiEstimate).toBeDefined();
      expect(analysisResponse.body.analysis.hypeMeter).toBeDefined();

      // 6. Get trending products
      const trendingResponse = await request(app)
        .get('/api/ml/trending-products')
        .set('Authorization', `Bearer ${authToken}`);

      expect(trendingResponse.status).toBe(200);
      expect(trendingResponse.body.products).toBeDefined();
    });
  });

  describe('Price Comparison and Deal Discovery Workflow', () => {
    it('should provide comprehensive price comparison and deal identification', async () => {
      const productId = 'test-pokemon-product-4';

      // 1. Get price comparison for single product
      const priceComparisonResponse = await request(app)
        .get(`/api/price-comparison/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(priceComparisonResponse.status).toBe(200);
      expect(priceComparisonResponse.body.comparison).toBeDefined();

      // 2. Get price history
      const priceHistoryResponse = await request(app)
        .get(`/api/price-comparison/products/${productId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ days: 30 });

      expect(priceHistoryResponse.status).toBe(200);
      expect(priceHistoryResponse.body.history).toBeDefined();

      // 3. Get current deals
      const dealsResponse = await request(app)
        .get('/api/price-comparison/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10 });

      expect(dealsResponse.status).toBe(200);
      expect(dealsResponse.body.deals).toBeDefined();

      // 4. Get personalized deals for user's watchlist
      const myDealsResponse = await request(app)
        .get('/api/price-comparison/my-deals')
        .set('Authorization', `Bearer ${authToken}`);

      expect(myDealsResponse.status).toBe(200);
      expect(myDealsResponse.body.deals).toBeDefined();

      // 5. Analyze price trends
      const trendsResponse = await request(app)
        .get(`/api/price-comparison/products/${productId}/trends`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ period: '30d' });

      expect(trendsResponse.status).toBe(200);
      expect(trendsResponse.body.trends).toBeDefined();
    });
  });

  describe('Community and Social Features Workflow', () => {
    it('should handle community interactions and social sharing', async () => {
      // 1. Create a testimonial
      const testimonialResponse = await request(app)
        .post('/api/community/testimonials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'BoosterBeacon helped me catch the latest Pokemon drop!',
          rating: 5,
          productId: 'test-pokemon-product-5'
        });

      expect(testimonialResponse.status).toBe(201);

      // 2. Get community testimonials
      const testimonialsResponse = await request(app)
        .get('/api/community/testimonials')
        .query({ limit: 10 });

      expect(testimonialsResponse.status).toBe(200);
      expect(testimonialsResponse.body.testimonials).toBeDefined();

      // 3. Create a community post
      const postResponse = await request(app)
        .post('/api/community/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Great Pokemon TCG Deal Alert!',
          content: 'Just found an amazing deal on the latest set!',
          tags: ['pokemon', 'deal', 'tcg']
        });

      expect(postResponse.status).toBe(201);
      const postId = postResponse.body.post.id;

      // 4. Like the post
      const likeResponse = await request(app)
        .post(`/api/community/posts/${postId}/like`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(likeResponse.status).toBe(200);

      // 5. Add a comment
      const commentResponse = await request(app)
        .post(`/api/community/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Thanks for sharing this deal!'
        });

      expect(commentResponse.status).toBe(201);

      // 6. Get community stats
      const statsResponse = await request(app)
        .get('/api/community/stats');

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.stats).toBeDefined();

      // 7. Share content to social media
      const shareResponse = await request(app)
        .post('/api/social/share')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'twitter',
          content: 'Check out this amazing Pokemon deal!',
          url: 'https://boosterbeacon.com/deals/pokemon-tcg'
        });

      expect(shareResponse.status).toBe(200);
    });
  });

  describe('Subscription and Billing Workflow', () => {
    it('should handle subscription management and billing', async () => {
      // 1. Get subscription plans
      const plansResponse = await request(app)
        .get('/api/subscription/plans');

      expect(plansResponse.status).toBe(200);
      expect(plansResponse.body.plans).toBeDefined();

      // 2. Get current subscription status
      const statusResponse = await request(app)
        .get('/api/subscription/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.subscription).toBeDefined();

      // 3. Get usage statistics
      const usageResponse = await request(app)
        .get('/api/subscription/usage')
        .set('Authorization', `Bearer ${authToken}`);

      expect(usageResponse.status).toBe(200);
      expect(usageResponse.body.usage).toBeDefined();

      // 4. Create checkout session for Pro upgrade
      const checkoutResponse = await request(app)
        .post('/api/subscription/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planId: 'pro-monthly',
          successUrl: 'https://boosterbeacon.com/success',
          cancelUrl: 'https://boosterbeacon.com/cancel'
        });

      expect(checkoutResponse.status).toBe(200);
      expect(checkoutResponse.body.checkoutUrl).toBeDefined();

      // 5. Get billing history
      const billingResponse = await request(app)
        .get('/api/subscription/billing-history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(billingResponse.status).toBe(200);
      expect(billingResponse.body.history).toBeDefined();
    });
  });

  describe('System Health and Monitoring Workflow', () => {
    it('should provide comprehensive system health and monitoring data', async () => {
      // 1. Check basic health
      const healthResponse = await request(app)
        .get('/health');

      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body.status).toBe('healthy');

      // 2. Check detailed health
      const detailedHealthResponse = await request(app)
        .get('/health/detailed');

      expect(detailedHealthResponse.status).toBe(200);
      expect(detailedHealthResponse.body.database).toBeDefined();
      expect(detailedHealthResponse.body.redis).toBeDefined();

      // 3. Get system metrics (authenticated)
      const metricsResponse = await request(app)
        .get('/api/monitoring/metrics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(metricsResponse.status).toBe(200);
      expect(metricsResponse.body.metrics).toBeDefined();

      // 4. Get monitoring dashboard data
      const dashboardResponse = await request(app)
        .get('/api/monitoring/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.body.dashboard).toBeDefined();

      // 5. Check active alerts
      const activeAlertsResponse = await request(app)
        .get('/api/monitoring/alerts/active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(activeAlertsResponse.status).toBe(200);
      expect(activeAlertsResponse.body.alerts).toBeDefined();
    });
  });

  describe('Data Export and Import Workflow', () => {
    it('should handle CSV export and import operations', async () => {
      // 1. Create some watches first
      await request(app)
        .post('/api/v1/watches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'export-test-product-1',
          retailers: ['bestbuy'],
          maxPrice: 50.00
        });

      await request(app)
        .post('/api/v1/watches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'export-test-product-2',
          retailers: ['walmart'],
          maxPrice: 75.00
        });

      // 2. Export watches to CSV
      const exportResponse = await request(app)
        .get('/api/csv/export/watches')
        .set('Authorization', `Bearer ${authToken}`);

      expect(exportResponse.status).toBe(200);
      expect(exportResponse.headers['content-type']).toContain('text/csv');

      // 3. Get CSV template
      const templateResponse = await request(app)
        .get('/api/csv/template/watches');

      expect(templateResponse.status).toBe(200);
      expect(templateResponse.headers['content-type']).toContain('text/csv');

      // 4. Import watches from CSV (simulate file upload)
      const csvData = `productId,retailers,maxPrice,alertChannels
import-test-product-1,"bestbuy,walmart",60.00,"web_push,email"
import-test-product-2,bestbuy,40.00,web_push`;

      const importResponse = await request(app)
        .post('/api/csv/import/watches')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from(csvData), 'watches.csv');

      expect(importResponse.status).toBe(200);
      expect(importResponse.body.imported).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery Workflow', () => {
    it('should handle various error scenarios gracefully', async () => {
      // 1. Test invalid authentication
      const invalidAuthResponse = await request(app)
        .get('/api/v1/watches')
        .set('Authorization', 'Bearer invalid-token');

      expect(invalidAuthResponse.status).toBe(401);

      // 2. Test rate limiting
      const rateLimitPromises = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/products/search')
          .query({ q: 'test' })
      );

      const rateLimitResults = await Promise.allSettled(rateLimitPromises);
      const rateLimitedRequests = rateLimitResults.filter(
        result => result.status === 'fulfilled' && result.value.status === 429
      );

      expect(rateLimitedRequests.length).toBeGreaterThan(0);

      // 3. Test invalid product ID
      const invalidProductResponse = await request(app)
        .get('/api/products/non-existent-product');

      expect(invalidProductResponse.status).toBe(404);

      // 4. Test invalid watch creation
      const invalidWatchResponse = await request(app)
        .post('/api/v1/watches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: '', // Invalid empty product ID
          retailers: [],
          maxPrice: -10 // Invalid negative price
        });

      expect(invalidWatchResponse.status).toBe(400);

      // 5. Test unauthorized access to admin endpoints
      const unauthorizedAdminResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(unauthorizedAdminResponse.status).toBe(403);
    });
  });
});