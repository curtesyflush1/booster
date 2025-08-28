import { Request, Response } from 'express';
import { discordBotService } from '../services/discordBotService';
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

export class DiscordController {
  // Validation middleware
  static validateServerConfig = [
    body('serverId').isString().notEmpty().withMessage('Server ID is required'),
    body('channelId').isString().notEmpty().withMessage('Channel ID is required'),
    body('token').isString().notEmpty().withMessage('Bot token is required'),
    body('alertFilters').optional().isObject(),
    body('alertFilters.retailers').optional().isArray(),
    body('alertFilters.categories').optional().isArray(),
    body('alertFilters.priceRange').optional().isObject(),
    body('alertFilters.keywords').optional().isArray(),
    validateRequest
  ];

  static validateServerId = [
    param('serverId').isString().notEmpty().withMessage('Server ID is required'),
    validateRequest
  ];

  /**
   * Add Discord server configuration
   */
  static async addServerConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { serverId, channelId, token, alertFilters = {} } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const config = await discordBotService.addServerConfig({
        serverId,
        channelId,
        token,
        userId,
        alertFilters,
        isActive: true
      });

      logger.info(`User ${userId} added Discord server config for ${serverId}`);

      res.status(201).json({
        success: true,
        data: {
          id: config.id,
          serverId: config.serverId,
          channelId: config.channelId,
          alertFilters: config.alertFilters,
          isActive: config.isActive,
          createdAt: config.createdAt
        }
      });
    } catch (error) {
      logger.error('Failed to add Discord server config:', error);
      res.status(500).json({
        error: 'Failed to add Discord server configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get Discord server configuration
   */
  static async getServerConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;
      const config = await discordBotService.getServerConfig(serverId);

      if (!config) {
        res.status(404).json({ error: 'Discord server configuration not found' });
        return;
      }

      // Only return config if user owns it or is admin
      if (config.userId !== req.user?.id && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      res.json({
        success: true,
        data: {
          id: config.id,
          serverId: config.serverId,
          channelId: config.channelId,
          alertFilters: config.alertFilters,
          isActive: config.isActive,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt
        }
      });
    } catch (error) {
      logger.error('Failed to get Discord server config:', error);
      res.status(500).json({ error: 'Failed to retrieve Discord server configuration' });
    }
  }

  /**
   * Update Discord server configuration
   */
  static async updateServerConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;
      const updates = req.body;

      const existingConfig = await discordBotService.getServerConfig(serverId);
      if (!existingConfig) {
        res.status(404).json({ error: 'Discord server configuration not found' });
        return;
      }

      // Only allow updates if user owns it or is admin
      if (existingConfig.userId !== req.user?.id && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const updatedConfig = await discordBotService.updateServerConfig(serverId, updates);

      logger.info(`User ${req.user?.id} updated Discord server config for ${serverId}`);

      res.json({
        success: true,
        data: {
          id: updatedConfig.id,
          serverId: updatedConfig.serverId,
          channelId: updatedConfig.channelId,
          alertFilters: updatedConfig.alertFilters,
          isActive: updatedConfig.isActive,
          updatedAt: updatedConfig.updatedAt
        }
      });
    } catch (error) {
      logger.error('Failed to update Discord server config:', error);
      res.status(500).json({ error: 'Failed to update Discord server configuration' });
    }
  }

  /**
   * Remove Discord server configuration
   */
  static async removeServerConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;

      const existingConfig = await discordBotService.getServerConfig(serverId);
      if (!existingConfig) {
        res.status(404).json({ error: 'Discord server configuration not found' });
        return;
      }

      // Only allow removal if user owns it or is admin
      if (existingConfig.userId !== req.user?.id && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      await discordBotService.removeServerConfig(serverId);

      logger.info(`User ${req.user?.id} removed Discord server config for ${serverId}`);

      res.json({
        success: true,
        message: 'Discord server configuration removed successfully'
      });
    } catch (error) {
      logger.error('Failed to remove Discord server config:', error);
      res.status(500).json({ error: 'Failed to remove Discord server configuration' });
    }
  }

  /**
   * List all Discord server configurations for user
   */
  static async listServerConfigs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const isAdmin = req.user?.role === 'admin';

      let configs = await discordBotService.getAllServerConfigs();

      // Filter by user unless admin
      if (!isAdmin) {
        configs = configs.filter(config => config.userId === userId);
      }

      res.json({
        success: true,
        data: configs.map(config => ({
          id: config.id,
          serverId: config.serverId,
          channelId: config.channelId,
          alertFilters: config.alertFilters,
          isActive: config.isActive,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
          ...(isAdmin && { userId: config.userId })
        }))
      });
    } catch (error) {
      logger.error('Failed to list Discord server configs:', error);
      res.status(500).json({ error: 'Failed to retrieve Discord server configurations' });
    }
  }

  /**
   * Test Discord connection
   */
  static async testConnection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;

      const config = await discordBotService.getServerConfig(serverId);
      if (!config) {
        res.status(404).json({ error: 'Discord server configuration not found' });
        return;
      }

      // Only allow testing if user owns it or is admin
      if (config.userId !== req.user?.id && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const isConnected = await discordBotService.testConnection(serverId);

      res.json({
        success: true,
        data: {
          serverId,
          isConnected,
          testedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to test Discord connection:', error);
      res.status(500).json({ error: 'Failed to test Discord connection' });
    }
  }

  /**
   * Get Discord server statistics
   */
  static async getServerStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;

      const config = await discordBotService.getServerConfig(serverId);
      if (!config) {
        res.status(404).json({ error: 'Discord server configuration not found' });
        return;
      }

      // Only allow stats if user owns it or is admin
      if (config.userId !== req.user?.id && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const stats = await discordBotService.getServerStats(serverId);

      res.json({
        success: true,
        data: {
          serverId,
          ...stats
        }
      });
    } catch (error) {
      logger.error('Failed to get Discord server stats:', error);
      res.status(500).json({ error: 'Failed to retrieve Discord server statistics' });
    }
  }

  /**
   * Send test alert to Discord server
   */
  static async sendTestAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;
      const { productName, retailerName, price } = req.body;

      const config = await discordBotService.getServerConfig(serverId);
      if (!config) {
        res.status(404).json({ error: 'Discord server configuration not found' });
        return;
      }

      // Only allow testing if user owns it or is admin
      if (config.userId !== req.user?.id && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const testAlert = {
        productName: productName || 'Test Pokémon TCG Product',
        retailerName: retailerName || 'Test Retailer',
        price: price || 4.99,
        availability: 'In Stock',
        productUrl: 'https://example.com/test-product'
      };

      await discordBotService.sendAlert(testAlert, serverId);

      logger.info(`User ${req.user?.id} sent test alert to Discord server ${serverId}`);

      res.json({
        success: true,
        message: 'Test alert sent successfully',
        data: {
          serverId,
          alert: testAlert,
          sentAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to send test Discord alert:', error);
      res.status(500).json({ error: 'Failed to send test alert' });
    }
  }
}