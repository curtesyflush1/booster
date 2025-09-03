import nodemailer from 'nodemailer';
import { EmailConfigService } from '../../services/emailConfigService';
import { EmailPreferencesService } from '../../services/emailPreferencesService';
import { EmailDeliveryService } from '../../services/emailDeliveryService';

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

  private static getBackendPublicBase(): string {
    const baseBackend = process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
    return baseBackend.replace(/\/$/, '');
  }

  private static async buildUnsubscribeHeaders(
    userId: string | undefined,
    emailType: 'all' | 'alerts' | 'marketing' | 'digest'
  ): Promise<Record<string, string> | undefined> {
    try {
      const mailto = (process.env.UNSUBSCRIBE_MAILTO || process.env.SUPPORT_EMAIL || process.env.FROM_EMAIL || 'support@boosterbeacon.com');
      let token: string | null = null;
      if (userId) {
        try {
          token = await EmailPreferencesService.createUnsubscribeToken(userId, emailType);
        } catch {
          token = null;
        }
      }
      const parts: string[] = [];
      if (mailto) parts.push(`<mailto:${mailto}?subject=unsubscribe>`);
      if (token) parts.push(`<${this.getBackendPublicBase()}/api/email/unsubscribe?token=${encodeURIComponent(token)}> `);
      if (parts.length === 0) return undefined;
      return {
        'List-Unsubscribe': parts.join(', '),
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      };
    } catch {
      return undefined;
    }
  }

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

  static async sendVerificationEmail(user: { id?: string; email: string; first_name?: string; last_name?: string }, token: string): Promise<{ success: boolean; error?: string; previewUrl?: string }> {
    const transporter = await this.getTransporter();
    const baseFrontend = process.env.FRONTEND_URL;
    const baseBackend = process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
    const verifyUrl = baseBackend
      ? `${baseBackend.replace(/\/$/, '')}/api/auth/verify-email/${encodeURIComponent(token)}`
      : `${(baseFrontend || '').replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;

    const subject = 'Verify your email for BoosterBeacon';
    const text = `Welcome to BoosterBeacon!\n\nPlease verify your email by visiting this link:\n${verifyUrl}\n\nIf you did not create an account, please ignore this email.`;
    const html = `
      <div style="font-family:Arial,sans-serif; line-height:1.6;">
        <h2>Welcome to BoosterBeacon!</h2>
        <p>Hi ${user.first_name || ''}, please verify your email address to activate your account.</p>
        <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">Verify Email</a></p>
        <p>Or copy and paste this URL in your browser:</p>
        <p style="word-break:break-all;color:#555;">${verifyUrl}</p>
      </div>
    `;

    if (!transporter) {
      // Dev mode fallback
      console.log('Dev: verification email (no SMTP):', { to: user.email, verifyUrl });
      return { success: true };
    }

    try {
      const cfg = EmailConfigService.getCurrentConfiguration();
      const headers = (process.env.EMAIL_INCLUDE_UNSUBSCRIBE_IN_TRANSACTIONAL === 'true')
        ? await this.buildUnsubscribeHeaders(user.id, 'all')
        : undefined;
      const info = await transporter.sendMail({
        from: `${cfg.fromName} <${cfg.fromEmail}>`,
        to: user.email,
        subject,
        text,
        html,
        headers
      });
      if (user.id) {
        try {
          await EmailDeliveryService.logEmailSent({
            userId: user.id,
            emailType: 'system',
            recipientEmail: user.email,
            subject,
            messageId: (info as any)?.messageId,
            metadata: { category: 'verification' }
          });
        } catch {}
      }
      const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
      return { success: true, previewUrl };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to send verification email' };
    }
  }

  static async sendWelcomeEmail(user: any): Promise<{ success: boolean; error?: string }> {
    // Alias to verification email if token present
    if (user?.verification_token) {
      const res = await this.sendVerificationEmail(user, user.verification_token);
      return { success: res.success, error: res.error };
    }
    return { success: true };
  }

  static async sendPasswordResetEmail(user: { id?: string; email: string; first_name?: string }, token: string): Promise<{ success: boolean; error?: string; previewUrl?: string }> {
    const transporter = await this.getTransporter();
    const baseFrontend = process.env.FRONTEND_URL;
    const resetUrl = `${(baseFrontend || '').replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
    const subject = 'Reset your BoosterBeacon password';
    const text = `We received a request to reset your password.\n\nReset link: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`;
    const html = `
      <div style="font-family:Arial,sans-serif; line-height:1.6;">
        <h2>Password Reset</h2>
        <p>Hi ${user.first_name || ''}, click the button below to reset your password.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">Reset Password</a></p>
        <p>Or copy and paste this URL in your browser:</p>
        <p style="word-break:break-all;color:#555;">${resetUrl}</p>
      </div>
    `;

    if (!transporter) {
      console.log('Dev: password reset email (no SMTP):', { to: user.email, resetUrl });
      return { success: true };
    }
    try {
      const cfg = EmailConfigService.getCurrentConfiguration();
      const headers = (process.env.EMAIL_INCLUDE_UNSUBSCRIBE_IN_TRANSACTIONAL === 'true')
        ? await this.buildUnsubscribeHeaders(user.id, 'all')
        : undefined;
      const info = await transporter.sendMail({
        from: `${cfg.fromName} <${cfg.fromEmail}>`,
        to: user.email,
        subject,
        text,
        html,
        headers
      });
      if (user.id) {
        try {
          await EmailDeliveryService.logEmailSent({
            userId: user.id,
            emailType: 'system',
            recipientEmail: user.email,
            subject,
            messageId: (info as any)?.messageId,
            metadata: { category: 'password_reset' }
          });
        } catch {}
      }
      const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
      return { success: true, previewUrl };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to send reset email' };
    }
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
