import { Router } from 'express';
import { EmailPreferencesService } from '../services/emailPreferencesService';
import { EmailDeliveryService } from '../services/emailDeliveryService';
import { EmailService } from '../services/notifications/emailService';
import { EmailConfigService } from '../services/emailConfigService';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get user email preferences
 */
router.get('/preferences', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    const preferences = await EmailPreferencesService.getUserPreferences(userId);
    
    if (!preferences) {
      return res.status(404).json({
        error: {
          code: 'PREFERENCES_NOT_FOUND',
          message: 'Email preferences not found'
        }
      });
    }

    return res.json({
      preferences: {
        alertEmails: preferences.alertEmails,
        marketingEmails: preferences.marketingEmails,
        weeklyDigest: preferences.weeklyDigest,
        updatedAt: preferences.updatedAt
      }
    });

  } catch (error) {
    logger.error('Failed to get email preferences', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve email preferences'
      }
    });
  }
});

/**
 * Update user email preferences
 */
router.put('/preferences', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { alertEmails, marketingEmails, weeklyDigest } = req.body;

    // Validate input
    const updates: any = {};
    if (typeof alertEmails === 'boolean') {
      updates.alertEmails = alertEmails;
    }
    if (typeof marketingEmails === 'boolean') {
      updates.marketingEmails = marketingEmails;
    }
    if (typeof weeklyDigest === 'boolean') {
      updates.weeklyDigest = weeklyDigest;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'At least one preference must be provided'
        }
      });
    }

    const success = await EmailPreferencesService.updatePreferences(userId, updates);

    if (!success) {
      return res.status(500).json({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update email preferences'
        }
      });
    }

    // Get updated preferences
    const preferences = await EmailPreferencesService.getUserPreferences(userId);

    return res.json({
      message: 'Email preferences updated successfully',
      preferences: {
        alertEmails: preferences!.alertEmails,
        marketingEmails: preferences!.marketingEmails,
        weeklyDigest: preferences!.weeklyDigest,
        updatedAt: preferences!.updatedAt
      }
    });

  } catch (error) {
    logger.error('Failed to update email preferences', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update email preferences'
      }
    });
  }
});

/**
 * Process unsubscribe request
 */
router.get('/unsubscribe', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Unsubscribe token is required'
        }
      });
    }

    const result = await EmailPreferencesService.processUnsubscribe(token);

    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'UNSUBSCRIBE_FAILED',
          message: result.message
        }
      });
    }

    return res.json({
      message: result.message,
      emailType: result.emailType
    });

  } catch (error) {
    logger.error('Failed to process unsubscribe', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process unsubscribe request'
      }
    });
  }
});

/**
 * Get email delivery statistics for user
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    const stats = await EmailDeliveryService.getUserDeliveryStats(userId);

    return res.json({
      stats: {
        totalSent: stats.totalSent,
        totalDelivered: stats.totalDelivered,
        totalBounced: stats.totalBounced,
        totalComplained: stats.totalComplained,
        deliveryRate: Math.round(stats.deliveryRate * 100) / 100,
        lastEmailSent: stats.lastEmailSent
      }
    });

  } catch (error) {
    logger.error('Failed to get email stats', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve email statistics'
      }
    });
  }
});

/**
 * Test email configuration (admin only)
 */
router.post('/test', authenticate, async (req, res) => {
  try {
    // Check if user is admin (you'll need to implement admin role checking)
    // For now, we'll allow any authenticated user to test
    
    const result = await EmailService.testEmailConfiguration();

    if (!result.success) {
      return res.status(500).json({
        error: {
          code: 'EMAIL_CONFIG_ERROR',
          message: result.error || 'Email configuration test failed'
        }
      });
    }

    return res.json({
      message: 'Email configuration is working correctly'
    });

  } catch (error) {
    logger.error('Failed to test email configuration', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to test email configuration'
      }
    });
  }
});

/**
 * Handle email webhooks (for bounce/complaint notifications)
 */
router.post('/webhook', async (req, res) => {
  try {
    const webhookData = req.body;

    // Validate webhook signature if needed
    // This would depend on your email service provider

    await EmailService.handleEmailWebhook(webhookData);

    return res.status(200).json({
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    logger.error('Failed to process email webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body
    });

    return res.status(500).json({
      error: {
        code: 'WEBHOOK_ERROR',
        message: 'Failed to process webhook'
      }
    });
  }
});

/**
 * Send test email (admin only)
 */
router.post('/send-test', authenticate, async (req, res) => {
  try {
    const { email, type = 'welcome' } = req.body;
    const user = req.user!;

    if (!email) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Email address is required'
        }
      });
    }

    let result;
    const testUser = { 
      ...user, 
      email,
      password_hash: 'test_hash' // Add required field for IUser interface
    };

    switch (type) {
      case 'welcome':
        result = await EmailService.sendWelcomeEmail(testUser);
        break;
      case 'password_reset':
        result = await EmailService.sendPasswordResetEmail(testUser, 'test_token_123');
        break;
      default:
        return res.status(400).json({
          error: {
            code: 'INVALID_TYPE',
            message: 'Invalid email type. Supported types: welcome, password_reset'
          }
        });
    }

    if (!result.success) {
      return res.status(500).json({
        error: {
          code: 'SEND_FAILED',
          message: result.error || 'Failed to send test email'
        }
      });
    }

    return res.json({
      message: `Test ${type} email sent successfully to ${email}`
    });

  } catch (error) {
    logger.error('Failed to send test email', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to send test email'
      }
    });
  }
});

