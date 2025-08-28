import { Request, Response } from 'express';
import { webhookService } from '../services/webhookService';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation';
import { body, param } from 'express-validator';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class WebhookController {
  // Validation middleware
  static validateWebhookConfig = [
    body('name').isString().notEmpty().withMessage('Webhook name is required'),
    body('url').isURL().withMessage('Valid webhook URL is required'),
    body('secret').optional().isString().isLength({ min: 8 }).withMessage('Secret must be at least 8 characters'),
    body('events').isArray().notEmpty().withMessage('At least one event must be specified'),
    body('events.*').isIn(['alert.created', 'alert.updated', 'product.restocked', 'product.price_changed', 'user.subscription_changed'])
      .withMessage('Invalid event type'),
    body('headers').optional().isObject(),
    body('retryConfig').optional().isObject(),
    body('retryConfig.maxRetries').optional().isInt({ min: 0, max: 10 }).withMessage('Max retries must be between 0 and 10'),
    body('retryConfig.retryDelay').optional().isInt({ min: 100 }).withMessage('Retry delay must be at least 100ms'),
    body('retryConfig.backoffMultiplier').optional().isFloat({ min: 1 }).withMessage('Backoff multiplier must be at least 1'),
    body('filters').optional().isObject(),
    body('filters.retailers').optional().isArray(),
    body('filters.categories').optional().isArray(),
    body('filters.priceRange').optional().isObject(),
    body('filters.keywords').optional().isArray(),
    validateRequest
  ];

  static validateWebhookId = [
    param('webhookId').isString().notEmpty().withMessage('Webhook ID is required'),
    validateRequest
  ];

  /**
   * Create a new webhook
   */
  static async createWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, url, secret, events, headers, retryConfig, filters } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const webhook = await webhookService.createWebhook({
        userId,
        name,
        url,
        secret,
        isActive: true,
        events,
        headers,
        retryConfig: retryConfig || {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2
        },
        filters: filters || {}
      });

      logger.info(`User ${userId} created webhook ${webhook.id}`);

      res.status(201).json({
        success: true,
        data: {
          id: webhook.id,
          name: webhook.name,
          url: webhook.url,
          events: webhook.events,
          isActive: webhook.isActive,
          filters: webhook.filters,
          retryConfig: webhook.retryConfig,
          createdAt: webhook.createdAt
        }
      });
    } catch (error) {
      logger.error('Failed to create webhook:', error);
      res.status(500).json({
        error: 'Failed to create webhook',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get webhook by ID
   */
  static async getWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      const webhook = await webhookService.getWebhook(webhookId);

      if (!webhook) {
        res.status(404).json({ error: 'Webhook not found' });
        return;
      }

      // Only return webhook if user owns it or is admin
      if (webhook.userId !== req.user?.id && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      res.json({
        success: true,
        data: {
          id: webhook.id,
          name: webhook.name,
          url: webhook.url,
          events: webhook.events,
          isActive: webhook.isActive,
          filters: webhook.filters,
          retryConfig: webhook.retryConfig,
          totalCalls: webhook.totalCalls,
          successfulCalls: webhook.successfulCalls,
          failedCalls: webhook.failedCalls,
          lastTriggered: webhook.lastTriggered,
          createdAt: webhook.createdAt,
          updatedAt: webhook.updatedAt
        }
      });
    } catch (error) {
      logger.error('Failed to get webhook:', error);
      res.status(500).json({ error: 'Failed to retrieve webhook' });
    }
  }

  /**
   * Update webhook
   */
  static async updateWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      const updates = req.body;

      const existingWebhook = await webhookService.getWebhook(webhookId);
      if (!existingWebhook) {
        res.status(404).json({ error: 'Webhook not found' });
        return;
      }

      // Only allow updates if user owns it or is admin
      if (existingWebhook.userId !== req.user?.id && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const updatedWebhook = await webhookService.updateWebhook(webhookId, updates);

      logger.info(`User ${req.user?.id} updated webhook ${webhookId}`);

      res.json({
        success: true,
        data: {
          id: updatedWebhook.id,
          name: updatedWebhook.name,
          url: updatedWebhook.url,
          events: updatedWebhook.events,
          isActive: updatedWebhook.isActive,
          filters: updatedWebhook.filters,
          retryConfig: updatedWebhook.retryConfig,
          updatedAt: updatedWebhook.updatedAt
        }
      });
    } catch (error) {
      logger.error('Failed to update webhook:', error);
      res.status(500).json({ error: 'Failed to update webhook' });
    }
  }

  /**
   * Delete webhook
   */
  static async deleteWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;

      const existingWebhook = await webhookService.getWebhook(webhookId);
      if (!existingWebhook) {
        res.status(404).json({ error: 'Webhook not found' });
        return;
      }

      // Only allow deletion if user owns it or is admin
      if (existingWebhook.userId !== req.user?.id && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      await webhookService.deleteWebhook(webhookId);

      logger.info(`User ${req.user?.id} deleted webhook ${webhookId}`);

      res.json({
        success: true,
        message: 'Webhook deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete webhook:', error);
      res.status(500).json({ error: 'Failed to delete webhook' });
    }
  }

  /**
   * List user's webhooks
   */
  static async listWebhooks(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const isAdmin = req.user?.role === 'admin';

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      let webhooks;
      if (isAdmin && req.query.all === 'true') {
        webhooks = await webhookService.getAllWebhooks();
      } else {
        webhooks = await webhookService.getUserWebhooks(userId);
      }

      res.json({
        success: true,
        data: webhooks.map(webhook => ({
          id: webhook.id,
          name: webhook.name,
          url: webhook.url,
          events: webhook.events,
          isActive: webhook.isActive,
          filters: webhook.filters,
          totalCalls: webhook.totalCalls,
          successfulCalls: webhook.successfulCalls,
          failedCalls: webhook.failedCalls,
          lastTriggered: webhook.lastTriggered,
          createdAt: webhook.createdAt,
          updatedAt: webhook.updatedAt,
          ...(isAdmin && { userId: webhook.userId })
        }))
      });
    } catch (error) {
      logger.error('Failed to list webhooks:', error);
      res.status(500).json({ error: 'Failed to retrieve webhooks' });
    }
  }

  /**
   * Test webhook
   */
  static async testWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;

      const webhook = await webhookService.getWebhook(webhookId);
      if (!webhook) {
        res.status(404).json({ error: 'Webhook not found' });
        return;
      }

      // Only allow testing if user owns it or is admin
      if (webhook.userId !== req.user?.id && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const result = await webhookService.testWebhook(webhookId);

      logger.info(`User ${req.user?.id} tested webhook ${webhookId}`);

      res.json({
        success: true,
        data: {
          webhookId,
          testResult: result,
          testedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to test webhook:', error);
      res.status(500).json({ error: 'Failed to test webhook' });
    }
  }

  /**
   * Get webhook statistics
   */
  static async getWebhookStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;

      const webhook = await webhookService.getWebhook(webhookId);
      if (!webhook) {
        res.status(404).json({ error: 'Webhook not found' });
        return;
      }

      // Only allow stats if user owns it or is admin
      if (webhook.userId !== req.user?.id && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const stats = await webhookService.getWebhookStats(webhookId);

      res.json({
        success: true,
        data: {
          webhookId,
          ...stats
        }
      });
    } catch (error) {
      logger.error('Failed to get webhook stats:', error);
      res.status(500).json({ error: 'Failed to retrieve webhook statistics' });
    }
  }

  /**
   * Trigger webhook manually (admin only)
   */
  static async triggerWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Only admins can manually trigger webhooks
      if (req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const { event, data, userId } = req.body;

      if (!event || !data) {
        res.status(400).json({ error: 'Event and data are required' });
        return;
      }

      await webhookService.triggerWebhook(event, data, userId);

      logger.info(`Admin ${req.user?.id} manually triggered webhook event ${event}`);

      res.json({
        success: true,
        message: 'Webhook triggered successfully',
        data: {
          event,
          triggeredAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to trigger webhook:', error);
      res.status(500).json({ error: 'Failed to trigger webhook' });
    }
  }
}