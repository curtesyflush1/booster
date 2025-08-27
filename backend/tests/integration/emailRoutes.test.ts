import request from 'supertest';
import app from '../../src/index';
import { db as database } from '../../src/config/database';
import { AuthTestHelpers, generateTestToken } from '../helpers/authTestHelpers';

describe('Email Routes Integration', () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Create test user
    testUser = AuthTestHelpers.createMockUser({
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User'
    });
    authToken = generateTestToken(testUser.id);

    // Create default email preferences
    await database('email_preferences').insert({
      user_id: testUser.id,
      alert_emails: true,
      marketing_emails: true,
      weekly_digest: false,
      unsubscribe_token: 'test-token-123',
      created_at: new Date(),
      updated_at: new Date()
    });
  });

  afterAll(async () => {
    // Clean up test data
    await database('email_preferences').where({ user_id: testUser.id }).del();
    await database('users').where({ id: testUser.id }).del();
  });

  describe('GET /api/email/preferences', () => {
    it('should return user email preferences', async () => {
      const response = await request(app)
        .get('/api/email/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.preferences).toEqual({
        alertEmails: true,
        marketingEmails: true,
        weeklyDigest: false,
        updatedAt: expect.any(String)
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/email/preferences')
        .expect(401);
    });
  });

  describe('PUT /api/email/preferences', () => {
    it('should update email preferences', async () => {
      const response = await request(app)
        .put('/api/email/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          alertEmails: false,
          marketingEmails: true,
          weeklyDigest: true
        })
        .expect(200);

      expect(response.body.message).toBe('Email preferences updated successfully');
      expect(response.body.preferences).toEqual({
        alertEmails: false,
        marketingEmails: true,
        weeklyDigest: true,
        updatedAt: expect.any(String)
      });

      // Verify database was updated
      const preferences = await database('email_preferences')
        .where({ user_id: testUser.id })
        .first();

      expect(preferences.alert_emails).toBe(false);
      expect(preferences.marketing_emails).toBe(true);
      expect(preferences.weekly_digest).toBe(true);
    });

    it('should validate input data', async () => {
      await request(app)
        .put('/api/email/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          invalidField: true
        })
        .expect(400);
    });

    it('should require at least one preference', async () => {
      await request(app)
        .put('/api/email/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .put('/api/email/preferences')
        .send({
          alertEmails: false
        })
        .expect(401);
    });
  });

  describe('GET /api/email/unsubscribe', () => {
    beforeAll(async () => {
      // Create unsubscribe token
      await database('unsubscribe_tokens').insert({
        token: 'valid-unsubscribe-token',
        user_id: testUser.id,
        email_type: 'alerts',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        created_at: new Date()
      });
    });

    afterAll(async () => {
      await database('unsubscribe_tokens').where({ user_id: testUser.id }).del();
    });

    it('should process valid unsubscribe token', async () => {
      const response = await request(app)
        .get('/api/email/unsubscribe?token=valid-unsubscribe-token')
        .expect(200);

      expect(response.body.message).toContain('Successfully unsubscribed');
      expect(response.body.emailType).toBe('alerts');

      // Verify preferences were updated
      const preferences = await database('email_preferences')
        .where({ user_id: testUser.id })
        .first();

      expect(preferences.alert_emails).toBe(false);
    });

    it('should reject invalid token', async () => {
      await request(app)
        .get('/api/email/unsubscribe?token=invalid-token')
        .expect(400);
    });

    it('should require token parameter', async () => {
      await request(app)
        .get('/api/email/unsubscribe')
        .expect(400);
    });
  });

  describe('GET /api/email/stats', () => {
    beforeAll(async () => {
      // Create some test delivery logs
      await database('email_delivery_logs').insert([
        {
          id: 'log-1',
          user_id: testUser.id,
          email_type: 'alert',
          recipient_email: testUser.email,
          subject: 'Test Alert',
          sent_at: new Date(),
          delivered_at: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'log-2',
          user_id: testUser.id,
          email_type: 'welcome',
          recipient_email: testUser.email,
          subject: 'Welcome',
          sent_at: new Date(),
          bounced_at: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);
    });

    afterAll(async () => {
      await database('email_delivery_logs').where({ user_id: testUser.id }).del();
    });

    it('should return user email statistics', async () => {
      const response = await request(app)
        .get('/api/email/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.stats).toEqual({
        totalSent: 2,
        totalDelivered: 1,
        totalBounced: 1,
        totalComplained: 0,
        deliveryRate: 50,
        lastEmailSent: expect.any(String)
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/email/stats')
        .expect(401);
    });
  });

  describe('POST /api/email/test', () => {
    it('should test email configuration', async () => {
      // Mock successful email configuration test
      jest.mock('../../src/services/notifications/emailService', () => ({
        EmailService: {
          testEmailConfiguration: jest.fn().mockResolvedValue({ success: true })
        }
      }));

      const response = await request(app)
        .post('/api/email/test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Email configuration is working correctly');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/email/test')
        .expect(401);
    });
  });

  describe('POST /api/email/send-test', () => {
    it('should send test welcome email', async () => {
      // Mock successful email send
      jest.mock('../../src/services/notifications/emailService', () => ({
        EmailService: {
          sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true })
        }
      }));

      const response = await request(app)
        .post('/api/email/send-test')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'test@example.com',
          type: 'welcome'
        })
        .expect(200);

      expect(response.body.message).toContain('Test welcome email sent successfully');
    });

    it('should require email address', async () => {
      await request(app)
        .post('/api/email/send-test')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'welcome'
        })
        .expect(400);
    });

    it('should validate email type', async () => {
      await request(app)
        .post('/api/email/send-test')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'test@example.com',
          type: 'invalid'
        })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/email/send-test')
        .send({
          email: 'test@example.com',
          type: 'welcome'
        })
        .expect(401);
    });
  });

  describe('POST /api/email/webhook', () => {
    it('should process bounce webhook', async () => {
      const webhookData = {
        eventType: 'bounce',
        messageId: 'msg-123',
        bounceType: 'permanent',
        bounceSubType: 'general',
        bouncedRecipients: [
          {
            emailAddress: 'bounce@example.com',
            status: '5.1.1',
            action: 'failed'
          }
        ],
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/email/webhook')
        .send(webhookData)
        .expect(200);

      expect(response.body.message).toBe('Webhook processed successfully');
    });

    it('should process complaint webhook', async () => {
      const webhookData = {
        eventType: 'complaint',
        messageId: 'msg-123',
        complainedRecipients: [
          {
            emailAddress: 'complaint@example.com'
          }
        ],
        complaintFeedbackType: 'spam',
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/email/webhook')
        .send(webhookData)
        .expect(200);

      expect(response.body.message).toBe('Webhook processed successfully');
    });

    it('should process delivery webhook', async () => {
      const webhookData = {
        eventType: 'delivery',
        messageId: 'msg-123',
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/email/webhook')
        .send(webhookData)
        .expect(200);

      expect(response.body.message).toBe('Webhook processed successfully');
    });
  });
});