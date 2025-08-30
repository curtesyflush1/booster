import { Request, Response } from 'express';
import { socialSharingService } from '../services/socialSharingService';
import { Alert } from '../models/Alert';
import { Product } from '../models/Product';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';
import { SOCIAL_MEDIA_LIMITS } from '../constants';
import { AuthenticatedRequest } from '../types/express';
import { IAlert, IProduct } from '../types/database';

export class SocialController {
  // Validation middleware
  static validateShareData = [
    body('title').isString().notEmpty().withMessage('Title is required'),
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('url').isURL().withMessage('Valid URL is required'),
    body('imageUrl').optional().isURL().withMessage('Image URL must be valid'),
    body('hashtags').optional().isArray(),
    body('price').optional().isNumeric().withMessage('Price must be a number'),
    body('originalPrice').optional().isNumeric().withMessage('Original price must be a number'),
    body('retailerName').optional().isString(),
    body('productName').optional().isString(),
    validateRequest
  ];

  static validateAlertId = [
    param('alertId').isString().notEmpty().withMessage('Alert ID is required'),
    validateRequest
  ];

  static validatePlatform = [
    query('platform').optional().isIn(['twitter', 'facebook', 'reddit', 'discord', 'telegram', 'whatsapp', 'linkedin', 'instagram', 'tiktok'])
      .withMessage('Invalid platform'),
    validateRequest
  ];

