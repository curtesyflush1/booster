import { IAlert, IUser } from '../../types/database';
import { logger } from '../../utils/logger';
import { ChannelDeliveryResult } from '../alertDeliveryService';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailMetadata {
  messageId?: string;
  templateUsed: string;
  recipientEmail: string;
  bounced?: boolean;
  complained?: boolean;
}

export class EmailService {
  private static readonly FROM_EMAIL = process.env.FROM_EMAIL || 'alerts@boosterbeacon.com';
  private static readonly FROM_NAME = process.env.FROM_NAME || 'BoosterBeacon';
  private static readonly AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  private static readonly SES_CONFIGURATION_SET = process.env.SES_CONFIGURATION_SET;

  /**
   * Send email alert
   */
  static async sendAlert(alert: IAlert, user: IUser): Promise<ChannelDeliveryResult> {
    try {
      logger.debug('Sending email alert', {
        alertId: alert.id,
        userId: user.id,
        email: user.email
      });

      // Validate email configuration
      if (!user.email || !user.email_verified) {
        return {
          channel: 'email',
          success: false,
          error: 'User email not verified'
        };
      }

      // Check if user has opted out of email notifications
      if (!user.notification_settings.email) {
        return {
          channel: 'email',
          success: false,
          error: 'User has disabled email notifications'
        };
      }

      // Generate email template
      const template = this.generateAlertTemplate(alert, user);

      // Send email
      const result = await this.sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        metadata: {
          alertId: alert.id,
          userId: user.id,
          alertType: alert.type
        }
      });

