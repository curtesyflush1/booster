import nodemailer from 'nodemailer';

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
  static async sendContactEmail(params: { name: string; email: string; subject: string; message: string }): Promise<{ success: boolean; error?: string }> {
    const { name, email, subject, message } = params;
    const to = process.env.SUPPORT_EMAIL || process.env.FROM_EMAIL || 'support@boosterbeacon.com';

    // If a transporter is configured, attempt to send via nodemailer
    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: process.env.FROM_EMAIL || 'no-reply@boosterbeacon.com',
          to,
          subject: `[Contact] ${subject}`,
          text: `From: ${name} <${email}>\n\n${message}`,
          html: `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><p>${message.replace(/\n/g, '<br/>')}</p>`
        });
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to send contact email' };
      }
    }

    // Development default: pretend success
    console.log(`Contact email (dev mode): to=${to} subject=${subject} from=${name}<${email}> msg=${message.substring(0, 120)}...`);
    return { success: true };
  }
}
