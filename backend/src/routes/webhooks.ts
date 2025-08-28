import { Router } from 'express';
import { WebhookController } from '../controllers/webhookController';
import { authenticate } from '../middleware/auth';
import { generalRateLimit } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication to all webhook routes
router.use(authenticate);

// Apply rate limiting
router.use(generalRateLimit);

/**
 * @route POST /api/webhooks
 * @desc Create a new webhook
 * @access Private
 */
router.post('/', WebhookController.validateWebhookConfig, WebhookController.createWebhook);

/**
 * @route GET /api/webhooks
 * @desc List user's webhooks
 * @access Private
 */
router.get('/', WebhookController.listWebhooks);

/**
 * @route GET /api/webhooks/:webhookId
 * @desc Get webhook by ID
 * @access Private
 */
router.get('/:webhookId', WebhookController.validateWebhookId, WebhookController.getWebhook);

/**
 * @route PUT /api/webhooks/:webhookId
 * @desc Update webhook
 * @access Private
 */
router.put('/:webhookId', WebhookController.validateWebhookId, WebhookController.updateWebhook);

/**
 * @route DELETE /api/webhooks/:webhookId
 * @desc Delete webhook
 * @access Private
 */
router.delete('/:webhookId', WebhookController.validateWebhookId, WebhookController.deleteWebhook);

/**
 * @route POST /api/webhooks/:webhookId/test
 * @desc Test webhook
 * @access Private
 */
router.post('/:webhookId/test', WebhookController.validateWebhookId, WebhookController.testWebhook);

/**
 * @route GET /api/webhooks/:webhookId/stats
 * @desc Get webhook statistics
 * @access Private
 */
router.get('/:webhookId/stats', WebhookController.validateWebhookId, WebhookController.getWebhookStats);

/**
 * @route POST /api/webhooks/trigger
 * @desc Manually trigger webhook (admin only)
 * @access Admin
 */
router.post('/trigger', WebhookController.triggerWebhook);

export default router;