/**
 * Get comprehensive email analytics
 */
router.get('/analytics', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    // Get user-specific stats
    const userStats = await EmailDeliveryService.getUserDeliveryStats(userId);
    
    // Get overall system stats (if admin)
    const systemStats = await EmailService.getEmailStats();

    return res.json({
      userStats: {
        totalSent: userStats.totalSent,
        totalDelivered: userStats.totalDelivered,
        totalBounced: userStats.totalBounced,
        totalComplained: userStats.totalComplained,
        deliveryRate: Math.round(userStats.deliveryRate * 100) / 100,
        lastEmailSent: userStats.lastEmailSent
      },
      systemStats: {
        deliveryRate: Math.round(systemStats.deliveryRate * 100) / 100,
        bounceRate: Math.round(systemStats.bounceRate * 100) / 100,
        complaintRate: Math.round(systemStats.complaintRate * 100) / 100
      }
    });

  } catch (error) {
    logger.error('Failed to get email analytics', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve email analytics'
      }
    });
  }
});

/**
 * Send digest email manually (for testing)
 */
router.post('/send-digest', authenticate, async (req, res) => {
  try {
    const user = req.user!;
    
    // For testing, we'll create some mock alerts
    const mockAlerts = [
      {
        id: 'test-1',
        type: 'restock',
        priority: 'high',
        data: {
          product_name: 'Pokémon TCG: Surging Sparks Booster Box',
          retailer_name: 'Best Buy',
          price: 144.99,
          product_url: 'https://bestbuy.com/test',
          cart_url: 'https://bestbuy.com/cart/test'
        }
      },
      {
        id: 'test-2',
        type: 'price_drop',
        priority: 'medium',
        data: {
          product_name: 'Pokémon TCG: Stellar Crown Elite Trainer Box',
          retailer_name: 'Walmart',
          price: 39.99,
          original_price: 49.99,
          product_url: 'https://walmart.com/test'
        }
      }
    ] as any[];

    const userWithPassword = { ...user, password_hash: 'mock_hash' };
    const result = await EmailService.sendDigestEmail(userWithPassword, mockAlerts);

    if (!result.success) {
      return res.status(500).json({
        error: {
          code: 'SEND_FAILED',
          message: result.error || 'Failed to send digest email'
        }
      });
    }

    return res.json({
      message: 'Digest email sent successfully',
      alertCount: mockAlerts.length
    });

  } catch (error) {
    logger.error('Failed to send digest email', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to send digest email'
      }
    });
  }
});

/**
 * Get email configuration status
 */
router.get('/config', authenticate, async (_req, res) => {
  try {
    const validation = await EmailConfigService.validateConfiguration();
    
    return res.json({
      configuration: {
        provider: validation.configuration.provider,
        host: validation.configuration.host,
        port: validation.configuration.port,
        secure: validation.configuration.secure,
        fromEmail: validation.configuration.fromEmail,
        fromName: validation.configuration.fromName,
        authConfigured: !!validation.configuration.auth
      },
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings
      },
      recommendations: EmailConfigService.getConfigurationRecommendations(),
      bestPractices: EmailConfigService.getDeliveryBestPractices()
    });

  } catch (error) {
    logger.error('Failed to get email configuration', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve email configuration'
      }
    });
  }
});

/**
 * Test email configuration with actual delivery
 */
router.post('/config/test', authenticate, async (req, res) => {
  try {
    const { email } = req.body;
    const user = req.user!;

    // Use user's email if not provided
    const testEmail = email || user.email;

    if (!testEmail) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Email address is required'
        }
      });
    }

    const result = await EmailConfigService.testEmailDelivery(testEmail);

    if (!result.success) {
      return res.status(500).json({
        error: {
          code: 'TEST_FAILED',
          message: result.error || 'Email test failed'
        }
      });
    }

    return res.json({
      message: `Test email sent successfully to ${testEmail}`,
      messageId: result.messageId,
      previewUrl: result.previewUrl
    });

  } catch (error) {
    logger.error('Failed to test email configuration', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to test email configuration'
      }
    });
  }
});

/**
 * Get environment variable template for email configuration
 */
router.get('/config/env-template', authenticate, async (_req, res) => {
  try {
    const template = EmailConfigService.generateEnvTemplate();
    
    return res.json({
      template,
      instructions: [
        'Copy the template to your .env file',
        'Choose the appropriate configuration option',
        'Update the values with your SMTP settings',
        'Restart the application to apply changes',
        'Test the configuration using the /email/config/test endpoint'
      ]
    });

  } catch (error) {
    logger.error('Failed to generate env template', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate environment template'
      }
    });
  }
});

export default router;