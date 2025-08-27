import { IUser, IAlert } from '../types/database';
import { EmailPreferencesService } from './emailPreferencesService';

export interface EmailTemplateData {
  user: IUser;
  frontendUrl: string;
  unsubscribeToken: string;
}

export interface AlertTemplateData extends EmailTemplateData {
  alert: IAlert;
  productName: string;
  retailerName: string;
  price?: string | undefined;
  originalPrice?: string | undefined;
  productUrl: string;
  cartUrl?: string | undefined;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface AlertConfig {
  emoji: string;
  subject: string;
  title: string;
  message: string;
}

interface ProductCardData {
  productName: string;
  retailerName: string;
  price?: string | undefined;
  originalPrice?: string | undefined;
  productUrl: string;
  cartUrl?: string | undefined;
}

export class EmailTemplateService {
  private static readonly FRONTEND_URL = process.env.FRONTEND_URL || 'https://boosterbeacon.com';
  
  private static readonly ALERT_CONFIGS: Record<string, AlertConfig> = {
    restock: {
      emoji: '🔥',
      subject: '{productName} is back in stock at {retailerName}!',
      title: 'Product Back in Stock!',
      message: 'Great news! The product you\'re watching is now available'
    },
    price_drop: {
      emoji: '💰',
      subject: 'Price drop alert: {productName} at {retailerName}',
      title: 'Price Drop Alert!',
      message: 'The price has dropped'
    },
    low_stock: {
      emoji: '⚡',
      subject: 'Low stock alert: {productName} at {retailerName}',
      title: 'Low Stock Alert!',
      message: 'Hurry! Limited stock remaining'
    },
    pre_order: {
      emoji: '🎯',
      subject: 'Pre-order available: {productName} at {retailerName}',
      title: 'Pre-Order Available!',
      message: 'Pre-orders are now open'
    }
  };

  private static readonly PRIORITY_COLORS: Record<string, string> = {
    urgent: '#dc3545',
    high: '#fd7e14',
    medium: '#0d6efd',
    low: '#198754'
  };

  /**
   * Generate complete alert email template
   */
  static async generateAlertTemplate(alert: IAlert, user: IUser): Promise<EmailTemplate> {
    const templateData = await this.getAlertTemplateData(user, alert);
    const alertConfig = this.getAlertConfiguration(alert.type);
    
    const subject = `${alertConfig.emoji} ${alertConfig.subject
      .replace('{productName}', templateData.productName)
      .replace('{retailerName}', templateData.retailerName)}`;

    const html = this.buildCompleteEmailHTML({
      title: alertConfig.title,
      emoji: alertConfig.emoji,
      content: this.generateAlertContent(templateData, alertConfig),
      unsubscribeToken: templateData.unsubscribeToken,
      emailType: 'alerts'
    });

    const text = this.generateAlertTextTemplate(templateData, alertConfig);

    return { subject, html, text };
  }

  /**
   * Generate welcome email template
   */
  static async generateWelcomeTemplate(user: IUser): Promise<EmailTemplate> {
    const baseData = await this.getBaseTemplateData(user, 'marketing');
    
    const subject = 'Welcome to BoosterBeacon! 🔥 Your Pokémon TCG journey starts now';
    
    const content = `
      <h2>Hi ${user.first_name || 'Collector'}!</h2>
      <p style="font-size: 18px; line-height: 1.6;">Welcome to BoosterBeacon! We're excited to help you never miss another Pokémon TCG drop.</p>
      
      ${this.generateFeatureList([
        'Set up your first product watch and get instant alerts',
        'Configure your notification preferences (email, web push, and more)',
        'Explore our Watch Packs for popular sets',
        'Join our Discord community for real-time discussions',
        'Upgrade to Pro for unlimited watches and advanced features'
      ])}
      
      <a href="${this.FRONTEND_URL}/dashboard" class="cta-button">Start Watching Products</a>
      
      ${this.generateTipBox('Enable web push notifications for the fastest possible alerts - we deliver notifications within 5 seconds of detection!')}
    `;

    const html = this.buildCompleteEmailHTML({
      title: 'Welcome to BoosterBeacon!',
      emoji: '🔥',
      content,
      unsubscribeToken: baseData.unsubscribeToken,
      emailType: 'marketing'
    });

    const text = this.generateWelcomeTextTemplate(user, baseData.unsubscribeToken);

    return { subject, html, text };
  }

