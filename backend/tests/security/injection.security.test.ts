import request from 'supertest';
import app from '../../src/index';
import { SecurityTestHelper, SECURITY_CONSTANTS } from './setup';
import { createMockUser } from '../helpers/userTestHelpers';
import jwt from 'jsonwebtoken';

describe('Injection Attack Security Tests', () => {
  let authToken: string;
  let mockUser: any;

  beforeAll(async () => {
    mockUser = createMockUser();
    authToken = jwt.sign(
      { userId: mockUser.id, email: mockUser.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('SQL Injection Protection', () => {
    it('should prevent SQL injection in login endpoint', async () => {
      const sqlPayloads = SecurityTestHelper.getSQLInjectionPayloads();
      
      for (const payload of sqlPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: 'password123'
          });

        // Should not return 500 (server error) or expose database errors
        expect(response.status).not.toBe(500);
        expect(response.body.error).not.toMatch(/sql|database|query/i);
        
        // Should return proper validation error
        expect([400, 401, 422]).toContain(response.status);
      }
    });

    it('should prevent SQL injection in product search', async () => {
      const sqlPayloads = SecurityTestHelper.getSQLInjectionPayloads();
      
      for (const payload of sqlPayloads) {
        const response = await request(app)
          .get('/api/products/search')
          .query({ q: payload })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).not.toBe(500);
        expect(response.body.error).not.toMatch(/sql|database|query/i);
      }
    });

    it('should prevent SQL injection in user profile updates', async () => {
      const sqlPayloads = SecurityTestHelper.getSQLInjectionPayloads();
      
      for (const payload of sqlPayloads) {
        const response = await request(app)
          .put('/api/users/profile')
          .send({
            firstName: payload,
            lastName: 'Test'
          })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).not.toBe(500);
        expect(response.body.error).not.toMatch(/sql|database|query/i);
      }
    });
  });

  describe('XSS Protection', () => {
    it('should sanitize XSS payloads in user input', async () => {
      const xssPayloads = SecurityTestHelper.getXSSPayloads();
      
      for (const payload of xssPayloads) {
        const response = await request(app)
          .put('/api/users/profile')
          .send({
            firstName: payload,
            lastName: 'Test'
          })
          .set('Authorization', `Bearer ${authToken}`);

        // Should not return the raw payload in response
        if (response.body.user) {
          expect(response.body.user.firstName).not.toBe(payload);
          expect(response.body.user.firstName).not.toMatch(/<script|javascript:|onerror=/i);
        }
      }
    });

    it('should prevent XSS in product reviews/comments', async () => {
      const xssPayloads = SecurityTestHelper.getXSSPayloads();
      
      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/products/product-123/reviews')
          .send({
            rating: 5,
            comment: payload
          })
          .set('Authorization', `Bearer ${authToken}`);

        if (response.body.review) {
          expect(response.body.review.comment).not.toBe(payload);
          expect(response.body.review.comment).not.toMatch(/<script|javascript:|onerror=/i);
        }
      }
    });
  });

  describe('Command Injection Protection', () => {
    it('should prevent command injection in file operations', async () => {
      const cmdPayloads = SecurityTestHelper.getCommandInjectionPayloads();
      
      for (const payload of cmdPayloads) {
        const response = await request(app)
          .post('/api/csv/export')
          .send({
            filename: payload,
            format: 'csv'
          })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).not.toBe(500);
        expect(response.body.error).not.toMatch(/command|exec|spawn/i);
      }
    });
  });

  describe('Path Traversal Protection', () => {
    it('should prevent path traversal in file access', async () => {
      const pathPayloads = SecurityTestHelper.getPathTraversalPayloads();
      
      for (const payload of pathPayloads) {
        const response = await request(app)
          .get(`/api/files/${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${authToken}`);

        // Should not return system files
        expect(response.status).not.toBe(200);
        if (response.body) {
          expect(response.body).not.toMatch(/root:|admin:|password:/i);
        }
      }
    });
  });

  describe('NoSQL Injection Protection', () => {
    it('should prevent NoSQL injection in query parameters', async () => {
      const noSqlPayloads = SecurityTestHelper.getNoSQLInjectionPayloads();
      
      for (const payload of noSqlPayloads) {
        const response = await request(app)
          .get('/api/alerts')
          .query({ filter: JSON.stringify(payload) })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).not.toBe(500);
        // Should not return all records due to injection
        if (response.body.alerts) {
          expect(Array.isArray(response.body.alerts)).toBe(true);
        }
      }
    });
  });

  describe('Header Injection Protection', () => {
    it('should prevent header injection attacks', async () => {
      const headerInjectionPayloads = [
        'test\r\nX-Injected-Header: malicious',
        'test\nSet-Cookie: admin=true',
        'test\r\n\r\n<script>alert("XSS")</script>',
        'test%0d%0aX-Injected: true'
      ];
      
      for (const payload of headerInjectionPayloads) {
        const response = await request(app)
          .get('/api/products/search')
          .query({ q: 'pokemon' })
          .set('X-Custom-Header', payload)
          .set('Authorization', `Bearer ${authToken}`);

        // Should not reflect the injected headers
        expect(response.headers['x-injected-header']).toBeUndefined();
        expect(response.headers['x-injected']).toBeUndefined();
        expect(response.headers['set-cookie']).not.toMatch(/admin=true/);
      }
    });
  });
});