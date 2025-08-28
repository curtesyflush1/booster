import { IAlert, IUser } from '../../types/database';
import { logger } from '../../utils/logger';
import { ChannelDeliveryResult } from '../alertDeliveryService';
import { HTTP_TIMEOUTS, INTERVALS } from '../../constants';

export interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  thumbnail?: {
    url: string;
  };
  image?: {
    url: string;
  };
  fields: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer: {
    text: string;
    icon_url?: string;
  };
  timestamp: string;
  url?: string;
}

export interface DiscordMessage {
  content?: string;
  embeds: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

export class DiscordService {
  // Note: DISCORD_BOT_TOKEN reserved for future bot integration
  // private static readonly DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  private static readonly DISCORD_WEBHOOK_TIMEOUT = HTTP_TIMEOUTS.DISCORD_WEBHOOK;

  /**
   * Send Discord alert
   */
  static async sendAlert(alert: IAlert, user: IUser): Promise<ChannelDeliveryResult> {
    try {
      logger.debug('Sending Discord alert', {
        alertId: alert.id,
        userId: user.id
      });

      // Check if Discord is available for user
      if (user.subscription_tier !== 'pro') {
        return {
          channel: 'discord',
          success: false,
          error: 'Discord alerts require Pro subscription'
        };
      }

      // Check if user has Discord enabled
      if (!user.notification_settings.discord) {
        return {
          channel: 'discord',
          success: false,
          error: 'User has disabled Discord notifications'
        };
      }

      // Get user's Discord webhook URL
      const webhookUrl = user.notification_settings.discord_webhook;
      if (!webhookUrl) {
        return {
          channel: 'discord',
          success: false,
          error: 'No Discord webhook configured'
        };
      }

      // Validate webhook URL
      if (!this.isValidWebhookUrl(webhookUrl)) {
        return {
          channel: 'discord',
          success: false,
          error: 'Invalid Discord webhook URL'
        };
      }

      // Generate Discord message
      const message = this.generateDiscordMessage(alert);

      // Send Discord message
      const result = await this.sendWebhookMessage(webhookUrl, message);

      if (result.success) {
        logger.info('Discord alert sent successfully', {
          alertId: alert.id,
          userId: user.id,
          messageId: result.messageId
        });

        return {
          channel: 'discord',
          success: true,
          externalId: result.messageId!,
          metadata: {
            messageId: result.messageId!,
            webhookUrl: this.maskWebhookUrl(webhookUrl),
            embedCount: message.embeds.length
          }
        };
      } else {
        return {
          channel: 'discord',
          success: false,
          error: result.error!
        };
      }

    } catch (error) {
      logger.error('Discord alert failed', {
        alertId: alert.id,
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        channel: 'discord',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate Discord message from alert
   */
  private static generateDiscordMessage(alert: IAlert): DiscordMessage {
    const data = alert.data;
    const productName = data.product_name;
    const retailerName = data.retailer_name;
    const price = data.price ? `$${data.price.toFixed(2)}` : 'Price not available';
    const originalPrice = data.original_price ? `$${data.original_price.toFixed(2)}` : null;

    let title: string;
    let description: string;
    let color: number;
    let emoji: string;

    switch (alert.type) {
      case 'restock':
        emoji = '🔥';
        title = `${emoji} Product Back in Stock!`;
        description = `**${productName}** is now available at **${retailerName}**`;
        color = 0x4CAF50; // Green
        break;
      case 'price_drop':
        emoji = '💰';
        title = `${emoji} Price Drop Alert!`;
        description = `**${productName}** price has dropped at **${retailerName}**`;
        color = 0xFF9800; // Orange
        break;
      case 'low_stock':
        emoji = '⚡';
        title = `${emoji} Low Stock Alert!`;
        description = `**${productName}** is running low at **${retailerName}** - Act fast!`;
        color = 0xF44336; // Red
        break;
      case 'pre_order':
        emoji = '🎯';
        title = `${emoji} Pre-Order Available!`;
        description = `**${productName}** pre-orders are now open at **${retailerName}**`;
        color = 0x2196F3; // Blue
        break;
      default:
        emoji = '📦';
        title = `${emoji} Product Update`;
        description = `Update for **${productName}** at **${retailerName}**`;
        color = 0x9E9E9E; // Grey
    }

    const embed: DiscordEmbed = {
      title,
      description,
      color,
      fields: [
        {
          name: '🏪 Retailer',
          value: retailerName,
          inline: true
        },
        {
          name: '💵 Price',
          value: price,
          inline: true
        },
        {
          name: '⚡ Priority',
          value: this.formatPriority(alert.priority),
          inline: true
        }
      ],
      footer: {
        text: 'BoosterBeacon Alert',
        icon_url: 'https://boosterbeacon.com/icons/logo-32.png'
      },
      timestamp: new Date().toISOString()
    };

    // Add original price if it's a price drop
    if (alert.type === 'price_drop' && originalPrice) {
      embed.fields.push({
        name: '📉 Original Price',
        value: originalPrice,
        inline: true
      });

      if (data.price && data.original_price) {
        const savings = data.original_price - data.price;
        const savingsPercent = Math.round((savings / data.original_price) * 100);
        embed.fields.push({
          name: '💸 You Save',
          value: `$${savings.toFixed(2)} (${savingsPercent}%)`,
          inline: true
        });
      }
    }

    // Add stock level if available
    if (data.stock_level) {
      embed.fields.push({
        name: '📦 Stock Level',
        value: data.stock_level.toString(),
        inline: true
      });
    }

    // Add store locations for in-store availability
    if (data.store_locations && data.store_locations.length > 0) {
      const storeList = data.store_locations
        .slice(0, 3) // Limit to first 3 stores
        .map(store => `• ${store.store_name} (${store.city}, ${store.state})`)
        .join('\n');
      
      embed.fields.push({
        name: '🏬 Available Stores',
        value: storeList + (data.store_locations.length > 3 ? `\n...and ${data.store_locations.length - 3} more` : ''),
        inline: false
      });
    }

    // Add product URL as embed URL if available
    if (data.product_url) {
      embed.url = data.product_url;
    }

    // Create content with action buttons simulation
    let content = '';
    if (data.cart_url) {
      content += `🛒 **[Add to Cart](${data.cart_url})**`;
    }
    if (data.product_url && data.product_url !== data.cart_url) {
      content += content ? ' • ' : '';
      content += `👀 **[View Product](${data.product_url})**`;
    }

    const message: DiscordMessage = {
      embeds: [embed],
      username: 'BoosterBeacon',
      avatar_url: 'https://boosterbeacon.com/icons/logo-64.png'
    };

    if (content) {
      message.content = content;
    }

    return message;
  }

  /**
   * Format priority for display
   */
  private static formatPriority(priority: string): string {
    switch (priority) {
      case 'urgent': return '🚨 URGENT';
      case 'high': return '🔴 HIGH';
      case 'medium': return '🟡 MEDIUM';
      case 'low': return '🟢 LOW';
      default: return priority.toUpperCase();
    }
  }

  /**
   * Send message to Discord webhook
   */
  private static async sendWebhookMessage(webhookUrl: string, message: DiscordMessage): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      logger.debug('Sending Discord webhook message', {
        webhookUrl: this.maskWebhookUrl(webhookUrl),
        embedCount: message.embeds.length
      });

      // In a real implementation, this would use fetch or axios to send HTTP POST
      // For now, we'll simulate the sending
      
      // Simulate potential failures
      if (Math.random() < 0.02) { // 2% failure rate
        throw new Error('Discord webhook service unavailable');
      }

      // Simulate invalid webhook
      if (webhookUrl.includes('invalid')) {
        const error = new Error('Invalid webhook URL');
        (error as any).status = 404;
        throw error;
      }

      // Simulate rate limiting
      if (Math.random() < 0.01) { // 1% rate limit
        const error = new Error('Rate limited by Discord');
        (error as any).status = 429;
        throw error;
      }

      // Simulate successful send
      await new Promise(resolve => setTimeout(resolve, INTERVALS.DISCORD_SIMULATION_DELAY));
      const messageId = `discord-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      logger.debug('Discord webhook message sent successfully', {
        webhookUrl: this.maskWebhookUrl(webhookUrl),
        messageId
      });

      return {
        success: true,
        messageId
      };

    } catch (error) {
      logger.error('Failed to send Discord webhook message', {
        webhookUrl: this.maskWebhookUrl(webhookUrl),
        error: error instanceof Error ? error.message : 'Unknown error',
        status: (error as any)?.status
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate Discord webhook URL
   */
  private static isValidWebhookUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname === 'discord.com' || 
             parsedUrl.hostname === 'discordapp.com';
    } catch {
      return false;
    }
  }

  /**
   * Mask webhook URL for logging
   */
  private static maskWebhookUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      const pathParts = parsedUrl.pathname.split('/');
      if (pathParts.length >= 4) {
        // Mask the webhook token (last part of the path)
        pathParts[pathParts.length - 1] = '***';
        return `${parsedUrl.protocol}//${parsedUrl.hostname}${pathParts.join('/')}`;
      }
      return url.substring(0, 30) + '***';
    } catch {
      return url.substring(0, 30) + '***';
    }
  }

  /**
   * Test Discord webhook
   */
  static async testWebhook(webhookUrl: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!this.isValidWebhookUrl(webhookUrl)) {
        return {
          success: false,
          error: 'Invalid Discord webhook URL'
        };
      }

      const testMessage: DiscordMessage = {
        embeds: [{
          title: '🧪 BoosterBeacon Test',
          description: 'Your Discord alerts are working perfectly!',
          color: 0x4CAF50,
          fields: [
            {
              name: '✅ Status',
              value: 'Connection successful',
              inline: true
            },
            {
              name: '🕐 Time',
              value: new Date().toLocaleString(),
              inline: true
            }
          ],
          footer: {
            text: 'BoosterBeacon Test Message'
          },
          timestamp: new Date().toISOString()
        }],
        username: 'BoosterBeacon',
        avatar_url: 'https://boosterbeacon.com/icons/logo-64.png'
      };

      const result = await this.sendWebhookMessage(webhookUrl, testMessage);
      if (result.success) {
        return { success: true };
      } else {
        return { success: false, error: result.error! };
      }

    } catch (error) {
      logger.error('Failed to test Discord webhook', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send bulk alerts to Discord channel
   */
  static async sendBulkAlerts(
    webhookUrl: string,
    alerts: IAlert[]
  ): Promise<{
    success: boolean;
    sentCount: number;
    failedCount: number;
    error?: string;
  }> {
    try {
      if (alerts.length === 0) {
        return { success: true, sentCount: 0, failedCount: 0 };
      }

      // Group alerts by product to avoid spam
      const groupedAlerts = this.groupAlertsByProduct(alerts);
      let sentCount = 0;
      let failedCount = 0;

      for (const group of groupedAlerts) {
        try {
          const message = this.generateBulkDiscordMessage(group);
          const result = await this.sendWebhookMessage(webhookUrl, message);
          
          if (result.success) {
            sentCount += group.length;
          } else {
            failedCount += group.length;
          }

          // Rate limiting: wait between messages
          await new Promise(resolve => setTimeout(resolve, INTERVALS.DISCORD_RATE_LIMIT_DELAY));

        } catch (error) {
          failedCount += group.length;
          logger.error('Failed to send bulk Discord alert', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return {
        success: sentCount > 0,
        sentCount,
        failedCount
      };

    } catch (error) {
      logger.error('Failed to send bulk Discord alerts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        sentCount: 0,
        failedCount: alerts.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Group alerts by product to reduce spam
   */
  private static groupAlertsByProduct(alerts: IAlert[]): IAlert[][] {
    const groups = new Map<string, IAlert[]>();
    
    for (const alert of alerts) {
      const key = `${alert.product_id}-${alert.type}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(alert);
    }

    return Array.from(groups.values());
  }

  /**
   * Generate bulk Discord message
   */
  private static generateBulkDiscordMessage(alerts: IAlert[]): DiscordMessage {
    if (alerts.length === 1 && alerts[0]) {
      // Use regular message format for single alert
      return this.generateDiscordMessage(alerts[0]);
    }

    // Create summary message for multiple alerts
    const firstAlert = alerts[0];
    if (!firstAlert) {
      throw new Error('No alerts provided for bulk message');
    }
    const productName = firstAlert.data.product_name;
    const alertType = firstAlert.type;

    const embed: DiscordEmbed = {
      title: `📦 Multiple ${alertType.replace('_', ' ')} alerts for ${productName}`,
      description: `Found at ${alerts.length} retailer${alerts.length > 1 ? 's' : ''}`,
      color: 0x2196F3,
      fields: alerts.map(alert => ({
        name: alert.data.retailer_name,
        value: alert.data.price ? `$${alert.data.price.toFixed(2)}` : 'Price not available',
        inline: true
      })),
      footer: {
        text: 'BoosterBeacon Bulk Alert'
      },
      timestamp: new Date().toISOString()
    };

    return {
      embeds: [embed],
      username: 'BoosterBeacon',
      avatar_url: 'https://boosterbeacon.com/icons/logo-64.png'
    };
  }

  /**
   * Get Discord delivery statistics
   */
  static async getDiscordStats(): Promise<{
    messagesSent: number;
    messagesDelivered: number;
    messagesFailed: number;
    deliveryRate: number;
    avgResponseTime: number;
  }> {
    // In a real implementation, this would query delivery statistics
    return {
      messagesSent: 0,
      messagesDelivered: 0,
      messagesFailed: 0,
      deliveryRate: 0,
      avgResponseTime: 0
    };
  }
}