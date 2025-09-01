import request from 'supertest';
import app from '../../src/index';
import { createTestProduct, cleanupTestData } from '../helpers/testHelpers';
import { v4 as uuidv4 } from 'uuid';

describe('POST /api/products/by-ids (batch fetch)', () => {
  const createdProductIds: string[] = [];

  afterAll(async () => {
    await cleanupTestData([], createdProductIds);
  });

  describe('Happy Path', () => {
    it('returns products for valid UUIDs and preserves order', async () => {
      const p1 = await createTestProduct('Integration Test Product 1');
      const p2 = await createTestProduct('Integration Test Product 2');
      createdProductIds.push(p1.id, p2.id);

      const response = await request(app)
        .post('/api/products/by-ids')
        .send({ ids: [p1.id, p2.id] });

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body.products)).toBe(true);
      expect(response.body.products.length).toBe(2);

      const [r1, r2] = response.body.products;
      expect(r1.id).toBe(p1.id);
      expect(r2.id).toBe(p2.id);
      expect(r1.name).toBe('Integration Test Product 1');
      expect(r2.name).toBe('Integration Test Product 2');
      expect(Array.isArray(r1.availability)).toBe(true);
      expect(Array.isArray(r2.availability)).toBe(true);
    });
  });

  describe('Validation Errors (Joi)', () => {
    it('rejects empty ids array', async () => {
      const res = await request(app)
        .post('/api/products/by-ids')
        .send({ ids: [] });

      expect(res.status).toBe(400);
      expect(res.body?.error?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects more than 200 ids', async () => {
      const ids = Array.from({ length: 201 }, () => uuidv4());
      const res = await request(app)
        .post('/api/products/by-ids')
        .send({ ids });

      expect(res.status).toBe(400);
      expect(res.body?.error?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid id format', async () => {
      const res = await request(app)
        .post('/api/products/by-ids')
        .send({ ids: ['not-a-uuid'] });

      expect(res.status).toBe(400);
      expect(res.body?.error?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects duplicate ids', async () => {
      const p = await createTestProduct('Dup ID Product');
      createdProductIds.push(p.id);

      const res = await request(app)
        .post('/api/products/by-ids')
        .send({ ids: [p.id, p.id] });

      expect(res.status).toBe(400);
      expect(res.body?.error?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects missing ids property', async () => {
      const res = await request(app)
        .post('/api/products/by-ids')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body?.error?.code).toBe('VALIDATION_ERROR');
    });
  });
});

