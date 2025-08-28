import request from 'supertest';
import app from '../../src/index';
import { generateTestToken } from '../helpers/authTestHelpers';

describe('Monitoring Integration Tests', () => {
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Generate test tokens
    authToken = generateTestToken({ id: 'test-user', email: 'test@example.com', role: 'user' });
    adminToken = generateTestToken({ id: 'admin-user', email: 'admin@example.com', role: 'admin' });
  });

  describe('Health Endpoints', () => {
    it('should return basic health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should return detailed health status', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('metrics');
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('memory');
    });

    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(['ready', 'not_ready']).toContain(response.body.status);
    });

    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Monitoring Endpoints', () => {
    it('should require authentication for metrics', async () => {
      await request(app)
        .get('/api/monitoring/metrics')
        .expect(401);
    });

    it('should return metrics for authenticated users', async () => {
      const response = await request(app)
        .get('/api/monitoring/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    it('should allow recording custom metrics', async () => {
      const metricData = {
        metric: 'test_metric',
        value: 42,
        labels: { service: 'test' }
      };

      const response = await request(app)
        .post('/api/monitoring/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .send(metricData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toMatchObject(metricData);
    });

    it('should require admin access for alert rules', async () => {
      await request(app)
        .get('/api/monitoring/alerts/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    it('should return alert rules for admin users', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should allow creating alert rules as admin', async () => {
      const alertRule = {
        id: 'test_alert_rule',
        name: 'Test Alert Rule',
        metric: 'test_metric',
        operator: 'gt',
        threshold: 100,
        duration: 60,
        severity: 'medium',
        enabled: true,
        notificationChannels: ['email']
      };

      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(alertRule)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toMatchObject(alertRule);
    });

    it('should return dashboard data', async () => {
      const response = await request(app)
        .get('/api/monitoring/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('timeRange');
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data).toHaveProperty('alerts');
    });
  });

  describe('Correlation ID Tracking', () => {
    it('should include correlation ID in response headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-correlation-id');
      expect(response.body).toHaveProperty('correlationId');
    });

    it('should use provided correlation ID', async () => {
      const correlationId = 'test-correlation-id-123';
      
      const response = await request(app)
        .get('/health')
        .set('X-Correlation-ID', correlationId)
        .expect(200);

      expect(response.headers['x-correlation-id']).toBe(correlationId);
      expect(response.body.correlationId).toBe(correlationId);
    });
  });
});