      if (result.success) {
        logger.info('Email alert sent successfully', {
          alertId: alert.id,
          userId: user.id,
          messageId: result.messageId
        });

        return {
          channel: 'email',
          success: true,
          externalId: result.messageId!,
          metadata: {
            messageId: result.messageId!,
            templateUsed: alert.type,
            recipientEmail: user.email
          }
        };
      } else {
        return {
          channel: 'email',
          success: false,
          error: result.error!
        };
      }

    } catch (error) {
      logger.error('Email alert failed', {
        alertId: alert.id,
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        channel: 'email',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate email template for alert
   */
  private static generateAlertTemplate(alert: IAlert, user: IUser): EmailTemplate {
    const data = alert.data;
    const productName = data.product_name;
    const retailerName = data.retailer_name;
    const price = data.price ? `$${data.price.toFixed(2)}` : '';
    const originalPrice = data.original_price ? `$${data.original_price.toFixed(2)}` : '';

    let subject: string;
    let alertTitle: string;
    let alertMessage: string;
    let emoji: string;

    switch (alert.type) {
      case 'restock':
        emoji = '🔥';
        subject = `${productName} is back in stock at ${retailerName}!`;
        alertTitle = 'Product Back in Stock!';
        alertMessage = `Great news! The product you're watching is now available at ${retailerName}${price ? ` for ${price}` : ''}.`;
        break;
      case 'price_drop':
        emoji = '💰';
        subject = `Price drop alert: ${productName} at ${retailerName}`;
        alertTitle = 'Price Drop Alert!';
        alertMessage = `The price has dropped${price ? ` to ${price}` : ''}${originalPrice ? ` from ${originalPrice}` : ''} at ${retailerName}.`;
        break;
      case 'low_stock':
        emoji = '⚡';
        subject = `Low stock alert: ${productName} at ${retailerName}`;
        alertTitle = 'Low Stock Alert!';
        alertMessage = `Hurry! Limited stock remaining at ${retailerName}${price ? ` - ${price}` : ''}.`;
        break;
      case 'pre_order':
        emoji = '🎯';
        subject = `Pre-order available: ${productName} at ${retailerName}`;
        alertTitle = 'Pre-Order Available!';
        alertMessage = `Pre-orders are now open at ${retailerName}${price ? ` for ${price}` : ''}.`;
        break;
      default:
        emoji = '📦';
        subject = `Update for ${productName}`;
        alertTitle = 'Product Update';
        alertMessage = `There's an update for your watched product at ${retailerName}.`;
    }

    const htmlParams = {
      emoji,
      alertTitle,
      alertMessage,
      productName,
      retailerName,
      price,
      originalPrice,
      productUrl: data.product_url,
      userName: user.first_name || 'Collector',
      alertType: alert.type,
      priority: alert.priority
    };

    if (data.cart_url) {
      (htmlParams as any).cartUrl = data.cart_url;
    }

    const html = this.generateHTMLTemplate(htmlParams);

    const textParams = {
      alertTitle,
      alertMessage,
      productName,
      retailerName,
      productUrl: data.product_url,
      userName: user.first_name || 'Collector'
    };

    if (data.cart_url) {
      (textParams as any).cartUrl = data.cart_url;
    }

    const text = this.generateTextTemplate(textParams);

    return { subject, html, text };
  }

  /**
   * Generate HTML email template
   */
  private static generateHTMLTemplate(params: {
    emoji: string;
    alertTitle: string;
    alertMessage: string;
    productName: string;
    retailerName: string;
    price?: string;
    originalPrice?: string;
    productUrl: string;
    cartUrl?: string;
    userName: string;
    alertType: string;
    priority: string;
  }): string {
    const priorityColor = this.getPriorityColor(params.priority);
    const ctaText = params.cartUrl ? 'Add to Cart' : 'View Product';
    const ctaUrl = params.cartUrl || params.productUrl;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BoosterBeacon Alert</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .content { padding: 30px; }
        .alert-badge { display: inline-block; background-color: ${priorityColor}; color: white; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; margin-bottom: 20px; }
        .alert-title { font-size: 28px; margin: 0 0 15px 0; color: #333; }
        .alert-message { font-size: 16px; line-height: 1.6; color: #666; margin-bottom: 25px; }
        .product-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0; background-color: #fafafa; }
        .product-name { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 10px; }
        .retailer-info { color: #666; margin-bottom: 15px; }
        .price-info { font-size: 20px; font-weight: bold; color: #2e7d32; margin-bottom: 20px; }
        .original-price { text-decoration: line-through; color: #999; font-size: 16px; margin-left: 10px; }
        .cta-button { display: inline-block; background-color: #ff6b35; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px 5px; }
        .cta-button:hover { background-color: #e55a2b; }
        .secondary-button { background-color: #667eea; }
        .secondary-button:hover { background-color: #5a6fd8; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
        .unsubscribe { color: #999; font-size: 12px; margin-top: 15px; }
        .unsubscribe a { color: #999; }
        @media (max-width: 600px) {
            .content { padding: 20px; }
            .alert-title { font-size: 24px; }
            .cta-button { display: block; margin: 10px 0; text-align: center; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">${params.emoji} BoosterBeacon</div>
            <div>Your Pokémon TCG Alert Service</div>
        </div>
        
        <div class="content">
            <div class="alert-badge">${params.priority} Priority</div>
            <h1 class="alert-title">${params.alertTitle}</h1>
            <p class="alert-message">Hi ${params.userName}! ${params.alertMessage}</p>
            
            <div class="product-card">
                <div class="product-name">${params.productName}</div>
                <div class="retailer-info">Available at ${params.retailerName}</div>
                ${params.price ? `<div class="price-info">${params.price}${params.originalPrice ? `<span class="original-price">${params.originalPrice}</span>` : ''}</div>` : ''}
                
                <a href="${ctaUrl}" class="cta-button">${ctaText}</a>
                ${params.cartUrl && params.productUrl !== params.cartUrl ? `<a href="${params.productUrl}" class="cta-button secondary-button">View Details</a>` : ''}
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
                <strong>Quick tip:</strong> Popular items sell out fast! We recommend acting quickly on high-priority alerts.
            </p>
        </div>
        
        <div class="footer">
            <p><strong>BoosterBeacon</strong> - Never miss a Pokémon drop again!</p>
            <p>This alert was generated based on your watch preferences.</p>
            <div class="unsubscribe">
                <a href="#">Manage your alert preferences</a> | 
                <a href="#">Unsubscribe from email alerts</a>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate plain text email template
   */
  private static generateTextTemplate(params: {
    alertTitle: string;
    alertMessage: string;
    productName: string;
    retailerName: string;
    productUrl: string;
    cartUrl?: string;
    userName: string;
  }): string {
    const ctaText = params.cartUrl ? 'Add to Cart' : 'View Product';
    const ctaUrl = params.cartUrl || params.productUrl;

    return `
🔥 BOOSTERBEACON ALERT 🔥

${params.alertTitle}

Hi ${params.userName}! ${params.alertMessage}

PRODUCT: ${params.productName}
RETAILER: ${params.retailerName}

${ctaText.toUpperCase()}: ${ctaUrl}

${params.cartUrl && params.productUrl !== params.cartUrl ? `VIEW DETAILS: ${params.productUrl}` : ''}

Quick tip: Popular items sell out fast! We recommend acting quickly on high-priority alerts.

---
BoosterBeacon - Never miss a Pokémon drop again!
This alert was generated based on your watch preferences.

Manage your preferences: [PREFERENCES_URL]
Unsubscribe: [UNSUBSCRIBE_URL]
`;
  }

  /**
   * Get priority color for styling
   */
  private static getPriorityColor(priority: string): string {
    switch (priority) {
      case 'urgent': return '#d32f2f';
      case 'high': return '#f57c00';
      case 'medium': return '#1976d2';
      case 'low': return '#388e3c';
      default: return '#1976d2';
    }
  }

  /**
   * Send email using AWS SES (simulated)
   */
  private static async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
    metadata?: Record<string, any>;
  }): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      logger.debug('Sending email via SES', {
        to: params.to,
        subject: params.subject
      });

      // In a real implementation, this would use AWS SES SDK
      // For now, we'll simulate the sending
      
      // Simulate potential failures
      if (Math.random() < 0.02) { // 2% failure rate
        throw new Error('SES service temporarily unavailable');
      }

      // Simulate bounced email
      if (params.to.includes('bounce')) {
        throw new Error('Email bounced - invalid recipient');
      }

      // Simulate successful send
      await new Promise(resolve => setTimeout(resolve, 200));
      const messageId = `ses-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      logger.debug('Email sent successfully', {
        to: params.to,
        messageId
      });

      return {
        success: true,
        messageId
      };

    } catch (error) {
      logger.error('Failed to send email', {
        to: params.to,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send welcome email to new user
   */
  static async sendWelcomeEmail(user: IUser): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const template = this.generateWelcomeTemplate(user);
      
      const result = await this.sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        metadata: {
          userId: user.id,
          emailType: 'welcome'
        }
      });

      if (result.success) {
        return { success: true };
      } else {
        return { success: false, error: result.error! };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate welcome email template
   */
  private static generateWelcomeTemplate(user: IUser): EmailTemplate {
    const userName = user.first_name || 'Collector';
    
    const subject = 'Welcome to BoosterBeacon! 🔥';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Welcome to BoosterBeacon</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .cta-button { display: inline-block; background-color: #ff6b35; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔥 Welcome to BoosterBeacon!</h1>
            <p>Your Pokémon TCG Alert Service</p>
        </div>
        <div class="content">
            <h2>Hi ${userName}!</h2>
            <p>Welcome to BoosterBeacon! We're excited to help you never miss another Pokémon TCG drop.</p>
            <p>Here's what you can do next:</p>
            <ul>
                <li>Set up your first product watch</li>
                <li>Configure your notification preferences</li>
                <li>Explore our Watch Packs for popular sets</li>
            </ul>
            <a href="https://boosterbeacon.com/dashboard" class="cta-button">Get Started</a>
            <p>Happy collecting!</p>
            <p>The BoosterBeacon Team</p>
        </div>
    </div>
</body>
</html>`;

    const text = `
Welcome to BoosterBeacon! 🔥

Hi ${userName}!

Welcome to BoosterBeacon! We're excited to help you never miss another Pokémon TCG drop.

Here's what you can do next:
- Set up your first product watch
- Configure your notification preferences  
- Explore our Watch Packs for popular sets

Get started: https://boosterbeacon.com/dashboard

Happy collecting!
The BoosterBeacon Team
`;

    return { subject, html, text };
  }

  /**
   * Handle email bounce/complaint webhooks
   */
  static async handleEmailWebhook(webhookData: any): Promise<void> {
    try {
      logger.info('Processing email webhook', {
        eventType: webhookData.eventType,
        messageId: webhookData.mail?.messageId
      });

      // In a real implementation, this would:
      // 1. Parse the webhook data
      // 2. Update delivery records
      // 3. Handle bounces/complaints
      // 4. Update user email status if needed

    } catch (error) {
      logger.error('Failed to process email webhook', {
        error: error instanceof Error ? error.message : 'Unknown error',
        webhookData
      });
    }
  }

  /**
   * Get email delivery statistics
   */
  static async getEmailStats(): Promise<{
    emailsSent: number;
    emailsDelivered: number;
    emailsBounced: number;
    emailsComplained: number;
    deliveryRate: number;
  }> {
    // In a real implementation, this would query delivery statistics
    return {
      emailsSent: 0,
      emailsDelivered: 0,
      emailsBounced: 0,
      emailsComplained: 0,
      deliveryRate: 0
    };
  }
}