import { logger } from '../utils/logger';
import nodemailer from 'nodemailer';

export interface EmailConfiguration {
  provider: 'local' | 'custom' | 'development';
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  tls?: {
    rejectUnauthorized: boolean;
  };
  fromEmail: string;
  fromName: string;
}

export interface EmailConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  configuration: EmailConfiguration;
}

export class EmailConfigService {
  /**
   * Get current email configuration
   */
  static getCurrentConfiguration(): EmailConfiguration {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const hasCustomSMTP = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

    if (hasCustomSMTP) {
      return {
        provider: 'custom',
        host: process.env.SMTP_HOST!,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASS!,
        },
        tls: {
          rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
        },
        fromEmail: process.env.FROM_EMAIL || 'alerts@boosterbeacon.com',
        fromName: process.env.FROM_NAME || 'BoosterBeacon'
      };
    } else if (isDevelopment) {
      return {
        provider: 'development',
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: 'ethereal.user@ethereal.email',
          pass: 'ethereal.pass'
        },
        fromEmail: process.env.FROM_EMAIL || 'alerts@boosterbeacon.com',
        fromName: process.env.FROM_NAME || 'BoosterBeacon'
      };
    } else {
      return {
        provider: 'local',
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '25'),
        secure: false,
        tls: {
          rejectUnauthorized: false
        },
        fromEmail: process.env.FROM_EMAIL || 'alerts@boosterbeacon.com',
        fromName: process.env.FROM_NAME || 'BoosterBeacon'
      };
    }
  }

  /**
   * Validate email configuration
   */
  static async validateConfiguration(): Promise<EmailConfigValidation> {
    const config = this.getCurrentConfiguration();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!config.host) {
      errors.push('SMTP host is required');
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.push('Valid SMTP port is required (1-65535)');
    }

    if (!config.fromEmail) {
      errors.push('From email address is required');
    } else if (!this.isValidEmail(config.fromEmail)) {
      errors.push('From email address is not valid');
    }

    if (!config.fromName) {
      warnings.push('From name is not set, using default');
    }

    // Provider-specific validation
    switch (config.provider) {
      case 'custom':
        if (!config.auth?.user || !config.auth?.pass) {
          errors.push('SMTP authentication credentials are required for custom provider');
        }
        break;
      case 'local':
        if (config.port !== 25 && config.port !== 587 && config.port !== 465) {
          warnings.push('Unusual port for local SMTP server. Common ports are 25, 587, 465');
        }
        break;
      case 'development':
        warnings.push('Using development email configuration (Ethereal Email)');
        break;
    }

    // Connection test
    let connectionValid = false;
    try {
      const transporter = nodemailer.createTransport(config);
      await transporter.verify();
      connectionValid = true;
      logger.info('Email configuration validation successful', { provider: config.provider });
    } catch (error) {
      errors.push(`SMTP connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      logger.error('Email configuration validation failed', { 
        provider: config.provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return {
      isValid: errors.length === 0 && connectionValid,
      errors,
      warnings,
      configuration: config
    };
  }

  /**
   * Get configuration recommendations
   */
  static getConfigurationRecommendations(): {
    production: string[];
    development: string[];
    security: string[];
  } {
    return {
      production: [
        'Use a dedicated SMTP service (Postfix, Exim, or cloud provider)',
        'Set up proper SPF, DKIM, and DMARC records for your domain',
        'Use TLS encryption for SMTP connections',
        'Monitor email delivery rates and bounce handling',
        'Set up proper reverse DNS for your mail server'
      ],
      development: [
        'Use Ethereal Email for testing (automatically configured)',
        'Set SMTP_HOST, SMTP_USER, SMTP_PASS for custom testing',
        'Use MailHog or similar for local email testing',
        'Test all email templates before production deployment'
      ],
      security: [
        'Store SMTP credentials in environment variables, never in code',
        'Use strong passwords for SMTP authentication',
        'Enable TLS/SSL for SMTP connections when possible',
        'Regularly rotate SMTP credentials',
        'Monitor for suspicious email activity'
      ]
    };
  }

  /**
   * Generate environment variable template
   */
  static generateEnvTemplate(): string {
    return `
# Email Configuration
# Choose one of the following configurations:

# Option 1: Local SMTP Server (Production)
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
SMTP_TLS_REJECT_UNAUTHORIZED=false

# Option 2: Custom SMTP Provider (Production)
# SMTP_HOST=smtp.your-provider.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=your-username
# SMTP_PASS=your-password
# SMTP_TLS_REJECT_UNAUTHORIZED=true

# Option 3: Development (Ethereal Email - auto-configured)
# Leave SMTP variables empty for development mode

# Email Sender Information
FROM_EMAIL=alerts@boosterbeacon.com
FROM_NAME=BoosterBeacon

# Frontend URL for email links
FRONTEND_URL=https://boosterbeacon.com
`;
  }

  /**
   * Test email delivery
   */
  static async testEmailDelivery(testEmail: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    previewUrl?: string;
  }> {
    try {
      const config = this.getCurrentConfiguration();
      const transporter = nodemailer.createTransport(config);

      const testMessage = {
        from: `${config.fromName} <${config.fromEmail}>`,
        to: testEmail,
        subject: 'BoosterBeacon Email Configuration Test',
        text: `
This is a test email from BoosterBeacon to verify your email configuration.

Configuration Details:
- Provider: ${config.provider}
- Host: ${config.host}
- Port: ${config.port}
- Secure: ${config.secure}
- From: ${config.fromEmail}

If you received this email, your email configuration is working correctly!

Time: ${new Date().toISOString()}
        `,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Email Configuration Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; }
        .header { background-color: #667eea; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; margin: -30px -30px 30px -30px; }
        .success { background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .config-details { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔥 BoosterBeacon</h1>
            <p>Email Configuration Test</p>
        </div>
        
        <div class="success">
            <strong>✅ Success!</strong> Your email configuration is working correctly.
        </div>
        
        <p>This is a test email from BoosterBeacon to verify your email configuration.</p>
        
        <div class="config-details">
            <h3>Configuration Details:</h3>
            <ul>
                <li><strong>Provider:</strong> ${config.provider}</li>
                <li><strong>Host:</strong> ${config.host}</li>
                <li><strong>Port:</strong> ${config.port}</li>
                <li><strong>Secure:</strong> ${config.secure}</li>
                <li><strong>From:</strong> ${config.fromEmail}</li>
            </ul>
        </div>
        
        <p>If you received this email, your email configuration is working correctly!</p>
        
        <p style="color: #666; font-size: 14px;">
            <strong>Time:</strong> ${new Date().toISOString()}
        </p>
    </div>
</body>
</html>
        `
      };

      const info = await transporter.sendMail(testMessage);

      logger.info('Test email sent successfully', {
        to: testEmail,
        messageId: info.messageId,
        provider: config.provider
      });

      // For Ethereal Email, provide preview URL
      const result: {
        success: boolean;
        messageId?: string;
        error?: string;
        previewUrl?: string;
      } = {
        success: true,
        messageId: info.messageId
      };

      if (config.provider === 'development' && info.messageId) {
        const url = nodemailer.getTestMessageUrl(info);
        if (url) {
          result.previewUrl = url;
        }
      }

      return result;

    } catch (error) {
      logger.error('Test email failed', {
        to: testEmail,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate email address format
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get email delivery best practices
   */
  static getDeliveryBestPractices(): {
    category: string;
    practices: string[];
  }[] {
    return [
      {
        category: 'Authentication & Security',
        practices: [
          'Set up SPF records to authorize your mail server',
          'Configure DKIM signing for email authentication',
          'Implement DMARC policy for domain protection',
          'Use proper reverse DNS (PTR) records',
          'Keep your mail server software updated'
        ]
      },
      {
        category: 'Content & Formatting',
        practices: [
          'Always include both HTML and plain text versions',
          'Use clear, descriptive subject lines',
          'Include unsubscribe links in all marketing emails',
          'Avoid spam trigger words and excessive capitalization',
          'Test emails across different clients and devices'
        ]
      },
      {
        category: 'List Management',
        practices: [
          'Use double opt-in for new subscribers',
          'Regularly clean your email list',
          'Handle bounces and complaints promptly',
          'Segment your audience for targeted messaging',
          'Respect user preferences and quiet hours'
        ]
      },
      {
        category: 'Monitoring & Analytics',
        practices: [
          'Track delivery rates, opens, and clicks',
          'Monitor bounce and complaint rates',
          'Set up alerts for delivery issues',
          'Regularly review email performance metrics',
          'A/B test subject lines and content'
        ]
      }
    ];
  }
}