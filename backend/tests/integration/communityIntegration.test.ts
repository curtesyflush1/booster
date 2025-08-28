import request from 'supertest';
import app from '../../src/index';
import { User } from '../../src/models/User';
import { AuthTestHelpers } from '../helpers/authTestHelpers';

describe('Community and Integration Features', () => {
  let authToken: string;
  let userId: string;
  let adminToken: string;

  beforeAll(async () => {
    // Create test user and get auth token
    const mockUser = AuthTestHelpers.createMockUser();
    authToken = 'test-token';
    userId = mockUser.id;

    // Create admin user
    adminToken = 'admin-token';
  });

  afterAll(async () => {
    // Cleanup would be handled here
  });

  describe('Discord Bot Integration', () => {
    describe('POST /api/discord/servers', () => {
      it('should create Discord server configuration', async () => {
        const serverConfig = {
          serverId: '123456789012345678',
          channelId: '987654321098765432',
          token: 'test-bot-token',
          alertFilters: {
            retailers: ['best buy', 'walmart'],
            priceRange: { max: 50 }
          }
        };

        const response = await request(app)
          .post('/api/discord/servers')
          .set('Authorization', `Bearer ${authToken}`)
          .send(serverConfig)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.serverId).toBe(serverConfig.serverId);
        expect(response.body.data.channelId).toBe(serverConfig.channelId);
        expect(response.body.data.alertFilters).toEqual(serverConfig.alertFilters);
      });

      it('should require authentication', async () => {
        await request(app)
          .post('/api/discord/servers')
          .send({})
          .expect(401);
      });

      it('should validate required fields', async () => {
        await request(app)
          .post('/api/discord/servers')
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
          .expect(400);
      });
    });

    describe('GET /api/discord/servers', () => {
      it('should list user Discord server configurations', async () => {
        const response = await request(app)
          .get('/api/discord/servers')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });
  });

  describe('Webhook System', () => {
    let webhookId: string;

    describe('POST /api/webhooks', () => {
      it('should create webhook configuration', async () => {
        const webhookConfig = {
          name: 'Test Webhook',
          url: 'https://example.com/webhook',
          secret: 'test-secret-key',
          events: ['alert.created', 'product.restocked'],
          filters: {
            retailers: ['best buy'],
            priceRange: { max: 100 }
          }
        };

        const response = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send(webhookConfig)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe(webhookConfig.name);
        expect(response.body.data.url).toBe(webhookConfig.url);
        expect(response.body.data.events).toEqual(webhookConfig.events);
        
        webhookId = response.body.data.id;
      });

      it('should validate webhook URL', async () => {
        const invalidWebhook = {
          name: 'Invalid Webhook',
          url: 'not-a-valid-url',
          events: ['alert.created']
        };

        await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidWebhook)
          .expect(400);
      });
    });

    describe('GET /api/webhooks', () => {
      it('should list user webhooks', async () => {
        const response = await request(app)
          .get('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });

    describe('POST /api/webhooks/:webhookId/test', () => {
      it('should test webhook connection', async () => {
        if (!webhookId) {
          // Create a webhook first
          const webhookConfig = {
            name: 'Test Webhook',
            url: 'https://httpbin.org/post',
            events: ['alert.created']
          };

          const createResponse = await request(app)
            .post('/api/webhooks')
            .set('Authorization', `Bearer ${authToken}`)
            .send(webhookConfig);
          
          webhookId = createResponse.body.data.id;
        }

        const response = await request(app)
          .post(`/api/webhooks/${webhookId}/test`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.testResult).toBeDefined();
      });
    });
  });

  describe('CSV Import/Export', () => {
    describe('GET /api/csv/template', () => {
      it('should download CSV template', async () => {
        const response = await request(app)
          .get('/api/csv/template')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
        expect(response.headers['content-disposition']).toContain('attachment');
      });
    });

    describe('POST /api/csv/validate', () => {
      it('should validate CSV format', async () => {
        const csvContent = 'product_name,retailers,max_price,is_active\n"Test Product","best buy",4.99,true';
        
        const response = await request(app)
          .post('/api/csv/validate')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('csvFile', Buffer.from(csvContent), 'test.csv')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.isValid).toBe(true);
        expect(Array.isArray(response.body.data.previewData)).toBe(true);
      });

      it('should reject invalid CSV format', async () => {
        const invalidCsv = 'invalid,csv,format\n';
        
        const response = await request(app)
          .post('/api/csv/validate')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('csvFile', Buffer.from(invalidCsv), 'invalid.csv')
          .expect(200);

        expect(response.body.data.isValid).toBe(false);
        expect(response.body.data.errors.length).toBeGreaterThan(0);
      });
    });

    describe('GET /api/csv/export', () => {
      it('should export watches to CSV', async () => {
        const response = await request(app)
          .get('/api/csv/export')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
        expect(response.headers['content-disposition']).toContain('attachment');
      });

      it('should support export filters', async () => {
        const response = await request(app)
          .get('/api/csv/export?includeInactive=true&retailers=best buy,walmart')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      });
    });

    describe('GET /api/csv/documentation', () => {
      it('should return CSV format documentation', async () => {
        const response = await request(app)
          .get('/api/csv/documentation')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.supportedFormats).toBeDefined();
        expect(response.body.data.requiredColumns).toBeDefined();
        expect(response.body.data.optionalColumns).toBeDefined();
      });
    });
  });

  describe('Social Sharing', () => {
    describe('POST /api/social/share-links', () => {
      it('should generate share links', async () => {
        const shareData = {
          title: 'Test Pokemon Product Alert',
          description: 'Great deal on Pokemon cards!',
          url: 'https://example.com/product',
          price: 4.99,
          retailerName: 'Best Buy'
        };

        const response = await request(app)
          .post('/api/social/share-links')
          .set('Authorization', `Bearer ${authToken}`)
          .send(shareData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.shareLinks)).toBe(true);
        expect(response.body.data.openGraphTags).toBeDefined();
        
        // Check that major platforms are included
        const platforms = response.body.data.shareLinks.map((link: any) => link.platform);
        expect(platforms).toContain('twitter');
        expect(platforms).toContain('facebook');
        expect(platforms).toContain('discord');
      });
    });

    describe('POST /api/social/posts', () => {
      it('should generate social media posts', async () => {
        const shareData = {
          title: 'Pokemon TCG Restock Alert',
          description: 'Booster packs available now!',
          url: 'https://example.com/product',
          productName: 'Pokemon TCG Booster Pack'
        };

        const response = await request(app)
          .post('/api/social/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .send(shareData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.posts)).toBe(true);
        
        // Check that posts are generated for different platforms
        const platforms = response.body.data.posts.map((post: any) => post.platform);
        expect(platforms).toContain('twitter');
        expect(platforms).toContain('instagram');
        expect(platforms).toContain('facebook');
      });
    });

    describe('POST /api/social/track', () => {
      it('should track social media shares', async () => {
        const trackData = {
          platform: 'twitter',
          alertId: 'test-alert-id'
        };

        const response = await request(app)
          .post('/api/social/track')
          .set('Authorization', `Bearer ${authToken}`)
          .send(trackData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.platform).toBe(trackData.platform);
      });
    });

    describe('GET /api/social/platforms', () => {
      it('should return platform information', async () => {
        const response = await request(app)
          .get('/api/social/platforms')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.supportedPlatforms)).toBe(true);
        expect(Array.isArray(response.body.data.defaultHashtags)).toBe(true);
      });
    });
  });

  describe('Community Features', () => {
    let testimonialId: string;
    let postId: string;

    describe('POST /api/community/testimonials', () => {
      it('should create testimonial', async () => {
        const testimonialData = {
          content: 'BoosterBeacon has helped me catch every Pokemon TCG restock! Amazing service.',
          rating: 5,
          isPublic: true,
          tags: ['helpful', 'fast-alerts'],
          metadata: {
            productsSaved: 15,
            moneySaved: 150.50,
            timeUsing: '6 months'
          }
        };

        const response = await request(app)
          .post('/api/community/testimonials')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testimonialData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.content).toBe(testimonialData.content);
        expect(response.body.data.rating).toBe(testimonialData.rating);
        expect(response.body.data.metadata).toEqual(testimonialData.metadata);
        
        testimonialId = response.body.data.id;
      });

      it('should validate testimonial data', async () => {
        const invalidTestimonial = {
          content: 'Too short',
          rating: 6 // Invalid rating
        };

        await request(app)
          .post('/api/community/testimonials')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidTestimonial)
          .expect(400);
      });
    });

    describe('GET /api/community/testimonials', () => {
      it('should list testimonials', async () => {
        const response = await request(app)
          .get('/api/community/testimonials')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.testimonials)).toBe(true);
        expect(typeof response.body.data.total).toBe('number');
      });

      it('should filter testimonials by rating', async () => {
        const response = await request(app)
          .get('/api/community/testimonials?minRating=4')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        // All returned testimonials should have rating >= 4
        response.body.data.testimonials.forEach((testimonial: any) => {
          expect(testimonial.rating).toBeGreaterThanOrEqual(4);
        });
      });
    });

    describe('POST /api/community/posts', () => {
      it('should create community post', async () => {
        const postData = {
          type: 'success_story',
          title: 'My First Charizard Pull!',
          content: 'Thanks to BoosterBeacon alerts, I was able to get the new booster packs and pulled my first Charizard!',
          tags: ['success', 'charizard', 'pulls'],
          isPublic: true
        };

        const response = await request(app)
          .post('/api/community/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .send(postData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.type).toBe(postData.type);
        expect(response.body.data.title).toBe(postData.title);
        expect(response.body.data.content).toBe(postData.content);
        
        postId = response.body.data.id;
      });

      it('should validate post type', async () => {
        const invalidPost = {
          type: 'invalid_type',
          title: 'Test Post',
          content: 'This should fail validation'
        };

        await request(app)
          .post('/api/community/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidPost)
          .expect(400);
      });
    });

    describe('GET /api/community/posts', () => {
      it('should list community posts', async () => {
        const response = await request(app)
          .get('/api/community/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.posts)).toBe(true);
      });

      it('should filter posts by type', async () => {
        const response = await request(app)
          .get('/api/community/posts?type=success_story')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        response.body.data.posts.forEach((post: any) => {
          expect(post.type).toBe('success_story');
        });
      });
    });

    describe('POST /api/community/posts/:id/like', () => {
      it('should like/unlike post', async () => {
        if (!postId) {
          // Create a post first
          const postData = {
            type: 'tip',
            title: 'Test Post for Liking',
            content: 'This is a test post for the like functionality'
          };

          const createResponse = await request(app)
            .post('/api/community/posts')
            .set('Authorization', `Bearer ${authToken}`)
            .send(postData);
          
          postId = createResponse.body.data.id;
        }

        const response = await request(app)
          .post(`/api/community/posts/${postId}/like`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(typeof response.body.data.liked).toBe('boolean');
        expect(typeof response.body.data.totalLikes).toBe('number');
      });
    });

    describe('POST /api/community/posts/:id/comments', () => {
      it('should add comment to post', async () => {
        if (!postId) {
          // Create a post first
          const postData = {
            type: 'question',
            title: 'Test Post for Comments',
            content: 'This is a test post for commenting'
          };

          const createResponse = await request(app)
            .post('/api/community/posts')
            .set('Authorization', `Bearer ${authToken}`)
            .send(postData);
          
          postId = createResponse.body.data.id;
        }

        const commentData = {
          content: 'Great post! Thanks for sharing your experience.'
        };

        const response = await request(app)
          .post(`/api/community/posts/${postId}/comments`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(commentData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.content).toBe(commentData.content);
      });
    });

    describe('GET /api/community/stats', () => {
      it('should return community statistics', async () => {
        const response = await request(app)
          .get('/api/community/stats')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(typeof response.body.data.totalTestimonials).toBe('number');
        expect(typeof response.body.data.averageRating).toBe('number');
        expect(typeof response.body.data.totalPosts).toBe('number');
        expect(typeof response.body.data.activeUsers).toBe('number');
      });
    });

    describe('GET /api/community/featured', () => {
      it('should return featured content', async () => {
        const response = await request(app)
          .get('/api/community/featured')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.testimonials)).toBe(true);
        expect(Array.isArray(response.body.data.posts)).toBe(true);
      });
    });

    describe('POST /api/community/moderate (Admin Only)', () => {
      it('should allow admin to moderate content', async () => {
        if (!testimonialId) {
          // Create a testimonial first
          const testimonialData = {
            content: 'Test testimonial for moderation',
            rating: 4
          };

          const createResponse = await request(app)
            .post('/api/community/testimonials')
            .set('Authorization', `Bearer ${authToken}`)
            .send(testimonialData);
          
          testimonialId = createResponse.body.data.id;
        }

        const moderationData = {
          contentType: 'testimonial',
          contentId: testimonialId,
          action: 'approve',
          notes: 'Approved by admin'
        };

        const response = await request(app)
          .post('/api/community/moderate')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(moderationData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.action).toBe('approve');
      });

      it('should deny non-admin users', async () => {
        const moderationData = {
          contentType: 'testimonial',
          contentId: 'test-id',
          action: 'approve'
        };

        await request(app)
          .post('/api/community/moderate')
          .set('Authorization', `Bearer ${authToken}`)
          .send(moderationData)
          .expect(403);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to community endpoints', async () => {
      // Make multiple rapid requests to test rate limiting
      const requests = Array(60).fill(null).map(() => 
        request(app)
          .get('/api/community/stats')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});