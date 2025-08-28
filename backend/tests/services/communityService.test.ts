import { CommunityService } from '../../src/services/communityService';
import { User } from '../../src/models/User';

// Mock the User model
jest.mock('../../src/models/User');
const mockUser = User as jest.Mocked<typeof User>;

describe('CommunityService', () => {
  let communityService: CommunityService;

  beforeEach(() => {
    communityService = new CommunityService();
    jest.clearAllMocks();
  });

  describe('createTestimonial', () => {
    it('should create a testimonial successfully', async () => {
      // Mock user exists
      mockUser.findById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        subscription_tier: 'free'
      } as any);

      const testimonialData = {
        userId: 'user-123',
        userName: 'TestUser',
        content: 'Great service! BoosterBeacon helped me get all the Pokemon cards I wanted.',
        rating: 5,
        isVerified: false,
        isPublic: true,
        isFeatured: false,
        tags: ['helpful', 'fast'],
        metadata: {
          productsSaved: 10,
          moneySaved: 100
        }
      };

      const result = await communityService.createTestimonial(testimonialData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.content).toBe(testimonialData.content);
      expect(result.rating).toBe(testimonialData.rating);
      expect(result.moderationStatus).toBe('pending');
      expect(result.createdAt).toBeDefined();
    });

    it('should throw error if user not found', async () => {
      mockUser.findById.mockResolvedValue(null);

      const testimonialData = {
        userId: 'nonexistent-user',
        userName: 'TestUser',
        content: 'Test content',
        rating: 5,
        isVerified: false,
        isPublic: true,
        isFeatured: false,
        tags: [],
        metadata: {}
      };

      await expect(communityService.createTestimonial(testimonialData))
        .rejects.toThrow('User not found');
    });

    it('should auto-approve testimonials from Pro users', async () => {
      mockUser.findById.mockResolvedValue({
        id: 'user-123',
        email: 'pro@example.com',
        subscription_tier: 'pro'
      } as any);

      const testimonialData = {
        userId: 'user-123',
        userName: 'ProUser',
        content: 'Excellent service for Pro users!',
        rating: 5,
        isVerified: true,
        isPublic: true,
        isFeatured: false,
        tags: [],
        metadata: {}
      };

      const result = await communityService.createTestimonial(testimonialData);

      expect(result.moderationStatus).toBe('approved');
    });
  });

  describe('getTestimonials', () => {
    beforeEach(async () => {
      // Create some test testimonials
      mockUser.findById.mockResolvedValue({
        id: 'user-123',
        subscription_tier: 'free'
      } as any);

      await communityService.createTestimonial({
        userId: 'user-123',
        userName: 'User1',
        content: 'Great service!',
        rating: 5,
        isVerified: false,
        isPublic: true,
        isFeatured: false,
        tags: ['helpful'],
        metadata: {}
      });

      await communityService.createTestimonial({
        userId: 'user-123',
        userName: 'User2',
        content: 'Good but could be better',
        rating: 3,
        isVerified: false,
        isPublic: true,
        isFeatured: true,
        tags: ['feedback'],
        metadata: {}
      });
    });

    it('should return all testimonials without filters', async () => {
      const result = await communityService.getTestimonials();

      expect(result.testimonials).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter testimonials by minimum rating', async () => {
      const result = await communityService.getTestimonials({ minRating: 4 });

      expect(result.testimonials).toHaveLength(1);
      expect(result.testimonials[0]?.rating).toBeGreaterThanOrEqual(4);
    });

    it('should filter testimonials by featured status', async () => {
      const result = await communityService.getTestimonials({ isFeatured: true });

      expect(result.testimonials).toHaveLength(1);
      expect(result.testimonials[0]?.isFeatured).toBe(true);
    });

    it('should apply pagination', async () => {
      const result = await communityService.getTestimonials({ limit: 1, offset: 0 });

      expect(result.testimonials).toHaveLength(1);
      expect(result.total).toBe(2);
    });
  });

  describe('createPost', () => {
    it('should create a community post successfully', async () => {
      mockUser.findById.mockResolvedValue({
        id: 'user-123',
        subscription_tier: 'free'
      } as any);

      const postData = {
        userId: 'user-123',
        userName: 'TestUser',
        type: 'success_story' as const,
        title: 'My First Charizard!',
        content: 'Finally pulled a Charizard thanks to BoosterBeacon alerts!',
        images: ['image1.jpg'],
        tags: ['success', 'charizard'],
        isPublic: true,
        isFeatured: false
      };

      const result = await communityService.createPost(postData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.type).toBe(postData.type);
      expect(result.title).toBe(postData.title);
      expect(result.content).toBe(postData.content);
      expect(result.likes).toBe(0);
      expect(result.comments).toBe(0);
      expect(result.moderationStatus).toBe('pending');
    });

    it('should auto-approve posts from Pro users', async () => {
      mockUser.findById.mockResolvedValue({
        id: 'user-123',
        subscription_tier: 'pro'
      } as any);

      const postData = {
        userId: 'user-123',
        userName: 'ProUser',
        type: 'tip' as const,
        title: 'Pro Tip for Collectors',
        content: 'Here is a great tip for fellow collectors...',
        images: [],
        tags: ['tip'],
        isPublic: true,
        isFeatured: false
      };

      const result = await communityService.createPost(postData);

      expect(result.moderationStatus).toBe('approved');
    });
  });

  describe('togglePostLike', () => {
    let postId: string;

    beforeEach(async () => {
      mockUser.findById.mockResolvedValue({
        id: 'user-123',
        subscription_tier: 'free'
      } as any);

      const post = await communityService.createPost({
        userId: 'user-123',
        userName: 'TestUser',
        type: 'success_story',
        title: 'Test Post',
        content: 'Test content',
        images: [],
        tags: [],
        isPublic: true,
        isFeatured: false
      });

      postId = post.id;
    });

    it('should toggle post like', async () => {
      const result = await communityService.togglePostLike(postId, 'user-456');

      expect(result).toBeDefined();
      expect(typeof result.liked).toBe('boolean');
      expect(typeof result.totalLikes).toBe('number');
    });

    it('should throw error for non-existent post', async () => {
      await expect(communityService.togglePostLike('nonexistent-post', 'user-456'))
        .rejects.toThrow('Post not found');
    });
  });

  describe('addComment', () => {
    let postId: string;

    beforeEach(async () => {
      mockUser.findById.mockResolvedValue({
        id: 'user-123',
        subscription_tier: 'free'
      } as any);

      const post = await communityService.createPost({
        userId: 'user-123',
        userName: 'TestUser',
        type: 'question',
        title: 'Test Question',
        content: 'What do you think about this?',
        images: [],
        tags: [],
        isPublic: true,
        isFeatured: false
      });

      postId = post.id;
    });

    it('should add comment to post', async () => {
      const commentData = {
        postId,
        userId: 'user-456',
        userName: 'Commenter',
        content: 'Great question! Here is my answer...',
        isPublic: true
      };

      const result = await communityService.addComment(commentData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.content).toBe(commentData.content);
      expect(result.likes).toBe(0);
      expect(result.moderationStatus).toBe('pending');
    });

    it('should throw error for non-existent post', async () => {
      const commentData = {
        postId: 'nonexistent-post',
        userId: 'user-456',
        userName: 'Commenter',
        content: 'Test comment',
        isPublic: true
      };

      await expect(communityService.addComment(commentData))
        .rejects.toThrow('Post not found');
    });
  });

  describe('moderateContent', () => {
    let testimonialId: string;

    beforeEach(async () => {
      mockUser.findById.mockResolvedValue({
        id: 'user-123',
        subscription_tier: 'free'
      } as any);

      const testimonial = await communityService.createTestimonial({
        userId: 'user-123',
        userName: 'TestUser',
        content: 'Test testimonial for moderation',
        rating: 4,
        isVerified: false,
        isPublic: true,
        isFeatured: false,
        tags: [],
        metadata: {}
      });

      testimonialId = testimonial.id;
    });

    it('should approve testimonial', async () => {
      await communityService.moderateContent('testimonial', testimonialId, 'approve', 'Looks good');

      const testimonial = await communityService.getTestimonial(testimonialId);
      expect(testimonial?.moderationStatus).toBe('approved');
      expect(testimonial?.moderationNotes).toBe('Looks good');
    });

    it('should reject testimonial', async () => {
      await communityService.moderateContent('testimonial', testimonialId, 'reject', 'Inappropriate content');

      const testimonial = await communityService.getTestimonial(testimonialId);
      expect(testimonial?.moderationStatus).toBe('rejected');
      expect(testimonial?.moderationNotes).toBe('Inappropriate content');
    });

    it('should throw error for non-existent content', async () => {
      await expect(communityService.moderateContent('testimonial', 'nonexistent-id', 'approve'))
        .rejects.toThrow('testimonial not found');
    });
  });

  describe('getCommunityStats', () => {
    beforeEach(async () => {
      mockUser.findById.mockResolvedValue({
        id: 'user-123',
        subscription_tier: 'free'
      } as any);

      // Create some test content
      const testimonial = await communityService.createTestimonial({
        userId: 'user-123',
        userName: 'User1',
        content: 'Great service!',
        rating: 5,
        isVerified: false,
        isPublic: true,
        isFeatured: false,
        tags: [],
        metadata: {}
      });

      // Approve the testimonial
      await communityService.moderateContent('testimonial', testimonial.id, 'approve');

      const post = await communityService.createPost({
        userId: 'user-123',
        userName: 'User1',
        type: 'success_story',
        title: 'Success Story',
        content: 'My success with BoosterBeacon',
        images: [],
        tags: [],
        isPublic: true,
        isFeatured: false
      });

      // Approve the post
      await communityService.moderateContent('post', post.id, 'approve');
    });

    it('should return community statistics', async () => {
      const stats = await communityService.getCommunityStats();

      expect(stats).toBeDefined();
      expect(typeof stats.totalTestimonials).toBe('number');
      expect(typeof stats.averageRating).toBe('number');
      expect(typeof stats.totalPosts).toBe('number');
      expect(typeof stats.totalComments).toBe('number');
      expect(typeof stats.activeUsers).toBe('number');
      expect(typeof stats.featuredContent).toBe('number');
      
      expect(stats.totalTestimonials).toBeGreaterThan(0);
      expect(stats.totalPosts).toBeGreaterThan(0);
      expect(stats.averageRating).toBeGreaterThan(0);
    });
  });

  describe('getFeaturedContent', () => {
    beforeEach(async () => {
      mockUser.findById.mockResolvedValue({
        id: 'user-123',
        subscription_tier: 'free'
      } as any);

      // Create featured testimonial
      const testimonial = await communityService.createTestimonial({
        userId: 'user-123',
        userName: 'FeaturedUser',
        content: 'Amazing service, highly recommended!',
        rating: 5,
        isVerified: false,
        isPublic: true,
        isFeatured: true,
        tags: [],
        metadata: {}
      });

      await communityService.moderateContent('testimonial', testimonial.id, 'approve');

      // Create featured post
      const post = await communityService.createPost({
        userId: 'user-123',
        userName: 'FeaturedUser',
        type: 'success_story',
        title: 'Featured Success Story',
        content: 'This is a featured success story',
        images: [],
        tags: [],
        isPublic: true,
        isFeatured: true
      });

      await communityService.moderateContent('post', post.id, 'approve');
    });

    it('should return featured content', async () => {
      const content = await communityService.getFeaturedContent();

      expect(content).toBeDefined();
      expect(Array.isArray(content.testimonials)).toBe(true);
      expect(Array.isArray(content.posts)).toBe(true);
      
      expect(content.testimonials.length).toBeGreaterThan(0);
      expect(content.posts.length).toBeGreaterThan(0);
      
      // All returned content should be featured
      content.testimonials.forEach(testimonial => {
        expect(testimonial.isFeatured).toBe(true);
        expect(testimonial.isPublic).toBe(true);
        expect(testimonial.moderationStatus).toBe('approved');
      });

      content.posts.forEach(post => {
        expect(post.isFeatured).toBe(true);
        expect(post.isPublic).toBe(true);
        expect(post.moderationStatus).toBe('approved');
      });
    });
  });
});