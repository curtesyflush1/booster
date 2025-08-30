import { Router } from 'express';
import { WebhookController } from '../controllers/webhookController';
import { authenticate } from '../middleware/auth';
import { generalRateLimit } from '../middleware/rateLimiter';
import { sanitizeParameters } from '../middleware/parameterSanitization';
import { authenticatedHandler } from '../utils/routeHandlers';

const router = Router();

// Apply middleware to all webhook routes
router.use(authenticate);
router.use(generalRateLimit);
router.use(sanitizeParameters);

/**
 * @route POST /api/webhooks
 * @desc Create a new webhook
 * @access Private
 */
router.post('/', WebhookController.validateWebhookConfig, authenticatedHandler(WebhookController.createWebhook));

/**
 * @route GET /api/webhooks
 * @desc List user's webhooks
 * @access Private
 */
router.get('/', authenticatedHandler(WebhookController.listWebhooks));

/**
 * @route GET /api/webhooks/:webhookId
 * @desc Get webhook by ID
 * @access Private
 */
router.get('/:webhookId', WebhookController.validateWebhookId, authenticatedHandler(WebhookController.getWebhook));

/**
 * @route PUT /api/webhooks/:webhookId
 * @desc Update webhook
 * @access Private
 */
router.put('/:webhookId', WebhookController.validateWebhookId, WebhookController.validateWebhookConfig, authenticatedHandler(WebhookController.updateWebhook));

/**
 * @route DELETE /api/webhooks/:webhookId
 * @desc Delete webhook
 * @access Private
 */
router.delete('/:webhookId', WebhookController.validateWebhookId, authenticatedHandler(WebhookController.deleteWebhook));

/**
 * @route POST /api/webhooks/:webhookId/test
 * @desc Test webhook
 * @access Private
 */
router.post('/:webhookId/test', WebhookController.validateWebhookId, authenticatedHandler(WebhookController.testWebhook));

/**
 * @route GET /api/webhooks/:webhookId/stats
 * @desc Get webhook statistics
 * @access Private
 */
router.get('/:webhookId/stats', WebhookController.validateWebhookId, authenticatedHandler(WebhookController.getWebhookStats));

/**
 * @route POST /api/webhooks/trigger
 * @desc Manually trigger webhook (admin only)
 * @access Admin
 */
router.post('/trigger', authenticatedHandler(WebhookController.triggerWebhook));

export default router;