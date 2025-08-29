import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticate, requireEmailVerification } from '../middleware/auth';
import { generalRateLimit } from '../middleware/rateLimiter';
import { sanitizeParameters } from '../middleware/parameterSanitization';
import { contentSanitizationMiddleware } from '../utils/contentSanitization';
import { validateBody, validateJoi, userSchemas } from '../validators';

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
router.put('/profile', generalRateLimit, contentSanitizationMiddleware.users, validateBody(userSchemas.updateProfile), userController.updateProfile);

/**
 * @route   PUT /api/users/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/preferences', generalRateLimit, contentSanitizationMiddleware.users, validateBody(userSchemas.updatePreferences), userController.updatePreferences);

/**
 * @route   PUT /api/users/notification-settings
 * @desc    Update notification settings
 * @access  Private
 */
router.put('/notification-settings', generalRateLimit, validateBody(userSchemas.updateNotificationSettings), userController.updateNotificationSettings);

/**
 * @route   PUT /api/users/quiet-hours
 * @desc    Update quiet hours settings
 * @access  Private
 */
router.put('/quiet-hours', generalRateLimit, validateBody(userSchemas.updateQuietHours), userController.updateQuietHours);

/**
 * @route   POST /api/users/addresses
 * @desc    Add shipping address
 * @access  Private
 */
router.post('/addresses', generalRateLimit, validateBody(userSchemas.addShippingAddress), userController.addShippingAddress);

/**
 * @route   DELETE /api/users/addresses/:addressId
 * @desc    Remove shipping address
 * @access  Private
 */
router.delete('/addresses/:addressId', sanitizeParameters, generalRateLimit, userController.removeShippingAddress);

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/stats', userController.getUserStats);

/**
 * @route   POST /api/users/retailer-credentials
 * @desc    Add retailer login credentials
 * @access  Private
 */
router.post('/retailer-credentials', generalRateLimit, validateBody(userSchemas.addRetailerCredential), userController.addRetailerCredentials);

/**
 * @route   GET /api/users/retailer-credentials
 * @desc    Get list of retailer credentials (without passwords)
 * @access  Private
 */
router.get('/retailer-credentials', userController.getRetailerCredentials);

/**
 * @route   PUT /api/users/retailer-credentials/:retailer
 * @desc    Update retailer credentials
 * @access  Private
 */
router.put('/retailer-credentials/:retailer', sanitizeParameters, generalRateLimit, validateJoi({
  params: userSchemas.updateRetailerCredential.params,
  body: userSchemas.updateRetailerCredential.body
}), userController.updateRetailerCredentials);

/**
 * @route   DELETE /api/users/retailer-credentials/:retailer
 * @desc    Delete retailer credentials
 * @access  Private
 */
router.delete('/retailer-credentials/:retailer', sanitizeParameters, generalRateLimit, userController.deleteRetailerCredentials);

/**
 * @route   POST /api/users/retailer-credentials/:retailer/verify
 * @desc    Verify retailer credentials
 * @access  Private
 */
router.post('/retailer-credentials/:retailer/verify', sanitizeParameters, generalRateLimit, userController.verifyRetailerCredentials);

/**
 * @route   POST /api/users/retailer-credentials/secure
 * @desc    Add retailer credentials with user-specific encryption
 * @access  Private
 */
router.post('/retailer-credentials/secure', generalRateLimit, validateBody(userSchemas.addRetailerCredentialSecure), userController.storeRetailerCredentialsSecure);

/**
 * @route   POST /api/users/retailer-credentials/secure/:retailer
 * @desc    Get retailer credentials with user-specific decryption
 * @access  Private
 */
router.post('/retailer-credentials/secure/:retailer', sanitizeParameters, generalRateLimit, validateJoi({
  params: userSchemas.getRetailerCredentialSecure.params,
  body: userSchemas.getRetailerCredentialSecure.body
}), userController.getRetailerCredentialsSecure);

/**
 * @route   GET /api/users/retailer-credentials/secure
 * @desc    List retailer credentials with encryption type information
 * @access  Private
 */
router.get('/retailer-credentials/secure', userController.listRetailerCredentialsSecure);

/**
 * @route   POST /api/users/retailer-credentials/migrate
 * @desc    Migrate existing credentials to user-specific encryption
 * @access  Private
 */
router.post('/retailer-credentials/migrate', generalRateLimit, validateBody(userSchemas.migrateCredentialsToUserEncryption), userController.migrateCredentialsToUserEncryption);

/**
 * @route   POST /api/users/payment-methods
 * @desc    Add payment method
 * @access  Private
 */
router.post('/payment-methods', generalRateLimit, validateBody(userSchemas.addPaymentMethod), userController.addPaymentMethod);

/**
 * @route   DELETE /api/users/payment-methods/:paymentMethodId
 * @desc    Remove payment method
 * @access  Private
 */
router.delete('/payment-methods/:paymentMethodId', sanitizeParameters, generalRateLimit, userController.removePaymentMethod);

/**
 * @route   GET /api/users/quiet-hours/check
 * @desc    Check current quiet hours status
 * @access  Private
 */
router.get('/quiet-hours/check', userController.checkQuietHours);

export default router;