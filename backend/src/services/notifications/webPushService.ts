import webpush from 'web-push';
import { IAlert, IUser } from '../../types/database';
import { logger } from '../../utils/logger';
import { ChannelDeliveryResult } from '../alertDeliveryService';
import { User } from '../../models/User';

export interface WebPushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data: {
    alertId: string;
    productId: string;
    retailerId: string;
    productUrl: string;
    cartUrl?: string;
    timestamp: number;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  tag?: string;
  renotify?: boolean;
}

export interface PushSubscription {
  id?: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt?: Date;
  lastUsed?: Date;
}

export class WebPushService {
  private static get VAPID_PUBLIC_KEY() {
    return process.env.VAPID_PUBLIC_KEY;
  }
  
  private static get VAPID_PRIVATE_KEY() {
    return process.env.VAPID_PRIVATE_KEY;
  }
  
  private static get VAPID_SUBJECT() {
    return process.env.VAPID_SUBJECT || 'mailto:admin@boosterbeacon.com';
  }
  
  /**
   * Initialize VAPID keys
   */
  private static initializeVapid(): void {
    if (this.VAPID_PUBLIC_KEY && this.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        this.VAPID_SUBJECT,
        this.VAPID_PUBLIC_KEY,
        this.VAPID_PRIVATE_KEY
      );
    }
  }

  /**
   * Send web push notification for alert
   */
  static async sendNotification(alert: IAlert, user: IUser): Promise<ChannelDeliveryResult> {
    try {
      logger.debug('Sending web push notification', {
        alertId: alert.id,
        userId: user.id
      });

      // Check if web push is configured
      if (!this.VAPID_PUBLIC_KEY || !this.VAPID_PRIVATE_KEY) {
        logger.warn('VAPID keys not configured for web push');
        return {
          channel: 'web_push',
          success: false,
          error: 'Web push not configured'
        };
      }

      // Initialize VAPID keys
      this.initializeVapid();

      // Get user's push subscriptions from the user object directly
      const subscriptions = user.push_subscriptions || [];
      if (subscriptions.length === 0) {
        return {
          channel: 'web_push',
          success: false,
          error: 'No push subscriptions found for user'
        };
      }

      // Create notification payload
      const payload = this.createNotificationPayload(alert);

      // Send to all user subscriptions
      const results = await Promise.allSettled(
        subscriptions.map(subscription =>
          this.sendToSubscription(subscription, payload)
        )
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.length - successCount;

      // Clean up invalid subscriptions
      const invalidSubscriptions = results
        .map((result, index) => ({ result, subscription: subscriptions[index] }))
        .filter(({ result }) =>
          result.status === 'rejected' &&
          this.isInvalidSubscriptionError(result.reason)
        )
        .map(({ subscription }) => subscription)
        .filter((sub): sub is PushSubscription => sub !== undefined);

      if (invalidSubscriptions.length > 0) {
        await this.removeInvalidSubscriptions(user.id, invalidSubscriptions);
      }

      if (successCount === 0) {
        return {
          channel: 'web_push',
          success: false,
          error: `Failed to send to all ${subscriptions.length} subscriptions`
        };
      }

      logger.info('Web push notification sent', {
        alertId: alert.id,
        userId: user.id,
        successCount,
        failureCount
      });

      return {
        channel: 'web_push',
        success: true,
        metadata: {
          subscriptionsSent: successCount,
          subscriptionsFailed: failureCount,
          totalSubscriptions: subscriptions.length
        }
      };

    } catch (error) {
      logger.error('Web push notification failed', {
        alertId: alert.id,
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        channel: 'web_push',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create notification payload from alert
   */
  private static createNotificationPayload(alert: IAlert): WebPushPayload {
    const data = alert.data;
    const productName = data.product_name;
    const retailerName = data.retailer_name;
    const price = data.price ? `$${data.price.toFixed(2)}` : '';

    let title: string;
    let body: string;

    switch (alert.type) {
      case 'restock':
        title = `🔥 ${productName} Back in Stock!`;
        body = `Available now at ${retailerName}${price ? ` for ${price}` : ''}`;
        break;
      case 'price_drop':
        title = `💰 Price Drop: ${productName}`;
        body = `Now ${price} at ${retailerName}${data.original_price ? ` (was $${data.original_price.toFixed(2)})` : ''}`;
        break;
      case 'low_stock':
        title = `⚡ Low Stock Alert: ${productName}`;
        body = `Hurry! Limited stock at ${retailerName}${price ? ` - ${price}` : ''}`;
        break;
      case 'pre_order':
        title = `🎯 Pre-Order Available: ${productName}`;
        body = `Pre-order now at ${retailerName}${price ? ` for ${price}` : ''}`;
        break;
      default:
        title = `📦 ${productName}`;
        body = `Update from ${retailerName}`;
    }

    const payload: WebPushPayload = {
      title,
      body,
      icon: '/icons/notification-icon-192.png',
      badge: '/icons/badge-72.png',
      ...(data.product_url ? {} : { image: '/icons/product-placeholder.png' }),
      data: {
        alertId: alert.id,
        productId: alert.product_id,
        retailerId: alert.retailer_id,
        productUrl: data.product_url,
        ...(data.cart_url && { cartUrl: data.cart_url }),
        timestamp: Date.now()
      },
      actions: [
        {
          action: 'view',
          title: '👀 View Product',
          icon: '/icons/view-icon.png'
        }
      ],
      requireInteraction: alert.priority === 'urgent',
      tag: `alert-${alert.product_id}-${alert.retailer_id}`,
      renotify: true
    };

    // Add cart action if cart URL is available
    if (data.cart_url) {
      payload.actions!.unshift({
        action: 'cart',
        title: '🛒 Add to Cart',
        icon: '/icons/cart-icon.png'
      });
    }

    return payload;
  }

  /**
   * Send notification to a specific subscription
   */
  private static async sendToSubscription(
    subscription: PushSubscription,
    payload: WebPushPayload
  ): Promise<void> {
    try {
      logger.debug('Sending to push subscription', {
        endpoint: subscription.endpoint.substring(0, 50) + '...'
      });

      const result = await webpush.sendNotification(
        subscription,
        JSON.stringify(payload),
        {
          TTL: 24 * 60 * 60, // 24 hours
          urgency: 'high',
          topic: payload.tag
        }
      );

      logger.debug('Push notification sent successfully', {
        endpoint: subscription.endpoint.substring(0, 50) + '...',
        statusCode: result.statusCode
      });

    } catch (error: any) {
      logger.error('Failed to send push notification', {
        endpoint: subscription.endpoint.substring(0, 50) + '...',
        error: error.message,
        statusCode: error.statusCode
      });

      // Re-throw with status code for proper error handling
      const pushError = new Error(error.message);
      (pushError as any).statusCode = error.statusCode;
      throw pushError;
    }
  }

  /**
   * Get user's push subscriptions from database
   */
  static async getUserPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    try {
      const user = await User.findById<IUser>(userId);
      if (!user || !user.push_subscriptions) {
        return [];
      }

      // Filter out expired or invalid subscriptions
      const validSubscriptions = user.push_subscriptions.filter((sub: any) => {
        return sub.endpoint && sub.keys && sub.keys.p256dh && sub.keys.auth;
      });

      return validSubscriptions;
    } catch (error) {
      logger.error('Failed to get user push subscriptions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Remove invalid subscriptions from database
   */
  private static async removeInvalidSubscriptions(
    userId: string,
    subscriptions: PushSubscription[]
  ): Promise<void> {
    try {
      logger.info('Removing invalid push subscriptions', {
        userId,
        count: subscriptions.length
      });

      const user = await User.findById<IUser>(userId);
      if (!user || !user.push_subscriptions) {
        return;
      }

      // Remove invalid subscriptions by endpoint
      const invalidEndpoints = subscriptions.map(sub => sub.endpoint);
      const validSubscriptions = user.push_subscriptions.filter((sub: any) => 
        !invalidEndpoints.includes(sub.endpoint)
      );

      await User.updateById<IUser>(userId, {
        push_subscriptions: validSubscriptions
      });

      logger.info('Invalid push subscriptions removed', {
        userId,
        removedCount: subscriptions.length,
        remainingCount: validSubscriptions.length
      });

    } catch (error) {
      logger.error('Failed to remove invalid push subscriptions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Check if error indicates invalid subscription
   */
  private static isInvalidSubscriptionError(error: any): boolean {
    return error?.statusCode === 410 || // Gone
      error?.statusCode === 404 || // Not Found
      error?.message?.includes('invalid') ||
      error?.message?.includes('expired');
  }

  /**
   * Subscribe user to push notifications
   */
  static async subscribe(userId: string, subscription: PushSubscription): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      logger.info('Subscribing user to push notifications', {
        userId,
        endpoint: subscription.endpoint.substring(0, 50) + '...'
      });

      // Validate subscription
      if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
        return {
          success: false,
          error: 'Invalid subscription format'
        };
      }

      const user = await User.findById<IUser>(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get existing subscriptions
      const existingSubscriptions = user.push_subscriptions || [];
      
      // Check if subscription already exists
      const existingIndex = existingSubscriptions.findIndex((sub: any) => 
        sub.endpoint === subscription.endpoint
      );

      const subscriptionWithMetadata = {
        ...subscription,
        id: subscription.id || require('crypto').randomUUID(),
        createdAt: new Date(),
        lastUsed: new Date()
      };

      let updatedSubscriptions;
      if (existingIndex >= 0) {
        // Update existing subscription
        updatedSubscriptions = [...existingSubscriptions];
        updatedSubscriptions[existingIndex] = {
          ...existingSubscriptions[existingIndex],
          ...subscriptionWithMetadata,
          lastUsed: new Date()
        };
        logger.info('Updated existing push subscription', { userId, endpoint: subscription.endpoint.substring(0, 50) + '...' });
      } else {
        // Add new subscription
        updatedSubscriptions = [...existingSubscriptions, subscriptionWithMetadata];
        logger.info('Added new push subscription', { userId, endpoint: subscription.endpoint.substring(0, 50) + '...' });
      }

      // Save to database
      await User.updateById<IUser>(userId, {
        push_subscriptions: updatedSubscriptions
      });

      logger.info('Push subscription saved', { 
        userId, 
        totalSubscriptions: updatedSubscriptions.length 
      });

      return { success: true };

    } catch (error) {
      logger.error('Failed to subscribe to push notifications', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Unsubscribe user from push notifications
   */
  static async unsubscribe(userId: string, endpoint: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      logger.info('Unsubscribing user from push notifications', {
        userId,
        endpoint: endpoint.substring(0, 50) + '...'
      });

      const user = await User.findById<IUser>(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const existingSubscriptions = user.push_subscriptions || [];
      if (existingSubscriptions.length === 0) {
        return {
          success: false,
          error: 'No subscriptions found'
        };
      }

      // Remove subscription by endpoint
      const updatedSubscriptions = existingSubscriptions.filter((sub: any) => 
        sub.endpoint !== endpoint
      );

      if (updatedSubscriptions.length === existingSubscriptions.length) {
        return {
          success: false,
          error: 'Subscription not found'
        };
      }

      await User.updateById<IUser>(userId, {
        push_subscriptions: updatedSubscriptions
      });

      logger.info('Push subscription removed', { 
        userId, 
        remainingSubscriptions: updatedSubscriptions.length 
      });

      return { success: true };

    } catch (error) {
      logger.error('Failed to unsubscribe from push notifications', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send test notification to user
   */
  static async sendTestNotification(userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const subscriptions = await this.getUserPushSubscriptions(userId);
      if (subscriptions.length === 0) {
        return {
          success: false,
          error: 'No push subscriptions found'
        };
      }

      const testPayload: WebPushPayload = {
        title: '🧪 BoosterBeacon Test',
        body: 'Your notifications are working perfectly!',
        icon: '/icons/notification-icon-192.png',
        data: {
          alertId: 'test',
          productId: 'test',
          retailerId: 'test',
          productUrl: 'https://boosterbeacon.com',
          timestamp: Date.now()
        },
        tag: 'test-notification'
      };

      await Promise.all(
        subscriptions.map(subscription =>
          this.sendToSubscription(subscription, testPayload)
        )
      );

      return { success: true };

    } catch (error) {
      logger.error('Failed to send test notification', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get push notification statistics for user
   */
  static async getUserPushStats(userId: string): Promise<{
    subscriptionCount: number;
    notificationsSent: number;
    lastNotificationSent?: Date;
  }> {
    try {
      const subscriptions = await this.getUserPushSubscriptions(userId);

      // In a real implementation, this would query delivery statistics
      const result: {
        subscriptionCount: number;
        notificationsSent: number;
        lastNotificationSent?: Date;
      } = {
        subscriptionCount: subscriptions.length,
        notificationsSent: 0
      };

      return result;

    } catch (error) {
      logger.error('Failed to get push stats', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        subscriptionCount: 0,
        notificationsSent: 0
      };
    }
  }
}