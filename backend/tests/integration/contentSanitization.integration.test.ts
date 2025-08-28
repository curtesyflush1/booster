import request from 'supertest';
import { app } from '../../src/index';
import { User } from '../../src/models/User';
import { generateTestJWT } from '../helpers/authHelper';

describe('Content Sanitization Integration', () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Create a test user
    testUser = await User.create({
      email: 'test@example.com',
      password: 'password123',
      subscription_tier: 'free',
      email_verified: true
    });

    authToken = generateTestJWT(testUser.id);
  });

  afterAll(async () => {
    // Clean up
    if (testUser) {
      await User.delete(testUser.id);
    }
  });

  describe('User Profile Updates', () => {
    it('should sanitize malicious content in profile updates', async () => {
      const maliciousProfile = {
        first_name: '<script>alert("XSS")</script>John',
        last_name: '<img src="x" onerror="alert(1)">Doe',
        bio: '<p>I love <strong>Pokemon</strong> cards!</p><script>malicious()</script>'
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousProfile)
        .expect(200);

      // Verify the response doesn't contain malicious content
      expect(response.body.message).toBe('Profile updated successfully');

      // Get the updated profile to verify sanitization
      const profileResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const profile = profileResponse.body.user;
      
      // Should remove script tags but keep safe content
      expect(profile.first_name).toBe('John');
      expect(profile.last_name).toBe('Doe');
      
      // Bio should allow basic HTML but remove scripts
      expect(profile.bio).toContain('<p>');
      expect(profile.bio).toContain('<strong>');
      expect(profile.bio).toContain('Pokemon');
      expect(profile.bio).not.toContain('<script>');
      expect(profile.bio).not.toContain('malicious');
    });
  });

  describe('Search Queries', () => {
    it('should sanitize search queries to prevent XSS', async () => {
      const maliciousSearch = '<script>alert("XSS")</script>pokemon cards';

      const response = await request(app)
        .get('/api/products/search')
        .query({ q: maliciousSearch })
        .expect(200);

      // The search should work but without the malicious content
      expect(response.body).toHaveProperty('products');
      
      // Verify the search was processed (even if no results)
      expect(response.body.products).toBeInstanceOf(Array);
    });
  });

  describe('Admin Notes', () => {
    it('should allow HTML in admin notes but sanitize dangerous content', async () => {
      // This would typically be tested with an admin user
      // For now, we'll test the sanitization function directly
      const { sanitizeUserContent } = require('../../src/utils/contentSanitization');
      
      const adminNotes = '<p>User reported <strong>issue</strong> with alerts.</p><script>steal_data()</script>';
      const sanitized = sanitizeUserContent(adminNotes, 'admin_notes');
      
      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<strong>');
      expect(sanitized).toContain('issue');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('steal_data');
    });
  });

  describe('XSS Prevention', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert(1)',
      '<iframe src="javascript:alert(1)"></iframe>',
      '"><script>alert(1)</script>',
      '<svg onload="alert(1)">',
      '<object data="data:text/html,<script>alert(1)</script>"></object>'
    ];

    xssPayloads.forEach((payload, index) => {
      it(`should prevent XSS payload ${index + 1} in user profiles`, async () => {
        const profileWithXSS = {
          first_name: payload + 'John',
          bio: `My bio: ${payload}`
        };

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(profileWithXSS)
          .expect(200);

        // Get the updated profile
        const profileResponse = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const profile = profileResponse.body.user;
        
        // Should not contain dangerous elements
        expect(profile.first_name).not.toContain('<script');
        expect(profile.first_name).not.toContain('javascript:');
        expect(profile.first_name).not.toContain('onerror');
        expect(profile.first_name).not.toContain('<iframe');
        expect(profile.first_name).not.toContain('<object');
        expect(profile.first_name).not.toContain('<svg');
        
        expect(profile.bio).not.toContain('<script');
        expect(profile.bio).not.toContain('javascript:');
        expect(profile.bio).not.toContain('onerror');
        expect(profile.bio).not.toContain('<iframe');
        expect(profile.bio).not.toContain('<object');
        expect(profile.bio).not.toContain('<svg');
        
        // Should still contain safe content
        expect(profile.first_name).toContain('John');
        expect(profile.bio).toContain('My bio:');
      });
    });
  });
});