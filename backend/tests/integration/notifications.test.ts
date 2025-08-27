import request from 'supertest';
import app from '../../src/index';
import { User } from '../../src/models/User';
import { WebPushService } from '../../src/services/notifications/webPushService';
import { createTestUser, cleanupTestUser } from '../helpers/userTestHelpers';

// Mock WebPushService
jest.mock('../../src/services/notifications/webPushService');
const mockWebPushService = WebPushService as jest.Mocked<typeof WebPushService>;

describe('Notification Routes Integration', () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Create test user and get auth token
    const userResult = await createTestUser();
    testUser = userResult.user;
    authToken = userResult.token;
  });

  afterAll(async () => {
    // Clean up test user
    if (testUser) {
      await cleanupTestUser(testUser.id);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup environment variables
    process.env.VAPID_PUBLIC_KEY = 'test-public-key';
    process.env.VAPID_PRIVATE_KEY = 'test-private-key';
  });

  afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  describe('GET /api/notifications/vapid-public-key', () => {
    it('should return VAPID public key', async () => {
      const response = await request(app)
        .get('/api/notifications/vapid-public-key')
        .expect(200);

      expect(response.body).toHaveProperty('publicKey');
      expect(response.body.publicKey).toBe('test-public-key');
    });

    it('should return error when VAPID key not configured', async () => {
      delete process.env.VAPID_PUBLIC_KEY;

      const response = await request(app)
        .get('/api/notifications/vapid-public-key')
        .expect(503);

      expect(response.body.error.code).toBe('PUSH_NOT_CONFIGURED');
    });
  });

  describe('POST /api/notifications/subscribe', () => {
    const validSubscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
      keys: {
        p256dh: 'test-p256dh-key',
        auth: 'test-auth-key'
      }
    };

    it('should subscribe user to push notifications', async () => {
      mockWebPushService.subscribe.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validSubscription)
        .expect(201);

      expect(response.body.message).toBe('Successfully subscribed to push notifications');
      expect(mockWebPushService.subscribe).toHaveBeenCalledWith(
        testUser.id,
        validSubscription
      );
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/notifications/subscribe')
        .send(validSubscription)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should validate subscription data', async () => {
      const invalidSubscription = {
        endpoint: 'invalid-url',
        keys: {
          p256dh: 'test-key'
          // Missing auth key
        }
      };

      const response = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidSubscription)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle subscription service errors', async () => {
      mockWebPushService.subscribe.mockResolvedValue({
        success: false,
        error: 'Service unavailable'
      });

      const response = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validSubscription)
        .expect(400);

      expect(response.body.error.code).toBe('SUBSCRIPTION_FAILED');
      expect(response.body.error.message).toBe('Service unavailable');
    });
  });

  describe('POST /api/notifications/unsubscribe', () => {
    const unsubscribeData = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint'
    };

    it('should unsubscribe user from push notifications', async () => {
      mockWebPushService.unsubscribe.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/notifications/unsubscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send(unsubscribeData)
        .expect(200);

      expect(response.body.message).toBe('Successfully unsubscribed from push notifications');
      expect(mockWebPushService.unsubscribe).toHaveBeenCalledWith(
        testUser.id,
        unsubscribeData.endpoint
      );
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/notifications/unsubscribe')
        .send(unsubscribeData)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should validate endpoint', async () => {
      const invalidData = {
        endpoint: 'invalid-url'
      };

      const response = await request(app)
        .post('/api/notifications/unsubscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle unsubscription service errors', async () => {
      mockWebPushService.unsubscribe.mockResolvedValue({
        success: false,
        error: 'Subscription not found'
      });

      const response = await request(app)
        .post('/api/notifications/unsubscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send(unsubscribeData)
        .expect(400);

      expect(response.body.error.code).toBe('UNSUBSCRIPTION_FAILED');
    });
  });

  describe('POST /api/notifications/test', () => {
    it('should send test notification', async () => {
      mockWebPushService.sendTestNotification.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Test notification sent successfully');
      expect(mockWebPushService.sendTestNotification).toHaveBeenCalledWith(testUser.id);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/notifications/test')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should handle test notification service errors', async () => {
      mockWebPushService.sendTestNotification.mockResolvedValue({
        success: false,
        error: 'No subscriptions found'
      });

      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('TEST_NOTIFICATION_FAILED');
    });
  });

  describe('GET /api/notifications/stats', () => {
    it('should return push notification statistics', async () => {
      const mockStats = {
        subscriptionCount: 2,
        notificationsSent: 15,
        lastNotificationSent: new Date()
      };
      mockWebPushService.getUserPushStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/notifications/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.stats).toEqual(expect.objectContaining({
        subscriptionCount: 2,
        notificationsSent: 15
      }));
      expect(mockWebPushService.getUserPushStats).toHaveBeenCalledWith(testUser.id);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/notifications/stats')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  describe('GET /api/notifications/subscriptions', () => {
    it('should return user subscriptions without sensitive data', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          endpoint: 'https://fcm.googleapis.com/fcm/send/endpoint-1',
          keys: {
            p256dh: 'sensitive-key-1',
            auth: 'sensitive-auth-1'
          },
          createdAt: new Date(),
          lastUsed: new Date()
        },
        {
          id: 'sub-2',
          endpoint: 'https://fcm.googleapis.com/fcm/send/endpoint-2',
          keys: {
            p256dh: 'sensitive-key-2',
            auth: 'sensitive-auth-2'
          },
          createdAt: new Date(),
          lastUsed: new Date()
        }
      ];
      
      // Mock the private method by mocking User.findById
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: testUser.id,
        push_subscriptions: mockSubscriptions
      } as any);

      const response = await request(app)
        .get('/api/notifications/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.count).toBe(2);
      expect(response.body.subscriptions).toHaveLength(2);
      
      // Check that sensitive data is removed
      response.body.subscriptions.forEach((sub: any) => {
        expect(sub).toHaveProperty('id');
        expect(sub).toHaveProperty('createdAt');
        expect(sub).toHaveProperty('lastUsed');
        expect(sub.endpoint).toMatch(/\.{3}$/); // Should end with '...'
        expect(sub).not.toHaveProperty('keys'); // Sensitive keys should be removed
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/notifications/subscriptions')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to notification endpoints', async () => {
      // Make multiple requests quickly to trigger rate limiting
      const requests = Array(60).fill(null).map(() =>
        request(app)
          .get('/api/notifications/vapid-public-key')
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle service worker initialization errors gracefully', async () => {
      mockWebPushService.subscribe.mockRejectedValue(new Error('Service worker not supported'));

      const response = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test',
          keys: {
            p256dh: 'test-key',
            auth: 'test-auth'
          }
        })
        .expect(500);

      expect(response.body.error).toBeDefined();
    });

    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });
});