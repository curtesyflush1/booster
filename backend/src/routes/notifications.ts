import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { WebPushService } from '../services/notifications/webPushService';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';
import { createRateLimit } from '../middleware/rateLimiter';

const router = Router();

// Rate limiting for notification endpoints
const notificationRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50, // 50 requests per window
  message: 'Too many notification requests, please try again later'
});

// Validation schemas
const subscribeSchema = Joi.object({
  endpoint: Joi.string().uri().required().messages({
    'string.uri': 'Endpoint must be a valid URL',
    'any.required': 'Endpoint is required'
  }),
  keys: Joi.object({
    p256dh: Joi.string().required().messages({
      'any.required': 'p256dh key is required'
    }),
    auth: Joi.string().required().messages({
      'any.required': 'auth key is required'
    })
  }).required().messages({
    'any.required': 'Keys object is required'
  })
});

const unsubscribeSchema = Joi.object({
  endpoint: Joi.string().uri().required().messages({
    'string.uri': 'Endpoint must be a valid URL',
    'any.required': 'Endpoint is required'
  })
});

/**
 * @route   GET /api/notifications/vapid-public-key
 * @desc    Get VAPID public key for client-side push subscription
 * @access  Public
 */
router.get('/vapid-public-key', notificationRateLimit, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    
    if (!publicKey) {
      res.status(503).json({
        error: {
          code: 'PUSH_NOT_CONFIGURED',
          message: 'Push notifications are not configured on this server',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    res.status(200).json({
      publicKey
    });
  } catch (error) {
    logger.error('Error getting VAPID public key', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
});

/**
 * @route   POST /api/notifications/subscribe
 * @desc    Subscribe to push notifications
 * @access  Private
 */
router.post('/subscribe', authenticate, notificationRateLimit, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate request body
    const { error, value } = subscribeSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation error',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Subscribe user to push notifications
    const result = await WebPushService.subscribe(req.user.id, value);
    
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'SUBSCRIPTION_FAILED',
          message: result.error || 'Failed to subscribe to push notifications',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    logger.info('User subscribed to push notifications', { 
      userId: req.user.id,
      endpoint: value.endpoint.substring(0, 50) + '...'
    });

    res.status(201).json({
      message: 'Successfully subscribed to push notifications'
    });
  } catch (error) {
    logger.error('Error subscribing to push notifications', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
});

/**
 * @route   POST /api/notifications/unsubscribe
 * @desc    Unsubscribe from push notifications
 * @access  Private
 */
router.post('/unsubscribe', authenticate, notificationRateLimit, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate request body
    const { error, value } = unsubscribeSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation error',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Unsubscribe user from push notifications
    const result = await WebPushService.unsubscribe(req.user.id, value.endpoint);
    
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'UNSUBSCRIPTION_FAILED',
          message: result.error || 'Failed to unsubscribe from push notifications',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    logger.info('User unsubscribed from push notifications', { 
      userId: req.user.id,
      endpoint: value.endpoint.substring(0, 50) + '...'
    });

    res.status(200).json({
      message: 'Successfully unsubscribed from push notifications'
    });
  } catch (error) {
    logger.error('Error unsubscribing from push notifications', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
});

/**
 * @route   POST /api/notifications/test
 * @desc    Send test push notification
 * @access  Private
 */
router.post('/test', authenticate, notificationRateLimit, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Send test notification
    const result = await WebPushService.sendTestNotification(req.user.id);
    
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'TEST_NOTIFICATION_FAILED',
          message: result.error || 'Failed to send test notification',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    logger.info('Test notification sent', { userId: req.user.id });

    res.status(200).json({
      message: 'Test notification sent successfully'
    });
  } catch (error) {
    logger.error('Error sending test notification', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
});

/**
 * @route   GET /api/notifications/stats
 * @desc    Get push notification statistics for user
 * @access  Private
 */
router.get('/stats', authenticate, notificationRateLimit, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Get push notification statistics
    const stats = await WebPushService.getUserPushStats(req.user.id);

    res.status(200).json({
      stats
    });
  } catch (error) {
    logger.error('Error getting push notification stats', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
});

/**
 * @route   GET /api/notifications/subscriptions
 * @desc    Get user's push subscriptions (without sensitive data)
 * @access  Private
 */
router.get('/subscriptions', authenticate, notificationRateLimit, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const subscriptions = await WebPushService.getUserPushSubscriptions(req.user.id);
    
    // Remove sensitive keys from response
    const safeSubscriptions = subscriptions.map(sub => ({
      id: sub.id,
      endpoint: sub.endpoint.substring(0, 50) + '...',
      createdAt: sub.createdAt,
      lastUsed: sub.lastUsed
    }));

    res.status(200).json({
      subscriptions: safeSubscriptions,
      count: subscriptions.length
    });
  } catch (error) {
    logger.error('Error getting push subscriptions', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
});

export default router;