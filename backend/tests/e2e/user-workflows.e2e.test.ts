import request from 'supertest';
import { app } from '../../src/index';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/testHelpers';

describe('End-to-End User Workflows', () => {
  let server: any;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    server = app.listen(0); // Use random port for testing
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    if (server) {
      server.close();
    }
  });

  describe('Complete User Registration and Alert Setup Workflow', () => {
    it('should complete full user journey from registration to receiving alerts', async () => {
      // Step 1: User Registration
      const registrationData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      const registrationResponse = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(201);

      expect(registrationResponse.body.user.email).toBe(registrationData.email);
      userId = registrationResponse.body.user.id;

      // Step 2: User Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: registrationData.email,
          password: registrationData.password
        })
        .expect(200);

      authToken = loginResponse.body.token;
      expect(authToken).toBeDefined();

      // Step 3: Set User Preferences
      const preferences = {
        notificationChannels: ['web_push', 'email'],
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
          timezone: 'America/New_York'
        },
        alertFilters: {
          maxPrice: 100,
          retailers: ['bestbuy', 'walmart'],
          categories: ['booster-packs', 'elite-trainer-boxes']
        }
      };

      await request(app)
        .put('/api/users/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(preferences)
        .expect(200);

      // Step 4: Add Shipping Address
      const shippingAddress = {
        firstName: 'Test',
        lastName: 'User',
        street: '123 Test St',
        city: 'Test City',
        state: 'NY',
        zipCode: '12345',
        country: 'US',
        isDefault: true
      };

      await request(app)
        .post('/api/users/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(shippingAddress)
        .expect(201);

      // Step 5: Search for Products
      const searchResponse = await request(app)
        .get('/api/products/search')
        .query({
          q: 'Pokemon TCG Booster Pack',
          category: 'booster-packs',
          retailer: 'bestbuy'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(searchResponse.body.products).toBeDefined();
      expect(Array.isArray(searchResponse.body.products)).toBe(true);

      // Step 6: Create Product Watch
      const productId = 'test-product-id';
      const watchData = {
        productId,
        retailers: ['bestbuy', 'walmart'],
        maxPrice: 50,
        notificationChannels: ['web_push', 'email'],
        isActive: true
      };

      const watchResponse = await request(app)
        .post('/api/watches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(watchData)
        .expect(201);

      const watchId = watchResponse.body.watch.id;
      expect(watchId).toBeDefined();

      // Step 7: Subscribe to Watch Pack
      const watchPackData = {
        name: 'Popular TCG Sets',
        productIds: [productId, 'another-product-id'],
        retailers: ['bestbuy', 'walmart'],
        maxPrice: 100
      };

      await request(app)
        .post('/api/watch-packs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(watchPackData)
        .expect(201);

      // Step 8: Verify Watch Status
      const watchStatusResponse = await request(app)
        .get(`/api/watches/${watchId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(watchStatusResponse.body.status).toBe('active');

      // Step 9: Simulate Product Availability Change (Alert Generation)
      // This would normally be triggered by the monitoring service
      const alertData = {
        userId,
        productId,
        retailerId: 'bestbuy',
        type: 'restock',
        priority: 'high',
        data: {
          productName: 'Pokemon TCG Booster Pack',
          retailerName: 'Best Buy',
          price: 45.99,
          availability: 'in_stock',
          productUrl: 'https://bestbuy.com/product/123',
          cartUrl: 'https://bestbuy.com/cart/add/123'
        }
      };

      const alertResponse = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(alertData)
        .expect(201);

      const alertId = alertResponse.body.alert.id;

      // Step 10: Check Alert Inbox
      const alertsResponse = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(alertsResponse.body.alerts).toHaveLength(1);
      expect(alertsResponse.body.alerts[0].id).toBe(alertId);

      // Step 11: Mark Alert as Read
      await request(app)
        .put(`/api/alerts/${alertId}/read`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Step 12: View Alert History
      const historyResponse = await request(app)
        .get('/api/alerts/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(historyResponse.body.alerts).toHaveLength(1);

      // Step 13: Update Watch Settings
      const updatedWatchData = {
        maxPrice: 40,
        notificationChannels: ['web_push']
      };

      await request(app)
        .put(`/api/watches/${watchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedWatchData)
        .expect(200);

      // Step 14: Deactivate Watch
      await request(app)
        .delete(`/api/watches/${watchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Step 15: Verify Watch Deactivation
      const deactivatedWatchResponse = await request(app)
        .get(`/api/watches/${watchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(deactivatedWatchResponse.body.watch.isActive).toBe(false);
    }, 60000); // 60 second timeout for full workflow
  });

  describe('Pro User Upgrade Workflow', () => {
    it('should handle pro subscription upgrade and advanced features', async () => {
      // Login as existing user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePassword123!'
        })
        .expect(200);

      authToken = loginResponse.body.token;

      // Check current subscription status
      const profileResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(profileResponse.body.user.subscriptionTier).toBe('free');

      // Simulate subscription upgrade
      const upgradeData = {
        tier: 'pro',
        paymentMethodId: 'pm_test_card',
        billingAddress: {
          street: '123 Test St',
          city: 'Test City',
          state: 'NY',
          zipCode: '12345',
          country: 'US'
        }
      };

      await request(app)
        .post('/api/subscriptions/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send(upgradeData)
        .expect(200);

      // Verify pro features are now available
      const updatedProfileResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(updatedProfileResponse.body.user.subscriptionTier).toBe('pro');

      // Test pro-only features
      // 1. Unlimited watches (create more than free tier limit)
      const watchPromises = [];
      for (let i = 0; i < 15; i++) {
        watchPromises.push(
          request(app)
            .post('/api/watches')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              productId: `pro-product-${i}`,
              retailers: ['bestbuy'],
              maxPrice: 100,
              isActive: true
            })
        );
      }

      const watchResponses = await Promise.all(watchPromises);
      watchResponses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // 2. Access ML predictions
      const mlResponse = await request(app)
        .get('/api/ml/predictions/pro-product-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(mlResponse.body.predictions).toBeDefined();

      // 3. Historical data access
      const historyResponse = await request(app)
        .get('/api/products/pro-product-1/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body.history).toBeDefined();

      // 4. Advanced analytics
      const analyticsResponse = await request(app)
        .get('/api/analytics/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(analyticsResponse.body.analytics).toBeDefined();
    });
  });

  describe('Admin Management Workflow', () => {
    let adminToken: string;

    beforeAll(async () => {
      // Create admin user
      const adminData = {
        email: 'admin@boosterbeacon.com',
        password: 'AdminPassword123!',
        role: 'admin'
      };

      await request(app)
        .post('/api/auth/register')
        .send(adminData)
        .expect(201);

      const adminLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: adminData.email,
          password: adminData.password
        })
        .expect(200);

      adminToken = adminLoginResponse.body.token;
    });

    it('should complete admin management tasks', async () => {
      // 1. View system health
      const healthResponse = await request(app)
        .get('/api/admin/system/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');

      // 2. Manage users
      const usersResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(Array.isArray(usersResponse.body.users)).toBe(true);

      // 3. View analytics
      const analyticsResponse = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(analyticsResponse.body.metrics).toBeDefined();

      // 4. Trigger ML model training
      const mlTrainingResponse = await request(app)
        .post('/api/admin/ml/train')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ modelType: 'price_prediction' })
        .expect(200);

      expect(mlTrainingResponse.body.trainingId).toBeDefined();

      // 5. Manage retailer integrations
      const retailersResponse = await request(app)
        .get('/api/admin/retailers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(retailersResponse.body.retailers)).toBe(true);
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should handle network failures gracefully', async () => {
      // Simulate network timeout
      const timeoutResponse = await request(app)
        .get('/api/products/search')
        .query({ q: 'timeout-test' })
        .set('Authorization', `Bearer ${authToken}`)
        .timeout(100) // Very short timeout
        .expect(408);

      expect(timeoutResponse.body.error.code).toBe('REQUEST_TIMEOUT');
    });

    it('should handle rate limiting', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/products/search')
          .query({ q: 'rate-limit-test' })
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.allSettled(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(
        (result) => result.status === 'fulfilled' && 
        (result.value as any).status === 429
      );

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle authentication failures', async () => {
      // Test with invalid token
      const invalidTokenResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(invalidTokenResponse.body.error.code).toBe('INVALID_TOKEN');

      // Test with expired token
      const expiredTokenResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer expired-token')
        .expect(401);

      expect(expiredTokenResponse.body.error.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('Data Consistency Workflows', () => {
    it('should maintain data consistency across operations', async () => {
      // Create watch
      const watchResponse = await request(app)
        .post('/api/watches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'consistency-test-product',
          retailers: ['bestbuy'],
          maxPrice: 50,
          isActive: true
        })
        .expect(201);

      const watchId = watchResponse.body.watch.id;

      // Generate alert for the watch
      const alertResponse = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId,
          productId: 'consistency-test-product',
          retailerId: 'bestbuy',
          type: 'restock',
          priority: 'medium',
          data: {
            productName: 'Consistency Test Product',
            retailerName: 'Best Buy',
            price: 45.99,
            availability: 'in_stock',
            productUrl: 'https://bestbuy.com/product/consistency'
          }
        })
        .expect(201);

      const alertId = alertResponse.body.alert.id;

      // Verify watch and alert are linked
      const watchDetailsResponse = await request(app)
        .get(`/api/watches/${watchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const alertDetailsResponse = await request(app)
        .get(`/api/alerts/${alertId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(watchDetailsResponse.body.watch.productId).toBe(
        alertDetailsResponse.body.alert.productId
      );

      // Delete watch and verify alert history is preserved
      await request(app)
        .delete(`/api/watches/${watchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Alert should still exist in history
      const historyResponse = await request(app)
        .get('/api/alerts/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const alertInHistory = historyResponse.body.alerts.find(
        (alert: any) => alert.id === alertId
      );
      expect(alertInHistory).toBeDefined();
    });
  });
});