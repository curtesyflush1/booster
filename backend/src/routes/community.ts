import { Router } from 'express';
import { CommunityController } from '../controllers/communityController';
import { authenticate } from '../middleware/auth';
import { generalRateLimit } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication to all community routes
router.use(authenticate);

// Apply rate limiting
router.use(generalRateLimit);

// Testimonial routes
/**
 * @route POST /api/community/testimonials
 * @desc Create a new testimonial
 * @access Private
 */
router.post('/testimonials', CommunityController.validateTestimonial, CommunityController.createTestimonial);

/**
 * @route GET /api/community/testimonials
 * @desc Get testimonials with filters
 * @access Private
 */
router.get('/testimonials', CommunityController.getTestimonials);

/**
 * @route PUT /api/community/testimonials/:id
 * @desc Update testimonial
 * @access Private
 */
router.put('/testimonials/:id', CommunityController.validateId, CommunityController.updateTestimonial);

/**
 * @route DELETE /api/community/testimonials/:id
 * @desc Delete testimonial
 * @access Private
 */
router.delete('/testimonials/:id', CommunityController.validateId, CommunityController.deleteTestimonial);

// Community post routes
/**
 * @route POST /api/community/posts
 * @desc Create a new community post
 * @access Private
 */
router.post('/posts', CommunityController.validatePost, CommunityController.createPost);

/**
 * @route GET /api/community/posts
 * @desc Get community posts with filters
 * @access Private
 */
router.get('/posts', CommunityController.getPosts);

/**
 * @route POST /api/community/posts/:id/like
 * @desc Like/unlike a post
 * @access Private
 */
router.post('/posts/:id/like', CommunityController.validateId, CommunityController.togglePostLike);

/**
 * @route POST /api/community/posts/:id/comments
 * @desc Add comment to post
 * @access Private
 */
router.post('/posts/:id/comments', CommunityController.validateId, CommunityController.validateComment, CommunityController.addComment);

/**
 * @route GET /api/community/posts/:id/comments
 * @desc Get post comments
 * @access Private
 */
router.get('/posts/:id/comments', CommunityController.validateId, CommunityController.getPostComments);

// Community statistics and featured content
/**
 * @route GET /api/community/stats
 * @desc Get community statistics
 * @access Private
 */
router.get('/stats', CommunityController.getCommunityStats);

/**
 * @route GET /api/community/featured
 * @desc Get featured community content
 * @access Private
 */
router.get('/featured', CommunityController.getFeaturedContent);

// Moderation routes (admin only)
/**
 * @route POST /api/community/moderate
 * @desc Moderate community content
 * @access Admin
 */
router.post('/moderate', CommunityController.moderateContent);

export default router;