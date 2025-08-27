import { IAlert, IUser } from '../../types/database';
import { logger } from '../../utils/logger';
import { ChannelDeliveryResult } from '../alertDeliveryService';

export interface SMSMessage {
  to: string;
  body: string;
  from?: string;
  mediaUrl?: string[];
}

export class SMSService {
  private static readonly TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  private static readonly TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  private static readonly TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+1234567890';
  private static readonly MAX_SMS_LENGTH = 160;

  /**
   * Send SMS alert
   */
  static async sendAlert(alert: IAlert, user: IUser): Promise<ChannelDeliveryResult> {
    try {
      logger.debug('Sending SMS alert', {
        alertId: alert.id,
        userId: user.id
      });

      // Check if SMS is available for user
      if (user.subscription_tier !== 'pro') {
        return {
          channel: 'sms',
          success: false,
          error: 'SMS alerts require Pro subscription'
        };
      }

      // Check if user has SMS enabled
      if (!user.notification_settings.sms) {
        return {
          channel: 'sms',
          success: false,
          error: 'User has disabled SMS notifications'
        };
      }

      // Get user's phone number (would be stored in user profile)
      const phoneNumber = await this.getUserPhoneNumber(user.id);
      if (!phoneNumber) {
        return {
          channel: 'sms',
          success: false,
          error: 'No phone number configured for user'
        };
      }

      // Validate phone number format
      if (!this.isValidPhoneNumber(phoneNumber)) {
        return {
          channel: 'sms',
          success: false,
          error: 'Invalid phone number format'
        };
      }

      // Generate SMS message
      const message = this.generateSMSMessage(alert);

      // Send SMS
      const result = await this.sendSMS({
        to: phoneNumber,
        body: message,
        from: this.TWILIO_PHONE_NUMBER
      });

      if (result.success) {
        logger.info('SMS alert sent successfully', {
          alertId: alert.id,
          userId: user.id,
          messageId: result.messageId
        });

        return {
          channel: 'sms',
          success: true,
          externalId: result.messageId || 'unknown',
          metadata: {
            messageId: result.messageId || 'unknown',
            phoneNumber: this.maskPhoneNumber(phoneNumber),
            messageLength: message.length
          }
        };
      } else {
        return {
          channel: 'sms',
          success: false,
          error: result.error || 'SMS delivery failed'
        };
      }

    } catch (error) {
      logger.error('SMS alert failed', {
        alertId: alert.id,
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        channel: 'sms',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate SMS message from alert
   */
  private static generateSMSMessage(alert: IAlert): string {
    const data = alert.data;
    const productName = this.truncateProductName(data.product_name);
    const retailerName = data.retailer_name;
    const price = data.price ? `$${data.price.toFixed(2)}` : '';

    let message: string;
    let emoji: string;

    switch (alert.type) {
      case 'restock':
        emoji = '🔥';
        message = `${emoji} ${productName} back in stock at ${retailerName}${price ? ` - ${price}` : ''}!`;
        break;
      case 'price_drop':
        emoji = '💰';
        const originalPrice = data.original_price ? ` (was $${data.original_price.toFixed(2)})` : '';
        message = `${emoji} Price drop: ${productName} now ${price}${originalPrice} at ${retailerName}`;
        break;
      case 'low_stock':
        emoji = '⚡';
        message = `${emoji} LOW STOCK: ${productName} at ${retailerName}${price ? ` - ${price}` : ''}. Hurry!`;
        break;
      case 'pre_order':
        emoji = '🎯';
        message = `${emoji} Pre-order: ${productName} available at ${retailerName}${price ? ` - ${price}` : ''}`;
        break;
      default:
        emoji = '📦';
        message = `${emoji} Update: ${productName} at ${retailerName}`;
    }

    // Add cart link if available and message is short enough
    if (data.cart_url && message.length < this.MAX_SMS_LENGTH - 30) {
      message += ` ${data.cart_url}`;
    } else if (data.product_url && message.length < this.MAX_SMS_LENGTH - 30) {
      message += ` ${data.product_url}`;
    }

    // Ensure message fits within SMS length limit
    if (message.length > this.MAX_SMS_LENGTH) {
      const urlMatch = message.match(/(https?:\/\/[^\s]+)$/);
      const url = urlMatch ? urlMatch[1] : '';
      const baseMessage = message.replace(/(https?:\/\/[^\s]+)$/, '').trim();

      if (url) {
        const availableLength = this.MAX_SMS_LENGTH - url.length - 1; // -1 for space
        if (availableLength > 20) {
          message = baseMessage.substring(0, availableLength - 3) + '...' + ` ${url}`;
        } else {
          message = baseMessage.substring(0, this.MAX_SMS_LENGTH - 3) + '...';
        }
      } else {
        message = baseMessage.substring(0, this.MAX_SMS_LENGTH - 3) + '...';
      }
    }

    return message;
  }

  /**
   * Truncate product name for SMS
   */
  private static truncateProductName(productName: string, maxLength: number = 40): string {
    if (productName.length <= maxLength) {
      return productName;
    }
    return productName.substring(0, maxLength - 3) + '...';
  }

  /**
   * Send SMS using Twilio (simulated)
   */
  private static async sendSMS(message: SMSMessage): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      logger.debug('Sending SMS via Twilio', {
        to: this.maskPhoneNumber(message.to),
        bodyLength: message.body.length
      });

      // Check if Twilio is configured
      if (!this.TWILIO_ACCOUNT_SID || !this.TWILIO_AUTH_TOKEN) {
        throw new Error('Twilio credentials not configured');
      }

      // In a real implementation, this would use Twilio SDK
      // For now, we'll simulate the sending

      // Simulate potential failures
      if (Math.random() < 0.03) { // 3% failure rate
        throw new Error('SMS service temporarily unavailable');
      }

      // Simulate invalid phone number
      if (message.to.includes('invalid')) {
        throw new Error('Invalid phone number');
      }

      // Simulate successful send
      await new Promise(resolve => setTimeout(resolve, 300));
      const messageId = `twilio-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      logger.debug('SMS sent successfully', {
        to: this.maskPhoneNumber(message.to),
        messageId
      });

      return {
        success: true,
        messageId
      };

    } catch (error) {
      logger.error('Failed to send SMS', {
        to: this.maskPhoneNumber(message.to),
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user's phone number from profile
   */
  private static async getUserPhoneNumber(userId: string): Promise<string | null> {
    // In a real implementation, this would query the user's profile
    // For now, we'll return a mock phone number
    return '+1234567890';
  }

  /**
   * Validate phone number format
   */
  private static isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic E.164 format validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Mask phone number for logging
   */
  private static maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length < 4) return '***';
    return phoneNumber.substring(0, 3) + '***' + phoneNumber.substring(phoneNumber.length - 4);
  }

  /**
   * Add phone number to user profile
   */
  static async addPhoneNumber(userId: string, phoneNumber: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Validate phone number
      if (!this.isValidPhoneNumber(phoneNumber)) {
        return {
          success: false,
          error: 'Invalid phone number format. Please use E.164 format (e.g., +1234567890)'
        };
      }

      // In a real implementation, this would:
      // 1. Save phone number to user profile
      // 2. Send verification SMS
      // 3. Mark as unverified until user confirms

      logger.info('Phone number added for user', {
        userId,
        phoneNumber: this.maskPhoneNumber(phoneNumber)
      });

      return { success: true };

    } catch (error) {
      logger.error('Failed to add phone number', {
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
   * Send verification SMS
   */
  static async sendVerificationSMS(userId: string, phoneNumber: string): Promise<{
    success: boolean;
    verificationCode?: string;
    error?: string;
  }> {
    try {
      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      const message = `Your BoosterBeacon verification code is: ${verificationCode}. This code expires in 10 minutes.`;

      const result = await this.sendSMS({
        to: phoneNumber,
        body: message,
        from: this.TWILIO_PHONE_NUMBER
      });

      if (result.success) {
        // In a real implementation, this would store the verification code
        // with expiration time in the database

        logger.info('Verification SMS sent', {
          userId,
          phoneNumber: this.maskPhoneNumber(phoneNumber)
        });

        return {
          success: true,
          verificationCode // In production, this wouldn't be returned
        };
      } else {
        return {
          success: false,
          error: result.error || 'SMS delivery failed'
        };
      }

    } catch (error) {
      logger.error('Failed to send verification SMS', {
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
   * Verify phone number with code
   */
  static async verifyPhoneNumber(userId: string, code: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // In a real implementation, this would:
      // 1. Check if code matches stored verification code
      // 2. Check if code hasn't expired
      // 3. Mark phone number as verified
      // 4. Clean up verification code

      logger.info('Phone number verified', { userId });

      return { success: true };

    } catch (error) {
      logger.error('Failed to verify phone number', {
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
   * Send test SMS to user
   */
  static async sendTestSMS(userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const phoneNumber = await this.getUserPhoneNumber(userId);
      if (!phoneNumber) {
        return {
          success: false,
          error: 'No phone number configured'
        };
      }

      const testMessage = '🧪 BoosterBeacon test: Your SMS alerts are working perfectly!';

      const result = await this.sendSMS({
        to: phoneNumber,
        body: testMessage,
        from: this.TWILIO_PHONE_NUMBER
      });

      if (result.success) {
        return { success: true };
      } else {
        return { success: false, error: result.error || 'SMS test failed' };
      }

    } catch (error) {
      logger.error('Failed to send test SMS', {
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
   * Get SMS usage statistics for user
   */
  static async getUserSMSStats(userId: string): Promise<{
    smsSent: number;
    smsDelivered: number;
    smsFailed: number;
    lastSmsSent?: Date;
    monthlyUsage: number;
    monthlyLimit: number;
  }> {
    try {
      // In a real implementation, this would query SMS delivery statistics
      return {
        smsSent: 0,
        smsDelivered: 0,
        smsFailed: 0,
        monthlyUsage: 0,
        monthlyLimit: 100 // Pro tier limit
      };

    } catch (error) {
      logger.error('Failed to get SMS stats', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        smsSent: 0,
        smsDelivered: 0,
        smsFailed: 0,
        monthlyUsage: 0,
        monthlyLimit: 0
      };
    }
  }

  /**
   * Handle SMS delivery status webhooks
   */
  static async handleSMSWebhook(webhookData: any): Promise<void> {
    try {
      logger.info('Processing SMS webhook', {
        messageId: webhookData.MessageSid,
        status: webhookData.MessageStatus
      });

      // In a real implementation, this would:
      // 1. Parse the webhook data
      // 2. Update delivery records
      // 3. Handle delivery failures
      // 4. Update user SMS quota if needed

    } catch (error) {
      logger.error('Failed to process SMS webhook', {
        error: error instanceof Error ? error.message : 'Unknown error',
        webhookData
      });
    }
  }

  /**
   * Get SMS delivery statistics
   */
  static async getSMSStats(): Promise<{
    smsSent: number;
    smsDelivered: number;
    smsFailed: number;
    deliveryRate: number;
    avgCostPerSMS: number;
  }> {
    // In a real implementation, this would query delivery statistics
    return {
      smsSent: 0,
      smsDelivered: 0,
      smsFailed: 0,
      deliveryRate: 0,
      avgCostPerSMS: 0
    };
  }
}