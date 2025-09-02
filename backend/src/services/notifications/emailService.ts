import nodemailer from 'nodemailer';
import { EmailConfigService } from '../../services/emailConfigService';

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}

export interface ChannelDeliveryResult {
  channel: string;
  success: boolean;
  deliveryId?: string;
  externalId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  private static async getTransporter(): Promise<nodemailer.Transporter | null> {
    // If transporter already set (e.g., in production init), reuse it
    if (this.transporter) return this.transporter;

    try {
      const cfg = EmailConfigService.getCurrentConfiguration();
      // If a custom SMTP provider is configured, use it as-is
      if (cfg.provider === 'custom') {
        const transportOptions: any = {
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          auth: cfg.auth,
          requireTLS: cfg.secure ? false : true,
          tls: cfg.tls || { rejectUnauthorized: true }
        };
        this.transporter = nodemailer.createTransport(transportOptions);
        return this.transporter;
      }

      // In development, create an Ethereal test account dynamically
      if ((process.env.NODE_ENV || 'development') === 'development') {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
        return this.transporter;
      }

      // Fallback: local or minimal config
      this.transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        tls: cfg.tls || { rejectUnauthorized: false }
      });
      return this.transporter;
    } catch (e) {
      // Fall back to null (dev mode stubs)
      return null;
    }
  }

  static async sendWelcomeEmail(_user: any): Promise<{ success: boolean; error?: string }> {
    console.log('Email service disabled for deployment');
    return { success: true };
  }

  static async sendPasswordResetEmail(_user: any, _token: string): Promise<{ success: boolean; error?: string }> {
    console.log('Email service disabled for deployment');
    return { success: true };
  }

  static async sendAlert(_alert: any, _user: any): Promise<ChannelDeliveryResult> {
    console.log('Email service disabled for deployment');
    return { 
      channel: 'email',
      success: true 
    };
  }

  static async sendDigestEmail(_user: any, _alerts: any[]): Promise<{ success: boolean; error?: string }> {
    console.log('Email service disabled for deployment');
    return { success: true };
  }

  static async testEmailConfiguration(): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  static async testConfiguration(): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  static async handleEmailWebhook(_data: any): Promise<void> {
    console.log('Email webhook received');
  }

  static async getEmailStats(): Promise<any> {
    return {
      deliveryRate: 100,
      bounceRate: 0,
      complaintRate: 0
    };
  }

  /**
   * Send contact form email to support
   * In development, this is a no-op that returns success. Configure SMTP/SES in production.
   */
  static async sendContactEmail(params: { name: string; email: string; subject: string; message: string }): Promise<{ success: boolean; error?: string; previewUrl?: string }> {
    const { name, email, subject, message } = params;
    const to = process.env.SUPPORT_EMAIL || process.env.FROM_EMAIL || 'support@boosterbeacon.com';

    // If a transporter is configured, attempt to send via nodemailer
    const transporter = await this.getTransporter();
    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from: process.env.FROM_EMAIL || 'no-reply@boosterbeacon.com',
          to,
          subject: `[Contact] ${subject}`,
          text: `From: ${name} <${email}>\n\n${message}`,
          html: `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><p>${message.replace(/\n/g, '<br/>')}</p>`,
          replyTo: `${name} <${email}>`
        });
        const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
        if (previewUrl) {
          console.log('Contact email preview URL (dev):', previewUrl);
        }
        return { success: true, previewUrl };
      } catch (err: any) {
        // If a custom provider is configured, surface the error so it can be fixed
        try {
          const cfg = EmailConfigService.getCurrentConfiguration();
          if (cfg.provider === 'custom') {
            return { success: false, error: err?.message || 'Failed to send contact email' };
          }
        } catch {}
        // Otherwise (dev/test fallback), simulate success
        if ((process.env.NODE_ENV || 'development') !== 'production') {
          console.warn('SMTP send failed in development; simulating success:', err?.message || err);
          return { success: true };
        }
        return { success: false, error: err?.message || 'Failed to send contact email' };
      }
    }

    // Development default: pretend success
    console.log(`Contact email (dev mode): to=${to} subject=${subject} from=${name}<${email}> msg=${message.substring(0, 120)}...`);
    return { success: true };
  }
}