  /**
   * Generate share links for custom content
   */
  static async generateShareLinks(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const shareData = req.body;
      const shareLinks = socialSharingService.generateShareLinks(shareData);

      res.json({
        success: true,
        data: {
          shareLinks,
          openGraphTags: socialSharingService.generateOpenGraphTags(shareData)
        }
      });
    } catch (error) {
      logger.error('Failed to generate share links:', error);
      res.status(500).json({ error: 'Failed to generate share links' });
    }
  }

  /**
   * Generate share links for a specific alert
   */
  static async shareAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;
      const userId = req.user?.id;

      // Get alert details
      const alert = await Alert.findById<IAlert>(alertId);
      if (!alert) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }

      // Check if user owns the alert
      if (alert.user_id !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Get product details
      const product = await Product.findById<IProduct>(alert.product_id);
      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      // Create shareable data
      const shareData = socialSharingService.createShareableAlert(alert, product);
      const shareLinks = socialSharingService.generateShareLinks(shareData);
      const socialPosts = socialSharingService.generateSocialPosts(shareData);

      // Track the share generation
      await socialSharingService.trackShare('link_generation', alertId, userId);

      res.json({
        success: true,
        data: {
          alert: {
            id: alert.id,
            productName: product.name,
            retailerName: alert.data.retailer_name,
            price: alert.data.price,
            originalPrice: alert.data.original_price
          },
          shareLinks,
          socialPosts,
          openGraphTags: socialSharingService.generateOpenGraphTags(shareData)
        }
      });
    } catch (error) {
      logger.error('Failed to generate alert share links:', error);
      res.status(500).json({ error: 'Failed to generate alert share links' });
    }
  }

  /**
   * Generate social media posts for different platforms
   */
  static async generateSocialPosts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const shareData = req.body;
      const socialPosts = socialSharingService.generateSocialPosts(shareData);

      res.json({
        success: true,
        data: {
          posts: socialPosts
        }
      });
    } catch (error) {
      logger.error('Failed to generate social posts:', error);
      res.status(500).json({ error: 'Failed to generate social posts' });
    }
  }

  /**
   * Track social media shares
   */
  static async trackShare(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { platform, alertId } = req.body;
      const userId = req.user?.id;

      if (!platform) {
        res.status(400).json({ error: 'Platform is required' });
        return;
      }

      await socialSharingService.trackShare(platform, alertId, userId);

      logger.info(`User ${userId} shared ${alertId ? `alert ${alertId}` : 'content'} on ${platform}`);

      res.json({
        success: true,
        message: 'Share tracked successfully',
        data: {
          platform,
          alertId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to track share:', error);
      res.status(500).json({ error: 'Failed to track share' });
    }
  }

  /**
   * Get popular shared content
   */
  static async getPopularShares(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // In a real implementation, this would query analytics data
      // For now, return mock popular shares
      const popularShares = [
        {
          id: 'alert_1',
          productName: 'Pokémon TCG: Paradox Rift Elite Trainer Box',
          retailerName: 'Best Buy',
          shareCount: 156,
          platforms: ['twitter', 'facebook', 'discord'],
          lastShared: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
        },
        {
          id: 'alert_2',
          productName: 'Pokémon TCG: Scarlet & Violet Booster Pack',
          retailerName: 'Walmart',
          shareCount: 89,
          platforms: ['twitter', 'reddit', 'telegram'],
          lastShared: new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 hours ago
        },
        {
          id: 'alert_3',
          productName: 'Pokémon TCG: Obsidian Flames Collection Box',
          retailerName: 'Target',
          shareCount: 67,
          platforms: ['facebook', 'instagram', 'discord'],
          lastShared: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
        }
      ];

      res.json({
        success: true,
        data: {
          popularShares,
          totalShares: popularShares.reduce((sum, share) => sum + share.shareCount, 0),
          timeframe: '24 hours'
        }
      });
    } catch (error) {
      logger.error('Failed to get popular shares:', error);
      res.status(500).json({ error: 'Failed to retrieve popular shares' });
    }
  }

  /**
   * Get sharing statistics
   */
  static async getSharingStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const isAdmin = req.user?.role === 'admin';

      // In a real implementation, this would query analytics data
      // For now, return mock statistics
      const stats = {
        totalShares: isAdmin ? 1247 : 23,
        sharesByPlatform: {
          twitter: isAdmin ? 456 : 8,
          facebook: isAdmin ? 234 : 5,
          discord: isAdmin ? 189 : 4,
          reddit: isAdmin ? 156 : 3,
          telegram: isAdmin ? 89 : 2,
          whatsapp: isAdmin ? 67 : 1,
          linkedin: isAdmin ? 34 : 0,
          instagram: isAdmin ? 22 : 0
        },
        topSharedAlerts: [
          {
            alertId: 'alert_1',
            productName: 'Pokémon TCG: Paradox Rift Elite Trainer Box',
            shareCount: isAdmin ? 156 : 5
          },
          {
            alertId: 'alert_2',
            productName: 'Pokémon TCG: Scarlet & Violet Booster Pack',
            shareCount: isAdmin ? 89 : 3
          }
        ],
        timeframe: '30 days'
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get sharing stats:', error);
      res.status(500).json({ error: 'Failed to retrieve sharing statistics' });
    }
  }

  /**
   * Get social media platform information
   */
  static async getPlatformInfo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const platformInfo = {
        supportedPlatforms: [
          {
            id: 'twitter',
            name: 'Twitter',
            description: 'Share quick updates and alerts',
            characterLimit: 280,
            supportsImages: true,
            supportsHashtags: true,
            recommendedHashtags: 3
          },
          {
            id: 'facebook',
            name: 'Facebook',
            description: 'Share detailed posts with community',
            characterLimit: null,
            supportsImages: true,
            supportsHashtags: true,
            recommendedHashtags: 5
          },
          {
            id: 'instagram',
            name: 'Instagram',
            description: 'Visual content with hashtags',
            characterLimit: SOCIAL_MEDIA_LIMITS.INSTAGRAM_CHARACTER_LIMIT,
            supportsImages: true,
            supportsHashtags: true,
            recommendedHashtags: 10
          },
          {
            id: 'discord',
            name: 'Discord',
            description: 'Share with gaming communities',
            characterLimit: SOCIAL_MEDIA_LIMITS.DISCORD_CHARACTER_LIMIT,
            supportsImages: true,
            supportsHashtags: false,
            recommendedHashtags: 0
          },
          {
            id: 'reddit',
            name: 'Reddit',
            description: 'Share with TCG communities',
            characterLimit: null,
            supportsImages: true,
            supportsHashtags: false,
            recommendedHashtags: 0
          },
          {
            id: 'telegram',
            name: 'Telegram',
            description: 'Instant messaging and channels',
            characterLimit: SOCIAL_MEDIA_LIMITS.TELEGRAM_CHARACTER_LIMIT,
            supportsImages: true,
            supportsHashtags: true,
            recommendedHashtags: 5
          },
          {
            id: 'whatsapp',
            name: 'WhatsApp',
            description: 'Personal messaging',
            characterLimit: null,
            supportsImages: true,
            supportsHashtags: false,
            recommendedHashtags: 0
          },
          {
            id: 'linkedin',
            name: 'LinkedIn',
            description: 'Professional networking',
            characterLimit: SOCIAL_MEDIA_LIMITS.LINKEDIN_CHARACTER_LIMIT,
            supportsImages: true,
            supportsHashtags: true,
            recommendedHashtags: 3
          }
        ],
        defaultHashtags: [
          '#PokemonTCG',
          '#BoosterBeacon',
          '#PokemonCards',
          '#TCGDeals',
          '#PokemonCollector'
        ]
      };

      res.json({
        success: true,
        data: platformInfo
      });
    } catch (error) {
      logger.error('Failed to get platform info:', error);
      res.status(500).json({ error: 'Failed to retrieve platform information' });
    }
  }
}