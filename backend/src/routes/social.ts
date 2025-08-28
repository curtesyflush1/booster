import { Router } from 'express';
import { SocialController } from '../controllers/socialController';
import { authenticate } from '../middleware/auth';
import { generalRateLimit } from '../middleware/rateLimiter';

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
router.post('/share-links', SocialController.validateShareData, SocialController.generateShareLinks);

/**
 * @route GET /api/social/alerts/:alertId/share
 * @desc Generate share links for a specific alert
 * @access Private
 */
router.get('/alerts/:alertId/share', SocialController.validateAlertId, SocialController.shareAlert);

/**
 * @route POST /api/social/posts
 * @desc Generate social media posts for different platforms
 * @access Private
 */
router.post('/posts', SocialController.validateShareData, SocialController.generateSocialPosts);

/**
 * @route POST /api/social/track
 * @desc Track social media shares
 * @access Private
 */
router.post('/track', SocialController.trackShare);

/**
 * @route GET /api/social/popular
 * @desc Get popular shared content
 * @access Private
 */
router.get('/popular', SocialController.getPopularShares);

/**
 * @route GET /api/social/stats
 * @desc Get sharing statistics
 * @access Private
 */
router.get('/stats', SocialController.getSharingStats);

/**
 * @route GET /api/social/platforms
 * @desc Get social media platform information
 * @access Private
 */
router.get('/platforms', SocialController.getPlatformInfo);

export default router;