  /**
   * Generate password reset email template
   */
  static async generatePasswordResetTemplate(user: IUser, resetToken: string): Promise<EmailTemplate> {
    const resetUrl = `${this.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const subject = 'Reset your BoosterBeacon password';
    
    const content = `
      <h2>Hi ${user.first_name || 'User'}!</h2>
      <p>We received a request to reset your BoosterBeacon password. Click the button below to create a new password:</p>
      
      <a href="${resetUrl}" class="cta-button">Reset Password</a>
      
      ${this.generateWarningBox('Security Notice', [
        'This link expires in 1 hour for security',
        'If you didn\'t request this reset, please ignore this email',
        'Your current password remains unchanged until you create a new one'
      ])}
      
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      ${this.generateCodeBlock(resetUrl)}
    `;

    const html = this.buildCompleteEmailHTML({
      title: 'Reset Your Password',
      emoji: '🔐',
      content,
      unsubscribeToken: '', // System emails don't need unsubscribe
      emailType: 'system'
    });

    const text = this.generatePasswordResetTextTemplate(user, resetUrl);

    return { subject, html, text };
  }

  /**
   * Get common template data for all emails
   */
  static async getBaseTemplateData(user: IUser, emailType: 'alerts' | 'marketing' | 'digest'): Promise<EmailTemplateData> {
    const unsubscribeToken = await EmailPreferencesService.createUnsubscribeToken(user.id, emailType);

    return {
      user,
      frontendUrl: this.FRONTEND_URL,
      unsubscribeToken
    };
  }

  /**
   * Generate alert-specific template data
   */
  static async getAlertTemplateData(user: IUser, alert: IAlert): Promise<AlertTemplateData> {
    const baseData = await this.getBaseTemplateData(user, 'alerts');
    const data = alert.data;

    return {
      ...baseData,
      alert,
      productName: data.product_name,
      retailerName: data.retailer_name,
      price: data.price ? `$${data.price.toFixed(2)}` : undefined,
      originalPrice: data.original_price ? `$${data.original_price.toFixed(2)}` : undefined,
      productUrl: data.product_url,
      cartUrl: data.cart_url
    };
  }

  /**
   * Get alert configuration based on type
   */
  private static getAlertConfiguration(alertType: string): AlertConfig {
    return this.ALERT_CONFIGS[alertType] || {
      emoji: '📦',
      subject: 'Update for {productName}',
      title: 'Product Update',
      message: 'There\'s an update for your watched product'
    };
  }

  /**
   * Generate alert-specific content
   */
  private static generateAlertContent(data: AlertTemplateData, config: AlertConfig): string {
    const message = `Hi ${data.user.first_name || 'Collector'}! ${config.message} at ${data.retailerName}${data.price ? ` for ${data.price}` : ''}.`;
    
    return `
      <div class="alert-badge" style="background-color: ${this.getPriorityColor(data.alert.priority)};">${data.alert.priority} Priority</div>
      <h1 class="alert-title">${config.title}</h1>
      <p class="alert-message">${message}</p>
      
      ${this.generateProductCard({
        productName: data.productName,
        retailerName: data.retailerName,
        price: data.price,
        originalPrice: data.originalPrice,
        productUrl: data.productUrl,
        cartUrl: data.cartUrl
      })}
      
      ${this.generateTipBox('Popular Pokémon TCG items sell out extremely fast! We recommend acting quickly on high-priority alerts to secure your items.')}
    `;
  }

  /**
   * Build complete email HTML with consistent structure
   */
  private static buildCompleteEmailHTML(params: {
    title: string;
    emoji: string;
    content: string;
    unsubscribeToken: string;
    emailType: string;
  }): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${params.title}</title>
    ${this.generateEmailStyles()}
</head>
<body>
    <div class="container">
        ${this.generateEmailHeader(params.title, params.emoji)}
        
        <div class="content">
            ${params.content}
        </div>
        
        ${params.emailType !== 'system' ? this.generateEmailFooter(params.unsubscribeToken, params.emailType) : this.generateSystemEmailFooter()}
    </div>
</body>
</html>`;
  }

