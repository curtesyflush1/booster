import { Router } from 'express';
import { CommunityController } from '../controllers/communityController';
import { authenticate } from '../middleware/auth';
import { generalRateLimit } from '../middleware/rateLimiter';
import { sanitizeParameters } from '../middleware/parameterSanitization';
import { validateJoiBody, validateJoiQuery, validateJoiParams, validateJoi, communitySchemas } from '../validators';
import { authenticatedHandler } from '../utils/routeHandlers';

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
router.post('/testimonials', 
  validateJoiBody(communitySchemas.createTestimonial), 
  authenticatedHandler(CommunityController.createTestimonial)
);

/**
 * @route GET /api/community/testimonials
 * @desc Get testimonials with filters
 * @access Private
 */
router.get('/testimonials', 
  validateJoiQuery(communitySchemas.getTestimonials.query), 
  authenticatedHandler(CommunityController.getTestimonials)
);

/**
 * @route PUT /api/community/testimonials/:id
 * @desc Update testimonial
 * @access Private
 */
router.put('/testimonials/:id', 
  sanitizeParameters,
  validateJoi(communitySchemas.updateTestimonial), 
  authenticatedHandler(CommunityController.updateTestimonial)
);

/**
 * @route DELETE /api/community/testimonials/:id
 * @desc Delete testimonial
 * @access Private
 */
router.delete('/testimonials/:id', 
  sanitizeParameters,
  validateJoi(communitySchemas.deleteTestimonial), 
  authenticatedHandler(CommunityController.deleteTestimonial)
);

// Community post routes
/**
 * @route POST /api/community/posts
 * @desc Create a new community post
 * @access Private
 */
router.post('/posts', 
  validateJoiBody(communitySchemas.createPost), 
  authenticatedHandler(CommunityController.createPost)
);

/**
 * @route GET /api/community/posts
 * @desc Get community posts with filters
 * @access Private
 */
router.get('/posts', 
  validateJoiQuery(communitySchemas.getPosts.query), 
  authenticatedHandler(CommunityController.getPosts)
);

/**
 * @route POST /api/community/posts/:id/like
 * @desc Like/unlike a post
 * @access Private
 */
router.post('/posts/:id/like', 
  sanitizeParameters,
  validateJoi(communitySchemas.togglePostLike), 
  authenticatedHandler(CommunityController.togglePostLike)
);

/**
 * @route POST /api/community/posts/:id/comments
 * @desc Add comment to post
 * @access Private
 */
router.post('/posts/:id/comments', 
  sanitizeParameters,
  validateJoi(communitySchemas.addComment), 
  authenticatedHandler(CommunityController.addComment)
);

/**
 * @route GET /api/community/posts/:id/comments
 * @desc Get post comments
 * @access Private
 */
router.get('/posts/:id/comments', 
  sanitizeParameters,
  validateJoi(communitySchemas.getPostComments), 
  authenticatedHandler(CommunityController.getPostComments)
);

// Community statistics and featured content
/**
 * @route GET /api/community/stats
 * @desc Get community statistics
 * @access Private
 */
router.get('/stats', authenticatedHandler(CommunityController.getCommunityStats));

/**
 * @route GET /api/community/featured
 * @desc Get featured community content
 * @access Private
 */
router.get('/featured', authenticatedHandler(CommunityController.getFeaturedContent));

// Moderation routes (admin only)
/**
 * @route POST /api/community/moderate
 * @desc Moderate community content
 * @access Admin
 */
router.post('/moderate', 
  validateJoiBody(communitySchemas.moderateContent), 
  authenticatedHandler(CommunityController.moderateContent)
);

export default router;