import { logger } from '../utils/logger';
import { db } from '../config/database';
import { IEmailDeliveryStatsQueryResult } from '../types/database';

export interface EmailPreferences {
  userId: string;
  alertEmails: boolean;
  marketingEmails: boolean;
  weeklyDigest: boolean;
  unsubscribeToken: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UnsubscribeToken {
  token: string;
  userId: string;
  emailType: 'all' | 'alerts' | 'marketing' | 'digest';
  expiresAt: Date;
}

export class EmailPreferencesService {
  /**
   * Safely parse string or number to integer
   * @private
   */
  private static parseIntSafely(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Math.floor(value);
    const parsed = parseInt(value.toString(), 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  /**
   * Get user email preferences
   */
  static async getUserPreferences(userId: string): Promise<EmailPreferences | null> {
    try {
      const preferences = await db('email_preferences')
        .where({ user_id: userId })
        .first();

      if (!preferences) {
        // Create default preferences for new users
        return await this.createDefaultPreferences(userId);
      }

      return {
        userId: preferences.user_id,
        alertEmails: preferences.alert_emails,
        marketingEmails: preferences.marketing_emails,
        weeklyDigest: preferences.weekly_digest,
        unsubscribeToken: preferences.unsubscribe_token,
        createdAt: preferences.created_at,
        updatedAt: preferences.updated_at
      };
    } catch (error) {
      logger.error('Failed to get email preferences', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Update user email preferences
   */
  static async updatePreferences(
    userId: string,
    preferences: Partial<Pick<EmailPreferences, 'alertEmails' | 'marketingEmails' | 'weeklyDigest'>>
  ): Promise<boolean> {
    try {
      const updateData: any = {
        updated_at: new Date()
      };

      if (preferences.alertEmails !== undefined) {
        updateData.alert_emails = preferences.alertEmails;
      }
      if (preferences.marketingEmails !== undefined) {
        updateData.marketing_emails = preferences.marketingEmails;
      }
      if (preferences.weeklyDigest !== undefined) {
        updateData.weekly_digest = preferences.weeklyDigest;
      }

      await db('email_preferences')
        .where({ user_id: userId })
        .update(updateData);

      logger.info('Email preferences updated', {
        userId,
        preferences: updateData
      });

      return true;
    } catch (error) {
      logger.error('Failed to update email preferences', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Create default email preferences for new user
   */
  static async createDefaultPreferences(userId: string): Promise<EmailPreferences> {
    try {
      const unsubscribeToken = this.generateUnsubscribeToken();
      
      const preferences = {
        user_id: userId,
        alert_emails: true,
        marketing_emails: true,
        weekly_digest: true,
        unsubscribe_token: unsubscribeToken,
        created_at: new Date(),
        updated_at: new Date()
      };

      await db('email_preferences').insert(preferences);

      logger.info('Default email preferences created', { userId });

      return {
        userId,
        alertEmails: true,
        marketingEmails: true,
        weeklyDigest: true,
        unsubscribeToken,
        createdAt: preferences.created_at,
        updatedAt: preferences.updated_at
      };
    } catch (error) {
      logger.error('Failed to create default email preferences', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate unsubscribe token
   */
  static generateUnsubscribeToken(): string {
    return `unsub_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Create one-click unsubscribe token
   */
  static async createUnsubscribeToken(
    userId: string,
    emailType: 'all' | 'alerts' | 'marketing' | 'digest'
  ): Promise<string> {
    try {
      const token = `${emailType}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

      await db('unsubscribe_tokens').insert({
        token,
        user_id: userId,
        email_type: emailType,
        expires_at: expiresAt,
        created_at: new Date()
      });

      return token;
    } catch (error) {
      logger.error('Failed to create unsubscribe token', {
        userId,
        emailType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process unsubscribe request
   */
  static async processUnsubscribe(token: string): Promise<{
    success: boolean;
    message: string;
    userId?: string;
    emailType?: string;
  }> {
    try {
      const unsubscribeRecord = await db('unsubscribe_tokens')
        .where({ token })
        .where('expires_at', '>', new Date())
        .first();

      if (!unsubscribeRecord) {
        return {
          success: false,
          message: 'Invalid or expired unsubscribe token'
        };
      }

      const { user_id: userId, email_type: emailType } = unsubscribeRecord;

      // Update preferences based on email type
      const updateData: any = { updated_at: new Date() };
      
      switch (emailType) {
        case 'all':
          updateData.alert_emails = false;
          updateData.marketing_emails = false;
          updateData.weekly_digest = false;
          break;
        case 'alerts':
          updateData.alert_emails = false;
          break;
        case 'marketing':
          updateData.marketing_emails = false;
          break;
        case 'digest':
          updateData.weekly_digest = false;
          break;
      }

      await db('email_preferences')
        .where({ user_id: userId })
        .update(updateData);

      // Mark token as used
      await db('unsubscribe_tokens')
        .where({ token })
        .update({ used_at: new Date() });

      logger.info('User unsubscribed successfully', {
        userId,
        emailType,
        token
      });

      return {
        success: true,
        message: `Successfully unsubscribed from ${emailType} emails`,
        userId,
        emailType
      };
    } catch (error) {
      logger.error('Failed to process unsubscribe', {
        token,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        success: false,
        message: 'Failed to process unsubscribe request'
      };
    }
  }

  /**
   * Check if user can receive specific email type
   */
  static async canReceiveEmail(
    userId: string,
    emailType: 'alerts' | 'marketing' | 'digest'
  ): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId);
      
      if (!preferences) {
        return false;
      }

      switch (emailType) {
        case 'alerts':
          return preferences.alertEmails;
        case 'marketing':
          return preferences.marketingEmails;
        case 'digest':
          return preferences.weeklyDigest;
        default:
          return false;
      }
    } catch (error) {
      logger.error('Failed to check email permissions', {
        userId,
        emailType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get email delivery statistics
   */
  static async getDeliveryStats(userId?: string): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalBounced: number;
    totalComplained: number;
    deliveryRate: number;
    bounceRate: number;
    complaintRate: number;
  }> {
    try {
      let query = db('email_delivery_logs');
      
      if (userId) {
        query = query.where({ user_id: userId });
      }

      const stats = await query
        .select(
          db.raw('COUNT(*) as total_sent'),
          db.raw('SUM(CASE WHEN delivered_at IS NOT NULL THEN 1 ELSE 0 END) as total_delivered'),
          db.raw('SUM(CASE WHEN bounced_at IS NOT NULL THEN 1 ELSE 0 END) as total_bounced'),
          db.raw('SUM(CASE WHEN complained_at IS NOT NULL THEN 1 ELSE 0 END) as total_complained')
        )
        .first() as unknown as IEmailDeliveryStatsQueryResult | undefined;

      const totalSent = this.parseIntSafely(stats?.total_sent);
      const totalDelivered = this.parseIntSafely(stats?.total_delivered);
      const totalBounced = this.parseIntSafely(stats?.total_bounced);
      const totalComplained = this.parseIntSafely(stats?.total_complained);

      return {
        totalSent,
        totalDelivered,
        totalBounced,
        totalComplained,
        deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
        bounceRate: totalSent > 0 ? (totalBounced / totalSent) * 100 : 0,
        complaintRate: totalSent > 0 ? (totalComplained / totalSent) * 100 : 0
      };
    } catch (error) {
      logger.error('Failed to get delivery stats', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        totalSent: 0,
        totalDelivered: 0,
        totalBounced: 0,
        totalComplained: 0,
        deliveryRate: 0,
        bounceRate: 0,
        complaintRate: 0
      };
    }
  }
}