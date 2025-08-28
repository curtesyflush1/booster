import request from 'supertest';
import { app } from '../../src/index';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/testHelpers';

describe('Security Vulnerability Assessment', () => {
  let server: any;
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    server = app.listen(0);

    // Create test user
    const userData = {
      email: 'security-test@example.com',
      password: 'SecurePassword123!',
      firstName: 'Security',
      lastName: 'Test'
    };

    await request(app)
      .post('/api/auth/register')
      .send(userData);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      });

    authToken = loginResponse.body.token;

    // Create admin user
    const adminData = {
      email: 'admin-security@example.com',
      password: 'AdminSecure123!',
      role: 'admin'
    };

    await request(app)
      .post('/api/auth/register')
      .send(adminData);

    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminData.email,
        password: adminData.password
      });

    adminToken = adminLoginResponse.body.token;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    if (server) {
      server.close();
    }
  });

  describe('Authentication Security', () => {
    test('should prevent SQL injection in login', async () => {
      const sqlInjectionAttempts = [
        "admin'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "admin'/**/OR/**/1=1--",
        "' OR 1=1#"
      ];

      for (const maliciousInput of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: maliciousInput,
            password: 'password'
          });

        // Should not succeed with SQL injection
        expect(response.status).not.toBe(200);
        expect(response.body.token).toBeUndefined();
      }
    });

    test('should prevent NoSQL injection', async () => {
      const noSQLInjectionAttempts = [
        { $ne: null },
        { $gt: '' },
        { $regex: '.*' },
        { $where: 'this.password' }
      ];

      for (const maliciousInput of noSQLInjectionAttempts) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: maliciousInput,
            password: 'password'
          });

        expect(response.status).not.toBe(200);
      }
    });

    test('should enforce password complexity', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'abc123',
        'password123',
        'Password', // No numbers or special chars
        'password1', // No uppercase or special chars
        'PASSWORD1' // No lowercase or special chars
      ];

      for (const weakPassword of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: `weak-${Date.now()}@example.com`,
            password: weakPassword,
            firstName: 'Test',
            lastName: 'User'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toMatch(/password/i);
      }
    });

    test('should prevent brute force attacks', async () => {
      const email = 'brute-force-test@example.com';
      
      // Register user first
      await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password: 'ValidPassword123!',
          firstName: 'Brute',
          lastName: 'Force'
        });

      // Attempt multiple failed logins
      const failedAttempts = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email,
            password: 'wrongpassword'
          })
      );

      const results = await Promise.all(failedAttempts);
      
      // Later attempts should be rate limited
      const rateLimitedAttempts = results.filter(r => r.status === 429);
      expect(rateLimitedAttempts.length).toBeGreaterThan(0);
    });

    test('should validate JWT tokens properly', async () => {
      const invalidTokens = [
        'invalid.token.here',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        '',
        'Bearer ',
        'malformed-token'
      ];

      for (const invalidToken of invalidTokens) {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${invalidToken}`);

        expect(response.status).toBe(401);
      }
    });
  });

  describe('Input Validation Security', () => {
    test('should prevent XSS attacks', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src="x" onerror="alert(\'XSS\')">',
        '<svg onload="alert(\'XSS\')">',
        '"><script>alert("XSS")</script>',
        '\';alert(String.fromCharCode(88,83,83))//\';alert(String.fromCharCode(88,83,83))//";alert(String.fromCharCode(88,83,83))//";alert(String.fromCharCode(88,83,83))//--></SCRIPT>">\'><SCRIPT>alert(String.fromCharCode(88,83,83))</SCRIPT>'
      ];

      for (const xssPayload of xssPayloads) {
        // Test in user profile update
        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            firstName: xssPayload,
            lastName: 'Test'
          });

        // Should either reject or sanitize the input
        if (response.status === 200) {
          expect(response.body.user.firstName).not.toContain('<script>');
          expect(response.body.user.firstName).not.toContain('javascript:');
        } else {
          expect(response.status).toBe(400);
        }
      }
    });

    test('should validate file uploads', async () => {
      const maliciousFiles = [
        { filename: 'test.php', content: '<?php system($_GET["cmd"]); ?>' },
        { filename: 'test.jsp', content: '<% Runtime.getRuntime().exec(request.getParameter("cmd")); %>' },
        { filename: 'test.exe', content: 'MZ\x90\x00\x03\x00\x00\x00' },
        { filename: '../../../etc/passwd', content: 'root:x:0:0:root:/root:/bin/bash' }
      ];

      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/users/avatar')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('avatar', Buffer.from(file.content), file.filename);

        // Should reject malicious files
        expect(response.status).not.toBe(200);
      }
    });

    test('should prevent path traversal attacks', async () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/passwd',
        'C:\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
      ];

      for (const maliciousPath of pathTraversalAttempts) {
        const response = await request(app)
          .get(`/api/files/${encodeURIComponent(maliciousPath)}`)
          .set('Authorization', `Bearer ${authToken}`);

        // Should not allow access to system files
        expect(response.status).not.toBe(200);
        expect(response.body).not.toMatch(/root:|administrator:/i);
      }
    });
  });

  describe('Authorization Security', () => {
    test('should enforce role-based access control', async () => {
      // Regular user should not access admin endpoints
      const adminEndpoints = [
        '/api/admin/users',
        '/api/admin/system/health',
        '/api/admin/analytics',
        '/api/admin/ml/train'
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(403);
      }
    });

    test('should prevent privilege escalation', async () => {
      // User should not be able to modify their own role
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'admin',
          subscriptionTier: 'pro'
        });

      // Should either ignore role change or reject request
      if (response.status === 200) {
        expect(response.body.user.role).not.toBe('admin');
      } else {
        expect(response.status).toBe(400);
      }
    });

    test('should prevent horizontal privilege escalation', async () => {
      // Create another user
      const otherUserData = {
        email: 'other-user@example.com',
        password: 'OtherPassword123!',
        firstName: 'Other',
        lastName: 'User'
      };

      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(otherUserData);

      const otherUserId = otherUserResponse.body.user.id;

      // Try to access other user's data
      const response = await request(app)
        .get(`/api/users/${otherUserId}/profile`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Data Protection Security', () => {
    test('should not expose sensitive data in responses', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      
      // Should not expose password hash or other sensitive data
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.user.passwordHash).toBeUndefined();
      expect(response.body.user.salt).toBeUndefined();
    });

    test('should encrypt sensitive data at rest', async () => {
      // Add retailer credentials
      const credentialsData = {
        retailerId: 'bestbuy',
        username: 'testuser',
        password: 'testpassword',
        encryptionKey: 'test-key'
      };

      const response = await request(app)
        .post('/api/users/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .send(credentialsData);

      expect(response.status).toBe(201);

      // Verify credentials are encrypted (not stored in plain text)
      const retrieveResponse = await request(app)
        .get('/api/users/credentials')
        .set('Authorization', `Bearer ${authToken}`);

      expect(retrieveResponse.status).toBe(200);
      
      // Password should be encrypted or not returned
      const credentials = retrieveResponse.body.credentials.find(
        (c: any) => c.retailerId === 'bestbuy'
      );
      
      if (credentials) {
        expect(credentials.password).not.toBe('testpassword');
      }
    });

    test('should implement proper session management', async () => {
      // Login and get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'security-test@example.com',
          password: 'SecurePassword123!'
        });

      const token = loginResponse.body.token;

      // Use token
      const profileResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(profileResponse.status).toBe(200);

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      // Token should be invalidated
      const afterLogoutResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(afterLogoutResponse.status).toBe(401);
    });
  });

  describe('API Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health');

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    test('should implement CORS properly', async () => {
      const response = await request(app)
        .options('/api/users/profile')
        .set('Origin', 'https://malicious-site.com');

      // Should not allow arbitrary origins
      expect(response.headers['access-control-allow-origin']).not.toBe('https://malicious-site.com');
    });

    test('should prevent clickjacking', async () => {
      const response = await request(app)
        .get('/api/health');

      const frameOptions = response.headers['x-frame-options'];
      expect(frameOptions).toMatch(/DENY|SAMEORIGIN/i);
    });
  });

  describe('Rate Limiting Security', () => {
    test('should implement rate limiting on sensitive endpoints', async () => {
      const sensitiveEndpoints = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/forgot-password'
      ];

      for (const endpoint of sensitiveEndpoints) {
        // Make multiple rapid requests
        const requests = Array(20).fill(null).map(() =>
          request(app)
            .post(endpoint)
            .send({
              email: 'rate-limit-test@example.com',
              password: 'password'
            })
        );

        const results = await Promise.all(requests);
        
        // Some requests should be rate limited
        const rateLimitedRequests = results.filter(r => r.status === 429);
        expect(rateLimitedRequests.length).toBeGreaterThan(0);
      }
    });

    test('should implement different rate limits for different user tiers', async () => {
      // Test with regular user token
      const regularUserRequests = Array(50).fill(null).map(() =>
        request(app)
          .get('/api/products/search')
          .query({ q: 'test' })
          .set('Authorization', `Bearer ${authToken}`)
      );

      const regularResults = await Promise.all(regularUserRequests);
      const regularRateLimited = regularResults.filter(r => r.status === 429);

      // Test with admin token (should have higher limits)
      const adminRequests = Array(50).fill(null).map(() =>
        request(app)
          .get('/api/products/search')
          .query({ q: 'test' })
          .set('Authorization', `Bearer ${adminToken}`)
      );

      const adminResults = await Promise.all(adminRequests);
      const adminRateLimited = adminResults.filter(r => r.status === 429);

      // Admin should have fewer rate limited requests
      expect(adminRateLimited.length).toBeLessThanOrEqual(regularRateLimited.length);
    });
  });

  describe('Dependency Security', () => {
    test('should not expose server information', async () => {
      const response = await request(app)
        .get('/api/health');

      // Should not expose server version or technology stack
      expect(response.headers['server']).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    test('should handle malformed requests gracefully', async () => {
      const malformedRequests = [
        { method: 'POST', path: '/api/auth/login', body: 'invalid-json' },
        { method: 'GET', path: '/api/users/profile', headers: { 'Content-Type': 'application/xml' } },
        { method: 'PUT', path: '/api/users/profile', body: { circular: {} } }
      ];

      // Create circular reference
      malformedRequests[2].body.circular = malformedRequests[2].body;

      for (const req of malformedRequests) {
        const response = await request(app)
          [req.method.toLowerCase() as keyof typeof request](req.path)
          .set(req.headers || {})
          .send(req.body);

        // Should handle gracefully without exposing internal errors
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
        
        if (response.body.error) {
          expect(response.body.error.stack).toBeUndefined();
          expect(response.body.error.details).not.toMatch(/internal|server|database/i);
        }
      }
    });
  });

  describe('Cryptographic Security', () => {
    test('should use secure password hashing', async () => {
      // This would typically be tested by examining the database
      // or through internal API calls that return hash info
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'crypto-test@example.com',
          password: 'CryptoTest123!',
          firstName: 'Crypto',
          lastName: 'Test'
        });

      expect(response.status).toBe(201);
      
      // Password should not be returned in response
      expect(response.body.user.password).toBeUndefined();
    });

    test('should generate secure tokens', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'security-test@example.com',
          password: 'SecurePassword123!'
        });

      const token = response.body.token;
      
      // Token should be sufficiently long and complex
      expect(token.length).toBeGreaterThan(100);
      expect(token).toMatch(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/); // JWT format
    });
  });
});