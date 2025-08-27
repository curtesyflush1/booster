import request from 'supertest';
import app from '../../src/index';
import { WatchPack } from '../../src/models/WatchPack';
import { UserWatchPack } from '../../src/models/UserWatchPack';
import { Watch } from '../../src/models/Watch';
import { generateTestToken } from '../helpers/authTestHelpers';
import { createTestUser, createTestProduct } from '../helpers/testHelpers';

describe('WatchPack Controller', () => {
  let testUser: any;
  let testProduct1: any;
  let testProduct2: any;
  let authToken: string;

  beforeEach(async () => {
    // Create test user and products
    testUser = await createTestUser();
    testProduct1 = await createTestProduct('Test Product 1');
    testProduct2 = await createTestProduct('Test Product 2');
    authToken = generateTestToken(testUser.id);
  });

  describe('GET /api/watches/packs', () => {
    let testPack: any;

    beforeEach(async () => {
      testPack = await WatchPack.createWatchPack({
        name: 'Test Pack',
        slug: 'test-pack',
        description: 'A test watch pack',
        product_ids: [testProduct1.id, testProduct2.id],
        is_active: true,
        auto_update: true,
        subscriber_count: 5
      });
    });

    it('should get all active watch packs', async () => {
      const response = await request(app)
        .get('/api/watches/packs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0]).toMatchObject({
        id: testPack.id,
        name: 'Test Pack',
        slug: 'test-pack',
        description: 'A test watch pack',
        product_ids: [testProduct1.id, testProduct2.id],
        is_active: true
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/watches/packs?page=1&limit=10')
        .expect(200);

      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(10);
    });

    it('should support search', async () => {
      const response = await request(app)
        .get('/api/watches/packs?search=test')
        .expect(200);

      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].name).toContain('Test');
    });
  });

  describe('GET /api/watches/packs/popular', () => {
    beforeEach(async () => {
      await WatchPack.createWatchPack({
        name: 'Popular Pack',
        slug: 'popular-pack',
        product_ids: [testProduct1.id],
        subscriber_count: 100,
        is_active: true
      });

      await WatchPack.createWatchPack({
        name: 'Less Popular Pack',
        slug: 'less-popular-pack',
        product_ids: [testProduct2.id],
        subscriber_count: 10,
        is_active: true
      });
    });

    it('should get popular watch packs ordered by subscriber count', async () => {
      const response = await request(app)
        .get('/api/watches/packs/popular?limit=5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('Popular Pack');
      expect(response.body.data[0].subscriber_count).toBe(100);
      expect(response.body.data[1].name).toBe('Less Popular Pack');
    });
  });

  describe('GET /api/watches/packs/:packId', () => {
    let testPack: any;

    beforeEach(async () => {
      testPack = await WatchPack.createWatchPack({
        name: 'Test Pack',
        slug: 'test-pack',
        description: 'A test watch pack',
        product_ids: [testProduct1.id, testProduct2.id],
        is_active: true
      });
    });

    it('should get watch pack by ID', async () => {
      const response = await request(app)
        .get(`/api/watches/packs/${testPack.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testPack.id,
        name: 'Test Pack',
        slug: 'test-pack'
      });
    });

    it('should get watch pack by slug', async () => {
      const response = await request(app)
        .get('/api/watches/packs/test-pack')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testPack.id,
        name: 'Test Pack',
        slug: 'test-pack'
      });
    });

    it('should return 404 for non-existent pack', async () => {
      await request(app)
        .get('/api/watches/packs/non-existent-pack')
        .expect(404);
    });

    it('should return 404 for inactive pack', async () => {
      await WatchPack.updateById(testPack.id, { is_active: false });

      await request(app)
        .get(`/api/watches/packs/${testPack.id}`)
        .expect(404);
    });
  });

  describe('POST /api/watches/packs', () => {
    it('should create a new watch pack', async () => {
      const packData = {
        name: 'New Test Pack',
        slug: 'new-test-pack',
        description: 'A new test watch pack',
        product_ids: [testProduct1.id, testProduct2.id],
        auto_update: true,
        update_criteria: 'new releases'
      };

      const response = await request(app)
        .post('/api/watches/packs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(packData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: packData.name,
        slug: packData.slug,
        description: packData.description,
        product_ids: packData.product_ids,
        auto_update: packData.auto_update,
        is_active: true
      });
    });

    it('should fail with invalid product IDs', async () => {
      const packData = {
        name: 'Invalid Pack',
        slug: 'invalid-pack',
        product_ids: ['invalid-uuid']
      };

      const response = await request(app)
        .post('/api/watches/packs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(packData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should fail with non-existent product IDs', async () => {
      const packData = {
        name: 'Non-existent Pack',
        slug: 'non-existent-pack',
        product_ids: ['123e4567-e89b-12d3-a456-426614174000']
      };

      const response = await request(app)
        .post('/api/watches/packs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(packData)
        .expect(404);

      expect(response.body.error.message).toContain('Product not found');
    });

    it('should fail with duplicate slug', async () => {
      const packData = {
        name: 'First Pack',
        slug: 'duplicate-slug',
        product_ids: [testProduct1.id]
      };

      // Create first pack
      await request(app)
        .post('/api/watches/packs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(packData)
        .expect(201);

      // Try to create with same slug
      const duplicateData = {
        name: 'Second Pack',
        slug: 'duplicate-slug',
        product_ids: [testProduct2.id]
      };

      const response = await request(app)
        .post('/api/watches/packs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(duplicateData)
        .expect(409);

      expect(response.body.error.message).toContain('already exists');
    });
  });

  describe('POST /api/watches/packs/:packId/subscribe', () => {
    let testPack: any;

    beforeEach(async () => {
      testPack = await WatchPack.createWatchPack({
        name: 'Test Pack',
        slug: 'test-pack',
        product_ids: [testProduct1.id, testProduct2.id],
        is_active: true,
        subscriber_count: 0
      });
    });

    it('should subscribe user to watch pack', async () => {
      const customizations = {
        alert_preferences: {
          email: true,
          push: false
        }
      };

      const response = await request(app)
        .post(`/api/watches/packs/${testPack.id}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ customizations })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        user_id: testUser.id,
        watch_pack_id: testPack.id,
        customizations,
        is_active: true
      });

      // Verify individual watches were created
      const userWatches = await Watch.findByUserId(testUser.id);
      expect(userWatches.data).toHaveLength(2);

      // Verify subscriber count was updated
      const updatedPack = await WatchPack.findById<any>(testPack.id);
      expect(updatedPack?.subscriber_count).toBe(1);
    });

    it('should fail to subscribe to non-existent pack', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      await request(app)
        .post(`/api/watches/packs/${fakeId}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should fail to subscribe twice to same pack', async () => {
      // First subscription
      await request(app)
        .post(`/api/watches/packs/${testPack.id}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Second subscription attempt
      const response = await request(app)
        .post(`/api/watches/packs/${testPack.id}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);

      expect(response.body.error.message).toContain('Already subscribed');
    });

    it('should reactivate inactive subscription', async () => {
      // Create inactive subscription
      await UserWatchPack.subscribe(testUser.id, testPack.id);
      await UserWatchPack.toggleSubscription(testUser.id, testPack.id);

      const response = await request(app)
        .post(`/api/watches/packs/${testPack.id}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('reactivated');
    });
  });

  describe('DELETE /api/watches/packs/:packId/subscribe', () => {
    let testPack: any;
    let subscription: any;

    beforeEach(async () => {
      testPack = await WatchPack.createWatchPack({
        name: 'Test Pack',
        slug: 'test-pack',
        product_ids: [testProduct1.id, testProduct2.id],
        is_active: true,
        subscriber_count: 1
      });

      subscription = await UserWatchPack.subscribe(testUser.id, testPack.id);

      // Create individual watches
      await Watch.createWatch({
        user_id: testUser.id,
        product_id: testProduct1.id,
        retailer_ids: [],
        availability_type: 'both',
        is_active: true
      });
    });

    it('should unsubscribe user from watch pack', async () => {
      const response = await request(app)
        .delete(`/api/watches/packs/${testPack.id}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify subscription is deleted
      const deletedSubscription = await UserWatchPack.findUserSubscription(testUser.id, testPack.id);
      expect(deletedSubscription).toBeNull();

      // Verify subscriber count was updated
      const updatedPack = await WatchPack.findById<any>(testPack.id);
      expect(updatedPack?.subscriber_count).toBe(0);
    });

    it('should optionally remove individual watches', async () => {
      const response = await request(app)
        .delete(`/api/watches/packs/${testPack.id}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ remove_watches: true })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify individual watches were removed
      const userWatches = await Watch.findByUserId(testUser.id);
      expect(userWatches.data).toHaveLength(0);
    });

    it('should fail for non-existent subscription', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      await request(app)
        .delete(`/api/watches/packs/${fakeId}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/watches/packs/subscriptions', () => {
    let testPack: any;

    beforeEach(async () => {
      testPack = await WatchPack.createWatchPack({
        name: 'Test Pack',
        slug: 'test-pack',
        product_ids: [testProduct1.id],
        is_active: true
      });

      await UserWatchPack.subscribe(testUser.id, testPack.id, {
        alert_preferences: { email: true }
      });
    });

    it('should get user subscriptions', async () => {
      const response = await request(app)
        .get('/api/watches/packs/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0]).toMatchObject({
        user_id: testUser.id,
        watch_pack_id: testPack.id,
        is_active: true
      });
    });

    it('should support pagination and filtering', async () => {
      const response = await request(app)
        .get('/api/watches/packs/subscriptions?page=1&limit=10&is_active=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(10);
    });
  });

  describe('GET /api/watches/packs/subscriptions/detailed', () => {
    let testPack: any;

    beforeEach(async () => {
      testPack = await WatchPack.createWatchPack({
        name: 'Test Pack',
        slug: 'test-pack',
        description: 'Test description',
        product_ids: [testProduct1.id],
        is_active: true,
        subscriber_count: 1
      });

      await UserWatchPack.subscribe(testUser.id, testPack.id);
    });

    it('should get user subscriptions with pack details', async () => {
      const response = await request(app)
        .get('/api/watches/packs/subscriptions/detailed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        user_id: testUser.id,
        watch_pack_id: testPack.id,
        watch_pack: {
          id: testPack.id,
          name: 'Test Pack',
          slug: 'test-pack',
          description: 'Test description'
        }
      });
    });
  });

  describe('PUT /api/watches/packs/:packId/customizations', () => {
    let testPack: any;

    beforeEach(async () => {
      testPack = await WatchPack.createWatchPack({
        name: 'Test Pack',
        slug: 'test-pack',
        product_ids: [testProduct1.id],
        is_active: true
      });

      await UserWatchPack.subscribe(testUser.id, testPack.id, {
        alert_preferences: { email: true }
      });
    });

    it('should update subscription customizations', async () => {
      const newCustomizations = {
        alert_preferences: {
          email: false,
          push: true,
          sms: true
        },
        max_price: 100
      };

      const response = await request(app)
        .put(`/api/watches/packs/${testPack.id}/customizations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ customizations: newCustomizations })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.customizations).toMatchObject({
        alert_preferences: {
          email: false,
          push: true,
          sms: true
        },
        max_price: 100
      });
    });

    it('should fail for non-existent subscription', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      await request(app)
        .put(`/api/watches/packs/${fakeId}/customizations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ customizations: {} })
        .expect(404);
    });
  });

  describe('GET /api/watches/packs/subscriptions/stats', () => {
    beforeEach(async () => {
      const pack1 = await WatchPack.createWatchPack({
        name: 'Pack 1',
        slug: 'pack-1',
        product_ids: [testProduct1.id, testProduct2.id],
        is_active: true
      });

      const pack2 = await WatchPack.createWatchPack({
        name: 'Pack 2',
        slug: 'pack-2',
        product_ids: [testProduct1.id],
        is_active: true
      });

      await UserWatchPack.subscribe(testUser.id, pack1.id);
      await UserWatchPack.subscribe(testUser.id, pack2.id);
    });

    it('should get user subscription statistics', async () => {
      const response = await request(app)
        .get('/api/watches/packs/subscriptions/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        totalSubscriptions: 2,
        activeSubscriptions: 2,
        totalProducts: 3, // 2 + 1 products across packs
        recentSubscriptions: 2
      });
    });
  });

  describe('GET /api/watches/products/:productId/packs', () => {
    beforeEach(async () => {
      await WatchPack.createWatchPack({
        name: 'Pack with Product 1',
        slug: 'pack-with-product-1',
        product_ids: [testProduct1.id, testProduct2.id],
        is_active: true
      });

      await WatchPack.createWatchPack({
        name: 'Another Pack with Product 1',
        slug: 'another-pack-with-product-1',
        product_ids: [testProduct1.id],
        is_active: true
      });

      await WatchPack.createWatchPack({
        name: 'Pack without Product 1',
        slug: 'pack-without-product-1',
        product_ids: [testProduct2.id],
        is_active: true
      });
    });

    it('should find packs containing specific product', async () => {
      const response = await request(app)
        .get(`/api/watches/products/${testProduct1.id}/packs`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('Pack with Product 1');
      expect(response.body.data[1].name).toBe('Another Pack with Product 1');
    });

    it('should return empty array for product not in any packs', async () => {
      const product3 = await createTestProduct('Product 3');
      const response = await request(app)
        .get(`/api/watches/products/${product3.id}/packs`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });
  });
});