  /**
   * Generate product card HTML
   */
  private static generateProductCard(data: ProductCardData): string {
    const ctaText = data.cartUrl ? 'Add to Cart' : 'View Product';
    const ctaUrl = data.cartUrl || data.productUrl;

    return `
    <div class="product-card" style="border: 2px solid #e9ecef; border-radius: 12px; padding: 25px; margin: 25px 0; background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">
        <div class="product-name" style="font-size: 20px; font-weight: bold; color: #2c3e50; margin-bottom: 12px; line-height: 1.3;">${data.productName}</div>
        <div class="retailer-info" style="color: #6c757d; margin-bottom: 15px; font-size: 16px;">Available at ${data.retailerName}</div>
        ${data.price ? `<div class="price-info" style="font-size: 24px; font-weight: bold; color: #28a745; margin-bottom: 20px;">${data.price}${data.originalPrice ? `<span class="original-price" style="text-decoration: line-through; color: #dc3545; font-size: 18px; margin-left: 12px;">${data.originalPrice}</span>` : ''}</div>` : ''}
        
        <a href="${ctaUrl}" class="cta-button">${ctaText}</a>
        ${data.cartUrl && data.productUrl !== data.cartUrl ? `<a href="${data.productUrl}" class="cta-button secondary-button">View Details</a>` : ''}
    </div>`;
  }

  /**
   * Get priority color for styling
   */
  private static getPriorityColor(priority: string): string {
    return this.PRIORITY_COLORS[priority] || this.PRIORITY_COLORS.medium || "#6B7280";
  }

  /**
   * Generate common email header HTML
   */
  private static generateEmailHeader(title: string, emoji: string = '🔥'): string {
    return `
    <div class="header">
        <div class="logo">${emoji} BoosterBeacon</div>
        <div class="tagline">${title}</div>
    </div>`;
  }

  /**
   * Generate common email footer HTML
   */
  private static generateEmailFooter(unsubscribeToken: string, emailType: string): string {
    return `
    <div class="footer">
        <div class="footer-brand">BoosterBeacon - Never miss a Pokémon drop again!</div>
        <p>This email was sent based on your notification preferences.</p>
        <div class="unsubscribe">
            <a href="${this.FRONTEND_URL}/preferences">Manage your preferences</a> | 
            <a href="${this.FRONTEND_URL}/unsubscribe?type=${emailType}&token=${unsubscribeToken}">Unsubscribe from ${emailType} emails</a>
        </div>
    </div>`;
  }

  /**
   * Generate system email footer (no unsubscribe)
   */
  private static generateSystemEmailFooter(): string {
    return `
    <div class="footer">
        <div class="footer-brand">BoosterBeacon - Never miss a Pokémon drop again!</div>
        <p>This is a system email sent for account security purposes.</p>
    </div>`;
  }

  /**
   * Generate common email styles
   */
  private static generateEmailStyles(): string {
    return `
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; 
            margin: 0; 
            padding: 0; 
            background-color: #f8f9fa; 
            line-height: 1.6;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: white; 
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
        }
        .logo { 
            font-size: 28px; 
            font-weight: bold; 
            margin-bottom: 8px; 
        }
        .tagline { 
            font-size: 16px; 
            opacity: 0.9; 
        }
        .content { 
            padding: 40px 30px; 
        }
        .cta-button { 
            display: inline-block; 
            background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); 
            color: white; 
            padding: 16px 32px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: bold; 
            margin: 10px 8px 10px 0; 
            font-size: 16px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 8px rgba(255, 107, 53, 0.3);
        }
        .cta-button:hover { 
            background: linear-gradient(135deg, #e55a2b 0%, #e8851b 100%); 
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(255, 107, 53, 0.4);
        }
        .secondary-button { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
        }
        .secondary-button:hover { 
            background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%); 
            box-shadow: 0 6px 12px rgba(102, 126, 234, 0.4);
        }
        .footer { 
            background-color: #f8f9fa; 
            padding: 30px 20px; 
            text-align: center; 
            color: #6c757d; 
            font-size: 14px; 
            border-top: 1px solid #e9ecef;
        }
        .footer-brand {
            font-weight: bold;
            color: #495057;
            margin-bottom: 10px;
        }
        .unsubscribe { 
            color: #adb5bd; 
            font-size: 12px; 
            margin-top: 20px; 
            line-height: 1.5;
        }
        .unsubscribe a { 
            color: #6c757d; 
            text-decoration: none;
        }
        .unsubscribe a:hover {
            text-decoration: underline;
        }
        @media (max-width: 600px) {
            .content { padding: 25px 20px; }
            .cta-button { 
                display: block; 
                margin: 15px 0; 
                text-align: center; 
                width: calc(100% - 64px);
            }
        }
    </style>`;
  }

