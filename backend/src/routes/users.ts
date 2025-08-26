import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticate, requireEmailVerification } from '../middleware/auth';
import { generalRateLimit } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication to all user routes
router.use(authenticate);

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', userController.getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile information
 * @access  Private
 */
router.put('/profile', generalRateLimit, userController.updateProfile);

/**
 * @route   PUT /api/users/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/preferences', generalRateLimit, userController.updatePreferences);

/**
 * @route   PUT /api/users/notification-settings
 * @desc    Update notification settings
 * @access  Private
 */
router.put('/notification-settings', generalRateLimit, userController.updateNotificationSettings);

/**
 * @route   PUT /api/users/quiet-hours
 * @desc    Update quiet hours settings
 * @access  Private
 */
router.put('/quiet-hours', generalRateLimit, userController.updateQuietHours);

/**
 * @route   POST /api/users/addresses
 * @desc    Add shipping address
 * @access  Private
 */
router.post('/addresses', generalRateLimit, userController.addShippingAddress);

/**
 * @route   DELETE /api/users/addresses/:addressId
 * @desc    Remove shipping address
 * @access  Private
 */
router.delete('/addresses/:addressId', generalRateLimit, userController.removeShippingAddress);

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/stats', userController.getUserStats);

export default router;