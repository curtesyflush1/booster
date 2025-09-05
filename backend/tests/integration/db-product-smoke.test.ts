import request from 'supertest';
import app from '../../src/index';

describe('DB-backed Product Smoke', () => {
  it('GET /api/products/search returns 200', async () => {
    const res = await request(app)
      .get('/api/products/search')
      .query({ q: 'Pokemon', limit: 5 });
    expect(res.status).toBe(200);
    // Should return paginated shape per API helper
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
  });

  it('GET /api/products/categories returns 200', async () => {
    const res = await request(app).get('/api/products/categories');
    expect(res.status).toBe(200);
  });

  it('GET /api/products/stats returns 200', async () => {
    const res = await request(app).get('/api/products/stats');
    expect(res.status).toBe(200);
  });
});

