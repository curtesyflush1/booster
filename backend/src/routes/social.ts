import { Router } from 'express';
import { SocialController } from '../controllers/socialController';
import { authenticate } from '../middleware/auth';
import { generalRateLimit } from '../middleware/rateLimiter';
import { sanitizeParameters } from '../middleware/parameterSanitization';
import { authenticatedHandler } from '../utils/routeHandlers';

const router = Router();

// Apply authentication to all social routes
router.use(authenticate);

// Apply rate limiting
router.use(generalRateLimit);

/**
 * @route POST /api/social/share-links
 * @desc Generate share links for custom content
 * @access Private
 */
router.post('/share-links', SocialController.validateShareData, authenticatedHandler(SocialController.generateShareLinks));

/**
 * @route GET /api/social/alerts/:alertId/share
 * @desc Generate share links for a specific alert
 * @access Private
 */
router.get('/alerts/:alertId/share', sanitizeParameters, SocialController.validateAlertId, authenticatedHandler(SocialController.shareAlert));

/**
 * @route POST /api/social/posts
 * @desc Generate social media posts for different platforms
 * @access Private
 */
router.post('/posts', SocialController.validateShareData, authenticatedHandler(SocialController.generateSocialPosts));

/**
 * @route POST /api/social/track
 * @desc Track social media shares
 * @access Private
 */
router.post('/track', authenticatedHandler(SocialController.trackShare));

/**
 * @route GET /api/social/popular
 * @desc Get popular shared content
 * @access Private
 */
router.get('/popular', authenticatedHandler(SocialController.getPopularShares));

/**
 * @route GET /api/social/stats
 * @desc Get sharing statistics
 * @access Private
 */
router.get('/stats', authenticatedHandler(SocialController.getSharingStats));

/**
 * @route GET /api/social/platforms
 * @desc Get social media platform information
 * @access Private
 */
router.get('/platforms', authenticatedHandler(SocialController.getPlatformInfo));

export default router;