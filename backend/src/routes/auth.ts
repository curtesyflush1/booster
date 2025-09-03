import { Router } from 'express';
import * as authController from '../controllers/authController';
import * as authMiddleware from '../middleware/auth';
import { 
  authRateLimit, 
  passwordResetRateLimit, 
  registrationRateLimit 
} from '../middleware/rateLimiter';
import { validateBody, authSchemas } from '../validators';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', registrationRateLimit, validateBody(authSchemas.register), authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', authRateLimit, validateBody(authSchemas.login), authController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', validateBody(authSchemas.refreshToken), authController.refreshToken);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
const authGuard = (authMiddleware as any).authenticate || (authMiddleware as any).auth;
router.get('/profile', authGuard, authController.getProfile);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', passwordResetRateLimit, validateBody(authSchemas.passwordResetRequest), authController.requestPasswordReset);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using token
 * @access  Public
 */
router.post('/reset-password', validateBody(authSchemas.passwordReset), authController.resetPassword);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password (requires current password)
 * @access  Private
 */
router.post('/change-password', authGuard, validateBody(authSchemas.changePassword), authController.changePassword);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email using token
 * @access  Public
 */
router.post('/verify-email', validateBody(authSchemas.emailVerification), authController.verifyEmail);

/**
 * @route   GET /api/auth/verify-email/:token
 * @desc    Verify email via link
 * @access  Public
 */
router.get('/verify-email/:token', authController.verifyEmailFromLink);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification
 * @access  Public
 */
router.post('/resend-verification', validateBody(authSchemas.resendVerification), authController.resendVerificationEmail);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authGuard, authController.logout);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout user from all devices
 * @access  Private
 */
router.post('/logout-all', authGuard, authController.logoutAllDevices);

export default router;
