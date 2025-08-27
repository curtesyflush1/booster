import { SMTPConfig } from '../services/notifications/emailService';

export interface EmailConfigOptions {
  fromEmail: string;
  fromName: string;
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
}

export class EmailConfig {
  private static instance: EmailConfig;
  private config: EmailConfigOptions;

  private constructor() {
    this.config = this.buildConfiguration();
  }

  static getInstance(): EmailConfig {
    if (!EmailConfig.instance) {
      EmailConfig.instance = new EmailConfig();
    }
    return EmailConfig.instance;
  }

  getConfig(): EmailConfigOptions {
    return { ...this.config };
  }

  /**
   * Validate configuration completeness
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.fromEmail) {
      errors.push('FROM_EMAIL is required');
    }

    if (!this.config.host) {
      errors.push('SMTP_HOST is required');
    }

    if (!this.config.port || this.config.port <= 0) {
      errors.push('Valid SMTP_PORT is required');
    }

    // Validate auth if provided
    if (this.config.auth) {
      if (!this.config.auth.user) {
        errors.push('SMTP_USER is required when auth is configured');
      }
      if (!this.config.auth.pass) {
        errors.push('SMTP_PASS is required when auth is configured');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private buildConfiguration(): EmailConfigOptions {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const hasCustomSMTP = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

    const baseConfig = {
      fromEmail: process.env.FROM_EMAIL || 'alerts@boosterbeacon.com',
      fromName: process.env.FROM_NAME || 'BoosterBeacon'
    };

    if (hasCustomSMTP) {
      return {
        ...baseConfig,
        host: process.env.SMTP_HOST!,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASS!,
        },
        tls: {
          rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
        }
      };
    } else if (isDevelopment) {
      return {
        ...baseConfig,
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: 'ethereal.user@ethereal.email',
          pass: 'ethereal.pass'
        }
      };
    } else {
      return {
        ...baseConfig,
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '25'),
        secure: false,
        tls: {
          rejectUnauthorized: false
        }
      };
    }
  }

  reload(): void {
    this.config = this.buildConfiguration();
  }
}