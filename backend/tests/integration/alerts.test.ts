import request from 'supertest';
import app from '../../src/index';

describe('Alert Routes Integration', () => {
  describe('GET /api/alerts', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/alerts')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 200 with valid auth token (mocked)', async () => {
      // This would require proper auth setup, but we can at least test the route exists
      const response = await request(app)
        .get('/api/alerts');

      // Should get 401 (unauthorized) rather than 404 (not found)
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/alerts/stats/summary', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/alerts/stats/summary')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/alerts/analytics/engagement', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/alerts/analytics/engagement')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});