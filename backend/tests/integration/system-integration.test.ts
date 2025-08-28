/**
 * System Integration Tests
 * Tests complete system integration across all components
 */

import request from 'supertest';
import { app } from '../../src/index';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/testHelpers';
import { createTestUser, loginTestUser } from '../helpers/userTestHelpers';

describe('System Integration Tests', () => {
  let testUserId: string;
  let authToken: string;
  let adminUserId: string;
  let adminToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Create test user
    const userData = await createTestUser({
      email: 'system-test@example.com',
      password: 'TestPassword123!',
      firstName: 'System',
      lastName: 'Tester'
    });
    testUserId = userData.user.id;
    authToken = userData.token;

    // Create admin user
    const adminData = await createTestUser({
      email: 'admin-test@example.com',
      password: 'AdminPassword123!',
      firstName: 'Admin',
      lastName: 'Tester',
      role: 'admin'
    });
    adminUserId = adminData.user.id;
    adminToken = adminData.token;
  }, 30000);

  afterAll(async () => {
    await cleanupTestDatabase();
  }, 30000);

  describe('System Health and Status', () => {
    it('should provide comprehensive system health information', async () => {
      // Basic health check
      const healthResponse = await request(app)
        .get('/health');

      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body.status).toBe('healthy');
      expect(healthResponse.body.timestamp).toBeDefined();
      expect(healthResponse.body.uptime).toBeDefined();

      // Detailed health check
      const detailedHealthResponse = await request(app)
        .get('/health/detailed');

      expect(detailedHealthResponse.status).toBe(200);
      expect(detailedHealthResponse.body.database).toBeDefined();
      expect(detailedHealthResponse.body.redis).toBeDefined();
      expect(detailedHealthResponse.body.services).toBeDefined();

      // Readiness probe
      const readinessResponse = await request(app)
        .get('/health/ready');

      expect(readinessResponse.status).toBe(200);

      // Liveness probe
      const livenessResponse = await request(app)
        .get('/health/live');

      expect(livenessResponse.status).toBe(200);
    });

    it('should provide system metrics for authenticated users', async () => {
      const metricsResponse = await request(app)
        .get('/api/monitoring/metrics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(metricsResponse.status).toBe(200);
      expect(metricsResponse.body.metrics).toBeDefined();
      expect(metricsResponse.body.metrics.memory).toBeDefined();
      expect(metricsResponse.body.metrics.cpu).toBeDefined();
    });
  });

  describe('Authentication and Authorization Flow', () => {
    it('should handle complete authentication lifecycle', async () => {
      // Register new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'lifecycle-test@example.com',
          password: 'LifecycleTest123!',
          firstName: 'Lifecycle',
          lastName: 'Test',
          acceptTerms: true
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.user.email).toBe('lifecycle-test@example.com');
      expect(registerResponse.body.token).toBeDefined();

      const newUserToken = registerResponse.body.token;

      // Login with new user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'lifecycle-test@example.com',
          password: 'LifecycleTest123!'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.token).toBeDefined();

      // Access protected resource
      const profileResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${newUserToken}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.profile.firstName).toBe('Lifecycle');

      // Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${newUserToken}`);

      expect(logoutResponse.status).toBe(200);
    });

    it('should enforce role-based access control', async () => {
      // Regular user accessing admin endpoint
      const unauthorizedResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(unauthorizedResponse.status).toBe(403);

      // Admin user accessing admin endpoint
      const authorizedResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(authorizedResponse.status).toBe(200);
      expect(authorizedResponse.body.users).toBeDefined();
    });
  });

  describe('Product and Watch Management Integration', () => {
    it('should handle complete product discovery and watch setup flow', async () => {
      // Search for products
      const searchResponse = await request(app)
        .get('/api/products/search')
        .query({
          q: 'Pokemon TCG',
          category: 'trading-cards',
          limit: 5
        });

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.products).toBeDefined();

      // Get product categories
      const categoriesResponse = await request(app)
        .get('/api/products/categories');

      expect(categoriesResponse.status).toBe(200);
      expect(categoriesResponse.body.categories).toBeDefined();

      // Create a watch
      const watchResponse = await request(app)
        .post('/api/v1/watches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'test-pokemon-product-1',
          retailers: ['bestbuy', 'walmart'],
          maxPrice: 50.00,
          alertPreferences: {
            channels: ['web_push', 'email'],
            priority: 'high'
          }
        });

      expect(watchResponse.status).toBe(201);
      expect(watchResponse.body.watch.id).toBeDefined();

      const watchId = watchResponse.body.watch.id;

      // Get watch list
      const watchListResponse = await request(app)
        .get('/api/v1/watches')
        .set('Authorization', `Bearer ${authToken}`);

      expect(watchListResponse.status).toBe(200);
      expect(watchListResponse.body.watches.length).toBeGreaterThan(0);

      // Get watch health
      const watchHealthResponse = await request(app)
        .get(`/api/v1/watches/${watchId}/health`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(watchHealthResponse.status).toBe(200);
      expect(watchHealthResponse.body.health).toBeDefined();

      // Update watch
      const updateWatchResponse = await request(app)
        .put(`/api/v1/watches/${watchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          maxPrice: 45.00,
          alertPreferences: {
            channels: ['web_push'],
            priority: 'medium'
          }
        });

      expect(updateWatchResponse.status).toBe(200);

      // Delete watch
      const deleteWatchResponse = await request(app)
        .delete(`/api/v1/watches/${watchId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteWatchResponse.status).toBe(200);
    });

    it('should handle watch pack subscription flow', async () => {
      // Get available watch packs
      const watchPacksResponse = await request(app)
        .get('/api/v1/watches/packs');

      expect(watchPacksResponse.status).toBe(200);
      expect(watchPacksResponse.body.packs).toBeDefined();

      // Get popular watch packs
      const popularPacksResponse = await request(app)
        .get('/api/v1/watches/packs/popular');

      expect(popularPacksResponse.status).toBe(200);

      // Subscribe to a watch pack
      const subscribeResponse = await request(app)
        .post('/api/v1/watches/packs/popular-pokemon-sets/subscribe')
        .set('Authorization', `Bearer ${authToken}`);

      expect(subscribeResponse.status).toBe(201);

      // Get user's subscriptions
      const subscriptionsResponse = await request(app)
        .get('/api/v1/watches/packs/subscriptions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(subscriptionsResponse.status).toBe(200);
      expect(subscriptionsResponse.body.subscriptions).toBeDefined();

      // Unsubscribe from watch pack
      const unsubscribeResponse = await request(app)
        .delete('/api/v1/watches/packs/popular-pokemon-sets/subscribe')
        .set('Authorization', `Bearer ${authToken}`);

      expect(unsubscribeResponse.status).toBe(200);
    });
  });

  describe('Alert System Integration', () => {
    it('should handle complete alert lifecycle', async () => {
      // Create a watch that will generate alerts
      const watchResponse = await request(app)
        .post('/api/v1/watches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'test-alert-product',
          retailers: ['bestbuy'],
          maxPrice: 100.00,
          alertPreferences: {
            channels: ['web_push', 'email'],
            priority: 'high'
          }
        });

      expect(watchResponse.status).toBe(201);

      // Get user's alerts
      const alertsResponse = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'unread', limit: 10 });

      expect(alertsResponse.status).toBe(200);
      expect(alertsResponse.body.alerts).toBeDefined();

      // Get alert statistics
      const alertStatsResponse = await request(app)
        .get('/api/alerts/stats/summary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(alertStatsResponse.status).toBe(200);
      expect(alertStatsResponse.body.stats).toBeDefined();

      // Get alert analytics
      const analyticsResponse = await request(app)
        .get('/api/alerts/analytics/engagement')
        .set('Authorization', `Bearer ${authToken}`);

      expect(analyticsResponse.status).toBe(200);
      expect(analyticsResponse.body.analytics).toBeDefined();
    });
  });

  describe('Machine Learning Integration', () => {
    it('should provide ML predictions and insights', async () => {
      const productId = 'test-ml-product';

      // Get price prediction
      const pricePredictionResponse = await request(app)
        .get(`/api/ml/products/${productId}/price-prediction`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(pricePredictionResponse.status).toBe(200);
      expect(pricePredictionResponse.body.prediction).toBeDefined();

      // Get sellout risk
      const selloutRiskResponse = await request(app)
        .get(`/api/ml/products/${productId}/sellout-risk`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(selloutRiskResponse.status).toBe(200);
      expect(selloutRiskResponse.body.risk).toBeDefined();

      // Get ROI estimate
      const roiResponse = await request(app)
        .get(`/api/ml/products/${productId}/roi-estimate`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(roiResponse.status).toBe(200);
      expect(roiResponse.body.estimate).toBeDefined();

      // Get hype meter
      const hypeResponse = await request(app)
        .get(`/api/ml/products/${productId}/hype-meter`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(hypeResponse.status).toBe(200);
      expect(hypeResponse.body.hype).toBeDefined();

      // Get comprehensive analysis
      const analysisResponse = await request(app)
        .get(`/api/ml/products/${productId}/analysis`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(analysisResponse.status).toBe(200);
      expect(analysisResponse.body.analysis).toBeDefined();
      expect(analysisResponse.body.analysis.pricePrediction).toBeDefined();
      expect(analysisResponse.body.analysis.selloutRisk).toBeDefined();
      expect(analysisResponse.body.analysis.roiEstimate).toBeDefined();
      expect(analysisResponse.body.analysis.hypeMeter).toBeDefined();

      // Get trending products
      const trendingResponse = await request(app)
        .get('/api/ml/trending-products')
        .set('Authorization', `Bearer ${authToken}`);

      expect(trendingResponse.status).toBe(200);
      expect(trendingResponse.body.products).toBeDefined();
    });
  });

  describe('Price Comparison System Integration', () => {
    it('should provide comprehensive price comparison features', async () => {
      const productId = 'test-price-comparison-product';

      // Get price comparison
      const comparisonResponse = await request(app)
        .get(`/api/price-comparison/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(comparisonResponse.status).toBe(200);
      expect(comparisonResponse.body.comparison).toBeDefined();

      // Get price history
      const historyResponse = await request(app)
        .get(`/api/price-comparison/products/${productId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ days: 30 });

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.history).toBeDefined();

      // Get current deals
      const dealsResponse = await request(app)
        .get('/api/price-comparison/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10 });

      expect(dealsResponse.status).toBe(200);
      expect(dealsResponse.body.deals).toBeDefined();

      // Get personalized deals
      const myDealsResponse = await request(app)
        .get('/api/price-comparison/my-deals')
        .set('Authorization', `Bearer ${authToken}`);

      expect(myDealsResponse.status).toBe(200);
      expect(myDealsResponse.body.deals).toBeDefined();

      // Batch price comparison
      const batchResponse = await request(app)
        .post('/api/price-comparison/products/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productIds: [productId, 'test-product-2', 'test-product-3']
        });

      expect(batchResponse.status).toBe(200);
      expect(batchResponse.body.comparisons).toBeDefined();
    });
  });

  describe('Community Features Integration', () => {
    it('should handle community interactions', async () => {
      // Create testimonial
      const testimonialResponse = await request(app)
        .post('/api/community/testimonials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'BoosterBeacon helped me catch the latest Pokemon drop!',
          rating: 5,
          productId: 'test-community-product'
        });

      expect(testimonialResponse.status).toBe(201);

      // Get testimonials
      const testimonialsResponse = await request(app)
        .get('/api/community/testimonials')
        .query({ limit: 10 });

      expect(testimonialsResponse.status).toBe(200);
      expect(testimonialsResponse.body.testimonials).toBeDefined();

      // Create community post
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

      // Like post
      const likeResponse = await request(app)
        .post(`/api/community/posts/${postId}/like`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(likeResponse.status).toBe(200);

      // Add comment
      const commentResponse = await request(app)
        .post(`/api/community/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Thanks for sharing this deal!'
        });

      expect(commentResponse.status).toBe(201);

      // Get community stats
      const statsResponse = await request(app)
        .get('/api/community/stats');

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.stats).toBeDefined();
    });
  });

  describe('Subscription Management Integration', () => {
    it('should handle subscription lifecycle', async () => {
      // Get subscription plans
      const plansResponse = await request(app)
        .get('/api/subscription/plans');

      expect(plansResponse.status).toBe(200);
      expect(plansResponse.body.plans).toBeDefined();

      // Get subscription status
      const statusResponse = await request(app)
        .get('/api/subscription/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.subscription).toBeDefined();

      // Get usage statistics
      const usageResponse = await request(app)
        .get('/api/subscription/usage')
        .set('Authorization', `Bearer ${authToken}`);

      expect(usageResponse.status).toBe(200);
      expect(usageResponse.body.usage).toBeDefined();

      // Get billing history
      const billingResponse = await request(app)
        .get('/api/subscription/billing-history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(billingResponse.status).toBe(200);
      expect(billingResponse.body.history).toBeDefined();
    });
  });

  describe('Data Export/Import Integration', () => {
    it('should handle CSV operations', async () => {
      // Create some watches first
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

      // Export watches
      const exportResponse = await request(app)
        .get('/api/csv/export/watches')
        .set('Authorization', `Bearer ${authToken}`);

      expect(exportResponse.status).toBe(200);
      expect(exportResponse.headers['content-type']).toContain('text/csv');

      // Get CSV template
      const templateResponse = await request(app)
        .get('/api/csv/template/watches');

      expect(templateResponse.status).toBe(200);
      expect(templateResponse.headers['content-type']).toContain('text/csv');
    });
  });

  describe('Admin Dashboard Integration', () => {
    it('should provide comprehensive admin functionality', async () => {
      // Get dashboard stats
      const dashboardResponse = await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.body.stats).toBeDefined();

      // Get system health
      const systemHealthResponse = await request(app)
        .get('/api/admin/system/health')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(systemHealthResponse.status).toBe(200);
      expect(systemHealthResponse.body.health).toBeDefined();

      // Get users
      const usersResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ limit: 10 });

      expect(usersResponse.status).toBe(200);
      expect(usersResponse.body.users).toBeDefined();

      // Get user stats
      const userStatsResponse = await request(app)
        .get('/api/admin/users/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(userStatsResponse.status).toBe(200);
      expect(userStatsResponse.body.stats).toBeDefined();

      // Get ML models
      const mlModelsResponse = await request(app)
        .get('/api/admin/ml/models')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(mlModelsResponse.status).toBe(200);
      expect(mlModelsResponse.body.models).toBeDefined();

      // Get audit logs
      const auditLogsResponse = await request(app)
        .get('/api/admin/audit/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ limit: 10 });

      expect(auditLogsResponse.status).toBe(200);
      expect(auditLogsResponse.body.logs).toBeDefined();
    });
  });

  describe('Monitoring and Metrics Integration', () => {
    it('should provide comprehensive monitoring data', async () => {
      // Get monitoring dashboard
      const dashboardResponse = await request(app)
        .get('/api/monitoring/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.body.dashboard).toBeDefined();

      // Get active alerts
      const activeAlertsResponse = await request(app)
        .get('/api/monitoring/alerts/active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(activeAlertsResponse.status).toBe(200);
      expect(activeAlertsResponse.body.alerts).toBeDefined();

      // Get alert history
      const alertHistoryResponse = await request(app)
        .get('/api/monitoring/alerts/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10 });

      expect(alertHistoryResponse.status).toBe(200);
      expect(alertHistoryResponse.body.history).toBeDefined();

      // Record custom metric
      const recordMetricResponse = await request(app)
        .post('/api/monitoring/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'test_metric',
          value: 42,
          tags: { test: 'integration' }
        });

      expect(recordMetricResponse.status).toBe(200);
    });
  });

  describe('SEO and Sitemap Integration', () => {
    it('should provide SEO functionality', async () => {
      // Get main sitemap
      const sitemapResponse = await request(app)
        .get('/sitemap.xml');

      expect(sitemapResponse.status).toBe(200);
      expect(sitemapResponse.headers['content-type']).toContain('application/xml');

      // Get products sitemap
      const productsSitemapResponse = await request(app)
        .get('/sitemap-products.xml');

      expect(productsSitemapResponse.status).toBe(200);

      // Get robots.txt
      const robotsResponse = await request(app)
        .get('/robots.txt');

      expect(robotsResponse.status).toBe(200);
      expect(robotsResponse.headers['content-type']).toContain('text/plain');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle various error scenarios gracefully', async () => {
      // Invalid authentication
      const invalidAuthResponse = await request(app)
        .get('/api/v1/watches')
        .set('Authorization', 'Bearer invalid-token');

      expect(invalidAuthResponse.status).toBe(401);

      // Non-existent resource
      const notFoundResponse = await request(app)
        .get('/api/products/non-existent-product');

      expect(notFoundResponse.status).toBe(404);

      // Invalid input data
      const invalidDataResponse = await request(app)
        .post('/api/v1/watches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: '', // Invalid empty product ID
          retailers: [],
          maxPrice: -10 // Invalid negative price
        });

      expect(invalidDataResponse.status).toBe(400);

      // Unauthorized admin access
      const unauthorizedAdminResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(unauthorizedAdminResponse.status).toBe(403);
    });

    it('should handle rate limiting', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const promises = Array(25).fill(null).map(() =>
        request(app)
          .get('/api/products/search')
          .query({ q: 'test' })
      );

      const results = await Promise.allSettled(promises);
      const rateLimitedRequests = results.filter(
        result => result.status === 'fulfilled' && 
        (result.value as any).status === 429
      );

      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();

      // Make concurrent requests to various endpoints
      const promises = [
        request(app).get('/health'),
        request(app).get('/api/products/search?q=pokemon&limit=5'),
        request(app).get('/api/v1/watches/packs'),
        request(app).get('/api/ml/trending-products').set('Authorization', `Bearer ${authToken}`),
        request(app).get('/api/alerts').set('Authorization', `Bearer ${authToken}`),
        request(app).get('/api/subscription/plans'),
        request(app).get('/api/community/testimonials?limit=5'),
        request(app).get('/sitemap.xml'),
        request(app).get('/robots.txt'),
        request(app).get('/health/detailed')
      ];

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds

      // Most requests should succeed
      const successfulRequests = results.filter(
        result => result.status === 'fulfilled' && 
        (result.value as any).status < 400
      );

      expect(successfulRequests.length).toBeGreaterThanOrEqual(8);
    });

    it('should maintain response times under load', async () => {
      const responseTimePromises = Array(10).fill(null).map(async () => {
        const startTime = Date.now();
        
        await request(app)
          .get('/api/products/search')
          .query({ q: 'pokemon', limit: 5 });
        
        return Date.now() - startTime;
      });

      const responseTimes = await Promise.all(responseTimePromises);
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

      // Average response time should be reasonable
      expect(averageResponseTime).toBeLessThan(1000); // 1 second
    });
  });
});