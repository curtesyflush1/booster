import { IUser, IAlert, IProduct } from '../../types/database';

export type AlertPriority = 'low' | 'medium' | 'high' | 'urgent';
export type AlertType = 'restock' | 'price_drop' | 'low_stock' | 'pre_order';

export interface AlertGenerationData {
  userId: string;
  productId: string;
  retailerId: string;
  watchId?: string;
  type: AlertType;
  priority?: AlertPriority;
  data: {
    product_name: string;
    retailer_name: string;
    product_url: string;
    price?: number;
    original_price?: number;
    stock_level?: number;
    [key: string]: any;
  };
}

/**
 * Strategy interface for different alert processing types
 */
export interface AlertProcessingStrategy {
  /**
   * Calculate priority based on alert data and product information
   */
  calculatePriority(alertData: AlertGenerationData): Promise<AlertPriority>;

  /**
   * Determine which delivery channels to use for this alert type
   */
  determineDeliveryChannels(user: IUser, alert: IAlert): string[];

  /**
   * Validate specific requirements for this alert type
   */
  validateSpecificRequirements(alertData: AlertGenerationData): Promise<boolean>;

  /**
   * Get alert type identifier
   */
  getAlertType(): AlertType;

  /**
   * Calculate urgency score (0-100) for prioritization
   */
  calculateUrgencyScore(alertData: AlertGenerationData): Promise<number>;
}

/**
 * Base abstract class with common functionality
 */
export abstract class BaseAlertStrategy implements AlertProcessingStrategy {
  protected static readonly POPULARITY_THRESHOLD_HIGH = 500;
  protected static readonly POPULARITY_THRESHOLD_URGENT = 800;

  abstract calculatePriority(alertData: AlertGenerationData): Promise<AlertPriority>;
  abstract getAlertType(): AlertType;
  abstract calculateUrgencyScore(alertData: AlertGenerationData): Promise<number>;

  /**
   * Common delivery channel determination logic
   */
  determineDeliveryChannels(user: IUser, alert: IAlert): string[] {
    const channels: string[] = [];
    const settings = user.notification_settings;

    // Web push is always available
    if (settings.web_push) {
      channels.push('web_push');
    }

    // Email is available for all users
    if (settings.email) {
      channels.push('email');
    }

    // SMS and Discord are Pro features
    if (user.subscription_tier === 'pro') {
      if (settings.sms) {
        channels.push('sms');
      }
      if (settings.discord && settings.discord_webhook) {
        channels.push('discord');
      }
    }

    // Ensure at least one channel is available
    if (channels.length === 0 && settings.web_push !== false) {
      channels.push('web_push'); // Fallback to web push
    }

    return channels;
  }

  /**
   * Basic validation that applies to all alert types
   */
  async validateSpecificRequirements(alertData: AlertGenerationData): Promise<boolean> {
    // Basic URL validation
    if (alertData.data.product_url) {
      try {
        new URL(alertData.data.product_url);
      } catch {
        return false;
      }
    }

    // Basic required fields
    return !!(
      alertData.data.product_name?.trim() &&
      alertData.data.retailer_name?.trim() &&
      alertData.data.product_url?.trim()
    );
  }

  /**
   * Convert urgency score to priority level
   */
  protected urgencyToPriority(urgencyScore: number): AlertPriority {
    if (urgencyScore >= 90) return 'urgent';
    if (urgencyScore >= 70) return 'high';
    if (urgencyScore >= 40) return 'medium';
    return 'low';
  }

  /**
   * Get base urgency from product popularity
   */
  protected async getPopularityUrgency(productId: string): Promise<number> {
    try {
      const { Product } = await import('../../models/Product');
      const product = await Product.findById<IProduct>(productId);
      const popularityScore = product?.popularity_score || 0;

      if (popularityScore > BaseAlertStrategy.POPULARITY_THRESHOLD_URGENT) return 80;
      if (popularityScore > BaseAlertStrategy.POPULARITY_THRESHOLD_HIGH) return 60;
      return 30;
    } catch (error) {
      return 30; // Default fallback
    }
  }
}