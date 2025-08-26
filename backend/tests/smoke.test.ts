import request from 'supertest';
import app from '../src/index';

describe('Smoke Tests - Basic Server Functionality', () => {
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        environment: expect.any(String),
        uptime: expect.any(Number)
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('API Status', () => {
    it('should return API status', async () => {
      const response = await request(app)
        .get('/api/v1/status')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'BoosterBeacon API is running',
        version: '1.0.0'
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('404 Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/unknown-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found'
        }
      });
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('should include security headers from Helmet', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for some key security headers set by Helmet
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('Request Logging', () => {
    it('should process requests successfully', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Request should be processed successfully
      expect(response.body.status).toBe('healthy');
    });
  });
});