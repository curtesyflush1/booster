import request from 'supertest';
import app from '../../src/index';
import { EmailService } from '../../src/services/notifications/emailService';
import { EmailConfigService } from '../../src/services/emailConfigService';
import { AuthTestHelpers, generateTestToken } from '../helpers/authTestHelpers';

describe('Email System Integration', () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    testUser = AuthTestHelpers.createMockUser({
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User'
    });
    authToken = generateTestToken(testUser.id);
  });

  describe('Email Configuration', () => {
    it('should get email configuration status', async () => {
      const response = await request(app)
        .get('/api/email/config')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('configuration');
      expect(response.body).toHaveProperty('validation');
      expect(response.body).toHaveProperty('recommendations');
      expect(response.body).toHaveProperty('bestPractices');

      expect(response.body.configuration).toHaveProperty('provider');
      expect(response.body.configuration).toHaveProperty('host');
      expect(response.body.configuration).toHaveProperty('port');
    });

    it('should generate environment template', async () => {
      const response = await request(app)
        .get('/api/email/config/env-template')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('template');
      expect(response.body).toHaveProperty('instructions');
      expect(response.body.template).toContain('SMTP_HOST');
      expect(response.body.template).toContain('FROM_EMAIL');
    });
  });

  describe('Email Preferences', () => {
    it('should get user email preferences', async () => {
      const response = await request(app)
        .get('/api/email/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('preferences');
    });

    it('should update email preferences', async () => {
      const response = await request(app)
        .put('/api/email/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          alertEmails: true,
          marketingEmails: false,
          weeklyDigest: true
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('preferences');
    });
  });

  describe('Email Analytics', () => {
    it('should get email analytics', async () => {
      const response = await request(app)
        .get('/api/email/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('userStats');
      expect(response.body).toHaveProperty('systemStats');
      expect(response.body.userStats).toHaveProperty('deliveryRate');
      expect(response.body.systemStats).toHaveProperty('bounceRate');
    });

    it('should get email delivery stats', async () => {
      const response = await request(app)
        .get('/api/email/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('totalSent');
      expect(response.body.stats).toHaveProperty('deliveryRate');
    });
  });

  describe('Email Testing', () => {
    it('should test email configuration', async () => {
      const response = await request(app)
        .post('/api/email/test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should send test email', async () => {
      const response = await request(app)
        .post('/api/email/send-test')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'test@example.com',
          type: 'welcome'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('sent successfully');
    });

    it('should send digest email', async () => {
      const response = await request(app)
        .post('/api/email/send-digest')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('alertCount');
    });
  });

  describe('Unsubscribe', () => {
    it('should handle unsubscribe request', async () => {
      const response = await request(app)
        .get('/api/email/unsubscribe?token=test_token_123')
        .expect(400); // Invalid token expected

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Email Service Functions', () => {
    it('should validate email configuration', async () => {
      const validation = await EmailConfigService.validateConfiguration();
      
      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('errors');
      expect(validation).toHaveProperty('warnings');
      expect(validation).toHaveProperty('configuration');
    });

    it('should get configuration recommendations', () => {
      const recommendations = EmailConfigService.getConfigurationRecommendations();
      
      expect(recommendations).toHaveProperty('production');
      expect(recommendations).toHaveProperty('development');
      expect(recommendations).toHaveProperty('security');
      expect(Array.isArray(recommendations.production)).toBe(true);
    });

    it('should get delivery best practices', () => {
      const practices = EmailConfigService.getDeliveryBestPractices();
      
      expect(Array.isArray(practices)).toBe(true);
      expect(practices.length).toBeGreaterThan(0);
      expect(practices[0]).toHaveProperty('category');
      expect(practices[0]).toHaveProperty('practices');
    });

    it('should get email stats', async () => {
      const stats = await EmailService.getEmailStats();
      
      expect(stats).toHaveProperty('emailsSent');
      expect(stats).toHaveProperty('emailsDelivered');
      expect(stats).toHaveProperty('deliveryRate');
      expect(stats).toHaveProperty('bounceRate');
      expect(stats).toHaveProperty('complaintRate');
    });
  });
});