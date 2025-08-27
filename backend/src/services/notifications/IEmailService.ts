import { IAlert, IUser } from '../../types/database';
import { EmailSendResult, EmailStats, EmailWebhookData } from '../../types/email';
import { ChannelDeliveryResult } from '../alertDeliveryService';

/**
 * Interface for email service implementations
 * Ensures consistency between stub and production implementations
 */
export interface IEmailService {
  sendWelcomeEmail(user: IUser): Promise<EmailSendResult>;
  sendPasswordResetEmail(user: IUser, token: string): Promise<EmailSendResult>;
  sendAlert(alert: IAlert, user: IUser): Promise<ChannelDeliveryResult>;
  sendDigestEmail(user: IUser, alerts: IAlert[]): Promise<EmailSendResult>;
  testConfiguration(): Promise<EmailSendResult>;
  handleEmailWebhook(data: EmailWebhookData): Promise<void>;
  getEmailStats(): Promise<EmailStats>;
}