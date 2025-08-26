import { Alert } from '../../src/models/Alert';
import { db } from '../../src/config/database';

describe('Alert Model Integration', () => {
  beforeEach(async () => {
    // Clean up test data
    await db('alerts').del();
    await db('users').del();
    await db('products').del();
    await db('retailers').del();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('getUserAlertStats', () => {
    it('should handle user with no alerts', async () => {
      const stats = await Alert.getUserAlertStats('nonexistent-user');
      
      expect(stats.total).toBe(0);
      expect(stats.unread).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.byStatus).toEqual({});
      expect(stats.clickThroughRate).toBe(0);
      expect(stats.recentAlerts).toBe(0);
    });

    it('should calculate statistics correctly', async () => {
      // Create test user
      const [user] = await db('users').insert({
        id: 'test-user',
        email: 'test@example.com',
        password_hash: 'hash',
        subscription_tier: 'free',
        email_verified: true,
        failed_login_attempts: 0,
        notification_settings: {},
        quiet_hours: {},
        timezone: 'UTC',
        preferences: {}
      }).returning('*');

      // Create test product and retailer
      const [product] = await db('products').insert({
        id: 'test-product',
        name: 'Test Product',
        slug: 'test-product',
        is_active: true,
        popularity_score: 0,
        metadata: {}
      }).returning('*');

      const [retailer] = await db('retailers').insert({
        id: 'test-retailer',
        name: 'Test Retailer',
        slug: 'test-retailer',
        website_url: 'https://test.com',
        api_type: 'official',
        api_config: {},
        is_active: true,
        rate_limit_per_minute: 60,
        health_score: 100,
        supported_features: []
      }).returning('*');

      // Create test alerts
      const alertData = {
        user_id: user.id,
        product_id: product.id,
        retailer_id: retailer.id,
        type: 'restock',
        priority: 'medium',
        data: {
          product_name: 'Test Product',
          retailer_name: 'Test Retailer',
          availability_status: 'in_stock',
          product_url: 'https://test.com/product'
        },
        delivery_channels: ['email']
      };

      // Create alerts with different statuses
      await db('alerts').insert([
        { ...alertData, id: 'alert-1', status: 'sent', sent_at: new Date() },
        { ...alertData, id: 'alert-2', status: 'sent', sent_at: new Date(), clicked_at: new Date() },
        { ...alertData, id: 'alert-3', status: 'pending' },
        { ...alertData, id: 'alert-4', status: 'sent', sent_at: new Date(), read_at: new Date() }
      ]);

      const stats = await Alert.getUserAlertStats(user.id);

      expect(stats.total).toBe(4);
      expect(stats.unread).toBe(3); // Only alert-4 is read
      expect(stats.byType.restock).toBe(4);
      expect(stats.byStatus.sent).toBe(3);
      expect(stats.byStatus.pending).toBe(1);
      expect(stats.clickThroughRate).toBe(33.33); // 1 clicked out of 3 sent
    });
  });

  describe('getSystemAlertStats', () => {
    it('should handle empty system', async () => {
      const stats = await Alert.getSystemAlertStats();
      
      expect(stats.totalAlerts).toBe(0);
      expect(stats.pendingAlerts).toBe(0);
      expect(stats.failedAlerts).toBe(0);
      expect(stats.avgDeliveryTime).toBe(0);
      expect(stats.alertsByType).toEqual({});
      expect(stats.alertsByPriority).toEqual({});
    });
  });

  describe('findByUserId with pagination', () => {
    it('should handle pagination correctly', async () => {
      // Create test user
      const [user] = await db('users').insert({
        id: 'test-user',
        email: 'test@example.com',
        password_hash: 'hash',
        subscription_tier: 'free',
        email_verified: true,
        failed_login_attempts: 0,
        notification_settings: {},
        quiet_hours: {},
        timezone: 'UTC',
        preferences: {}
      }).returning('*');

      // Create test product and retailer
      const [product] = await db('products').insert({
        id: 'test-product',
        name: 'Test Product',
        slug: 'test-product',
        is_active: true,
        popularity_score: 0,
        metadata: {}
      }).returning('*');

      const [retailer] = await db('retailers').insert({
        id: 'test-retailer',
        name: 'Test Retailer',
        slug: 'test-retailer',
        website_url: 'https://test.com',
        api_type: 'official',
        api_config: {},
        is_active: true,
        rate_limit_per_minute: 60,
        health_score: 100,
        supported_features: []
      }).returning('*');

      // Create 15 test alerts
      const alerts = Array.from({ length: 15 }, (_, i) => ({
        id: `alert-${i}`,
        user_id: user.id,
        product_id: product.id,
        retailer_id: retailer.id,
        type: 'restock',
        priority: 'medium',
        status: 'sent',
        data: {
          product_name: 'Test Product',
          retailer_name: 'Test Retailer',
          availability_status: 'in_stock',
          product_url: 'https://test.com/product'
        },
        delivery_channels: ['email'],
        retry_count: 0
      }));

      await db('alerts').insert(alerts);

      // Test first page
      const page1 = await Alert.findByUserId(user.id, { page: 1, limit: 10 });
      expect(page1.data).toHaveLength(10);
      expect(page1.total).toBe(15);
      expect(page1.page).toBe(1);
      expect(page1.limit).toBe(10);

      // Test second page
      const page2 = await Alert.findByUserId(user.id, { page: 2, limit: 10 });
      expect(page2.data).toHaveLength(5);
      expect(page2.total).toBe(15);
      expect(page2.page).toBe(2);
      expect(page2.limit).toBe(10);
    });
  });
});