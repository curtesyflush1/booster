import request from 'supertest';
import app from '../../src/index';
import { Watch } from '../../src/models/Watch';
import { WatchPack } from '../../src/models/WatchPack';
import { UserWatchPack } from '../../src/models/UserWatchPack';
import { Product } from '../../src/models/Product';
import { User } from '../../src/models/User';
import { generateTestToken } from '../helpers/authTestHelpers';
import { createTestUser, createTestProduct } from '../helpers/testHelpers';

describe('Watch Controller', () => {
  let testUser: any;
  let testProduct: any;
  let authToken: string;

  beforeEach(async () => {
    // Create test user and product
    testUser = await createTestUser();
    testProduct = await createTestProduct();
    authToken = generateTestToken(testUser.id);
  });

  describe('POST /api/watches', () => {
    it('should create a new watch successfully', async () => {
      const watchData = {
        product_id: testProduct.id,
        retailer_ids: ['retailer-1', 'retailer-2'],
        max_price: 99.99,
        availability_type: 'both',
        zip_code: '12345',
        radius_miles: 25,
        alert_preferences: {
          email: true,
          push: true
        }
      };

      const response = await request(app)
        .post('/api/watches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(watchData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        user_id: testUser.id,
        product_id: testProduct.id,
        retailer_ids: watchData.retailer_ids,
        max_price: watchData.max_price,
        availability_type: watchData.availability_type,
        zip_code: watchData.zip_code,
        radius_miles: watchData.radius_miles,
        is_active: true
      });
    });

    it('should fail to create watch without product_id', async () => {
      const watchData = {
        retailer_ids: ['retailer-1'],
        max_price: 99.99
      };

      const response = await request(app)
        .post('/api/watches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(watchData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should fail to create duplicate watch for same product', async () => {
      const watchData = {
        product_id: testProduct.id,
        retailer_ids: ['retailer-1']
      };

      // Create first watch
      await request(app)
        .post('/api/watches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(watchData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/watches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(watchData)
        .expect(409);

      expect(response.body.error.message).toContain('already exists');
    });

    it('should fail without authentication', async () => {
      const watchData = {
        product_id: testProduct.id,
        retailer_ids: ['retailer-1']
      };

      await request(app)
        .post('/api/watches')
        .send(watchData)
        .expect(401);
    });
  });

  describe('GET /api/watches', () => {
    let testWatch: any;

    beforeEach(async () => {
      testWatch = await Watch.createWatch({
        user_id: testUser.id,
        product_id: testProduct.id,
        retailer_ids: ['retailer-1'],
        availability_type: 'both',
        is_active: true
      });
    });

    it('should get user watches successfully', async () => {
      const response = await request(app)
        .get('/api/watches')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0]).toMatchObject({
        id: testWatch.id,
        user_id: testUser.id,
        product_id: testProduct.id
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/watches?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(10);
    });

    it('should filter by active status', async () => {
      // Create inactive watch
      await Watch.createWatch({
        user_id: testUser.id,
        product_id: testProduct.id,
        retailer_ids: ['retailer-2'],
        availability_type: 'both',
        is_active: false
      });

      const response = await request(app)
        .get('/api/watches?is_active=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].is_active).toBe(true);
    });
  });

  describe('GET /api/watches/:watchId', () => {
    let testWatch: any;

    beforeEach(async () => {
      testWatch = await Watch.createWatch({
        user_id: testUser.id,
        product_id: testProduct.id,
        retailer_ids: ['retailer-1'],
        availability_type: 'both',
        is_active: true
      });
    });

    it('should get specific watch successfully', async () => {
      const response = await request(app)
        .get(`/api/watches/${testWatch.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testWatch.id,
        user_id: testUser.id,
        product_id: testProduct.id
      });
    });

    it('should fail with invalid watch ID', async () => {
      await request(app)
        .get('/api/watches/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should fail for non-existent watch', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      await request(app)
        .get(`/api/watches/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should fail for watch owned by different user', async () => {
      const otherUser = await createTestUser('other@example.com');
      const otherWatch = await Watch.createWatch({
        user_id: otherUser.id,
        product_id: testProduct.id,
        retailer_ids: ['retailer-1'],
        availability_type: 'both',
        is_active: true
      });

      await request(app)
        .get(`/api/watches/${otherWatch.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('PUT /api/watches/:watchId', () => {
    let testWatch: any;

    beforeEach(async () => {
      testWatch = await Watch.createWatch({
        user_id: testUser.id,
        product_id: testProduct.id,
        retailer_ids: ['retailer-1'],
        availability_type: 'both',
        max_price: 50.00,
        is_active: true
      });
    });

    it('should update watch successfully', async () => {
      const updateData = {
        retailer_ids: ['retailer-1', 'retailer-2'],
        max_price: 75.00,
        availability_type: 'online',
        zip_code: '54321',
        radius_miles: 50
      };

      const response = await request(app)
        .put(`/api/watches/${testWatch.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testWatch.id,
        retailer_ids: updateData.retailer_ids,
        max_price: updateData.max_price,
        availability_type: updateData.availability_type,
        zip_code: updateData.zip_code,
        radius_miles: updateData.radius_miles
      });
    });

    it('should update alert preferences', async () => {
      const updateData = {
        alert_preferences: {
          email: false,
          push: true,
          sms: true
        }
      };

      const response = await request(app)
        .put(`/api/watches/${testWatch.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.alert_preferences).toMatchObject(updateData.alert_preferences);
    });

    it('should fail for non-existent watch', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      await request(app)
        .put(`/api/watches/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ max_price: 100 })
        .expect(404);
    });
  });

  describe('DELETE /api/watches/:watchId', () => {
    let testWatch: any;

    beforeEach(async () => {
      testWatch = await Watch.createWatch({
        user_id: testUser.id,
        product_id: testProduct.id,
        retailer_ids: ['retailer-1'],
        availability_type: 'both',
        is_active: true
      });
    });

    it('should delete watch successfully', async () => {
      const response = await request(app)
        .delete(`/api/watches/${testWatch.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify watch is deleted
      const deletedWatch = await Watch.findById(testWatch.id);
      expect(deletedWatch).toBeNull();
    });

    it('should fail for non-existent watch', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      await request(app)
        .delete(`/api/watches/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/watches/:watchId/toggle', () => {
    let testWatch: any;

    beforeEach(async () => {
      testWatch = await Watch.createWatch({
        user_id: testUser.id,
        product_id: testProduct.id,
        retailer_ids: ['retailer-1'],
        availability_type: 'both',
        is_active: true
      });
    });

    it('should toggle watch status successfully', async () => {
      const response = await request(app)
        .patch(`/api/watches/${testWatch.id}/toggle`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.is_active).toBe(false);

      // Toggle back
      const response2 = await request(app)
        .patch(`/api/watches/${testWatch.id}/toggle`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response2.body.data.is_active).toBe(true);
    });
  });

  describe('GET /api/watches/stats', () => {
    beforeEach(async () => {
      // Create multiple watches for testing
      await Watch.createWatch({
        user_id: testUser.id,
        product_id: testProduct.id,
        retailer_ids: ['retailer-1'],
        availability_type: 'both',
        is_active: true,
        alert_count: 5
      });

      const product2 = await createTestProduct('Test Product 2');
      await Watch.createWatch({
        user_id: testUser.id,
        product_id: product2.id,
        retailer_ids: ['retailer-2'],
        availability_type: 'online',
        is_active: false,
        alert_count: 2
      });
    });

    it('should get user watch statistics', async () => {
      const response = await request(app)
        .get('/api/watches/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        total: 2,
        active: 1,
        totalAlerts: 7
      });
    });
  });

  describe('GET /api/watches/:watchId/health', () => {
    let testWatch: any;

    beforeEach(async () => {
      testWatch = await Watch.createWatch({
        user_id: testUser.id,
        product_id: testProduct.id,
        retailer_ids: ['retailer-1'],
        availability_type: 'both',
        is_active: true
      });
    });

    it('should get watch health status', async () => {
      const response = await request(app)
        .get(`/api/watches/${testWatch.id}/health`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        watchId: testWatch.id,
        productId: testProduct.id,
        userId: testUser.id,
        isHealthy: expect.any(Boolean),
        issues: expect.any(Array)
      });
    });
  });

  describe('CSV Import/Export', () => {
    it('should export watches to CSV', async () => {
      await Watch.createWatch({
        user_id: testUser.id,
        product_id: testProduct.id,
        retailer_ids: ['retailer-1'],
        availability_type: 'both',
        is_active: true
      });

      const response = await request(app)
        .get('/api/watches/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('attachment; filename="watches.csv"');
      expect(response.text).toContain('id,product_id,retailer_ids');
    });

    it('should import watches from CSV', async () => {
      const product2 = await createTestProduct('Test Product 2');
      const csvContent = `product_id,retailer_ids,max_price,availability_type
${product2.id},"retailer-1,retailer-2",99.99,both`;

      const response = await request(app)
        .post('/api/watches/import')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('csv', Buffer.from(csvContent), 'watches.csv')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.created).toBe(1);
      expect(response.body.data.errors).toBe(0);
    });

    it('should handle CSV import errors', async () => {
      const csvContent = `product_id,retailer_ids,max_price,availability_type
invalid-uuid,"retailer-1",99.99,both`;

      const response = await request(app)
        .post('/api/watches/import')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('csv', Buffer.from(csvContent), 'watches.csv')
        .expect(400);

      expect(response.body.error.message).toContain('No valid watches to create');
    });
  });
});