  /**
   * Generate feature list HTML
   */
  private static generateFeatureList(features: string[]): string {
    const featuresHtml = features.map(feature =>
      `<div class="feature-item" style="margin: 15px 0; padding-left: 25px; position: relative;">
        <span style="position: absolute; left: 0;">✅</span>
        ${feature}
      </div>`
    ).join('');

    return `
    <div class="feature-list" style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0;">
        ${featuresHtml}
    </div>`;
  }

  /**
   * Generate tip box HTML
   */
  private static generateTipBox(content: string): string {
    return `
    <div class="tip-box" style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 30px 0; color: #856404;">
        <p style="margin: 0;"><strong style="color: #533f03;">Pro Tip:</strong> ${content}</p>
    </div>`;
  }

  /**
   * Generate warning box HTML
   */
  private static generateWarningBox(title: string, items: string[]): string {
    const itemsHtml = items.map(item => `<li>${item}</li>`).join('');

    return `
    <div class="warning" style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <p><strong>🔒 ${title}:</strong></p>
        <ul style="margin: 10px 0; padding-left: 20px;">
            ${itemsHtml}
        </ul>
    </div>`;
  }

  /**
   * Generate code block HTML
   */
  private static generateCodeBlock(content: string): string {
    return `
    <div class="code-block" style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; font-family: monospace; word-break: break-all; color: #495057; margin: 15px 0;">
        ${content}
    </div>`;
  }

  /**
   * Generate alert text template
   */
  private static generateAlertTextTemplate(data: AlertTemplateData, config: AlertConfig): string {
    const ctaText = data.cartUrl ? 'Add to Cart' : 'View Product';
    const ctaUrl = data.cartUrl || data.productUrl;

    return `
🔥 BOOSTERBEACON ALERT 🔥

${config.title}

Hi ${data.user.first_name || 'Collector'}! ${config.message} at ${data.retailerName}${data.price ? ` for ${data.price}` : ''}.

PRODUCT: ${data.productName}
RETAILER: ${data.retailerName}
${data.price ? `PRICE: ${data.price}${data.originalPrice ? ` (was ${data.originalPrice})` : ''}` : ''}

${ctaText.toUpperCase()}: ${ctaUrl}

Pro Tip: Popular Pokémon TCG items sell out extremely fast! We recommend acting quickly on high-priority alerts.

---
Manage preferences: ${this.FRONTEND_URL}/preferences
Unsubscribe: ${this.FRONTEND_URL}/unsubscribe?type=alerts&token=${data.unsubscribeToken}
`;
  }

  /**
   * Generate welcome text template
   */
  private static generateWelcomeTextTemplate(user: IUser, unsubscribeToken: string): string {
    return `
Welcome to BoosterBeacon! 🔥

Hi ${user.first_name || 'Collector'}!

Welcome to BoosterBeacon! We're excited to help you never miss another Pokémon TCG drop.

What you can do right now:
✅ Set up your first product watch and get instant alerts
✅ Configure your notification preferences
✅ Explore our Watch Packs for popular sets
✅ Join our Discord community
✅ Upgrade to Pro for unlimited watches

Get started: ${this.FRONTEND_URL}/dashboard

Pro tip: Enable web push notifications for the fastest possible alerts!

Happy collecting!
The BoosterBeacon Team

---
Manage preferences: ${this.FRONTEND_URL}/preferences
Unsubscribe: ${this.FRONTEND_URL}/unsubscribe?type=marketing&token=${unsubscribeToken}
`;
  }

  /**
   * Generate password reset text template
   */
  private static generatePasswordResetTextTemplate(user: IUser, resetUrl: string): string {
    return `
Reset Your BoosterBeacon Password

Hi ${user.first_name || 'User'}!

We received a request to reset your BoosterBeacon password. Use this link to create a new password:

${resetUrl}

Security Notice:
- This link expires in 1 hour for security
- If you didn't request this reset, please ignore this email
- Your current password remains unchanged until you create a new one

---
BoosterBeacon Support Team
`;
  }
}