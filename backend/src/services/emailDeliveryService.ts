import { logger } from '../utils/logger';
import { db } from '../config/database';

export interface EmailDeliveryLog {
  id: string;
  userId: string;
  alertId?: string;
  emailType: 'alert' | 'welcome' | 'marketing' | 'digest' | 'system';
  recipientEmail: string;
  subject: string;
  messageId?: string;
  sentAt: Date;
  deliveredAt?: Date;
  bouncedAt?: Date;
  complainedAt?: Date;
  bounceReason?: string;
  complaintReason?: string;
  metadata?: Record<string, any>;
}

export interface BounceEvent {
  messageId: string;
  bounceType: 'permanent' | 'transient';
  bounceSubType: string;
  bouncedRecipients: Array<{
    emailAddress: string;
    status: string;
    action: string;
    diagnosticCode?: string;
  }>;
  timestamp: Date;
}

export interface ComplaintEvent {
  messageId: string;
  complainedRecipients: Array<{
    emailAddress: string;
  }>;
  timestamp: Date;
  complaintFeedbackType?: string;
}

export class EmailDeliveryService {
  /**
   * Log email send attempt
   */
  static async logEmailSent(params: {
    userId: string;
    alertId?: string;
    emailType: EmailDeliveryLog['emailType'];
    recipientEmail: string;
    subject: string;
    messageId?: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    try {
      const logId = `email_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      const logEntry = {
        id: logId,
        user_id: params.userId,
        alert_id: params.alertId,
        email_type: params.emailType,
        recipient_email: params.recipientEmail,
        subject: params.subject,
        message_id: params.messageId,
        sent_at: new Date(),
        metadata: JSON.stringify(params.metadata || {})
      };

      await db('email_delivery_logs').insert(logEntry);

      logger.debug('Email delivery logged', {
        logId,
        userId: params.userId,
        emailType: params.emailType,
        messageId: params.messageId
      });

      return logId;
    } catch (error) {
      logger.error('Failed to log email delivery', {
        userId: params.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update delivery status
   */
  static async updateDeliveryStatus(
    messageId: string,
    status: 'delivered' | 'bounced' | 'complained',
    details?: {
      bounceReason?: string;
      complaintReason?: string;
      timestamp?: Date;
    }
  ): Promise<boolean> {
    try {
      const updateData: any = {};
      const timestamp = details?.timestamp || new Date();

      switch (status) {
        case 'delivered':
          updateData.delivered_at = timestamp;
          break;
        case 'bounced':
          updateData.bounced_at = timestamp;
          updateData.bounce_reason = details?.bounceReason;
          break;
        case 'complained':
          updateData.complained_at = timestamp;
          updateData.complaint_reason = details?.complaintReason;
          break;
      }

      const updated = await db('email_delivery_logs')
        .where({ message_id: messageId })
        .update(updateData);

      if (updated > 0) {
        logger.info('Email delivery status updated', {
          messageId,
          status,
          details
        });
        return true;
      } else {
        logger.warn('No email delivery log found for message ID', { messageId });
        return false;
      }
    } catch (error) {
      logger.error('Failed to update delivery status', {
        messageId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Handle bounce event
   */
  static async handleBounce(bounceEvent: BounceEvent): Promise<void> {
    try {
      logger.info('Processing bounce event', {
        messageId: bounceEvent.messageId,
        bounceType: bounceEvent.bounceType,
        recipientCount: bounceEvent.bouncedRecipients.length
      });

      // Update delivery log
      await this.updateDeliveryStatus(
        bounceEvent.messageId,
        'bounced',
        {
          bounceReason: `${bounceEvent.bounceType}: ${bounceEvent.bounceSubType}`,
          timestamp: bounceEvent.timestamp
        }
      );

      // Handle permanent bounces
      if (bounceEvent.bounceType === 'permanent') {
        for (const recipient of bounceEvent.bouncedRecipients) {
          await this.handlePermanentBounce(recipient.emailAddress, bounceEvent.messageId);
        }
      }

      // Log bounce details
      await db('email_bounces').insert({
        message_id: bounceEvent.messageId,
        bounce_type: bounceEvent.bounceType,
        bounce_sub_type: bounceEvent.bounceSubType,
        bounced_recipients: JSON.stringify(bounceEvent.bouncedRecipients),
        timestamp: bounceEvent.timestamp,
        created_at: new Date()
      });

    } catch (error) {
      logger.error('Failed to handle bounce event', {
        messageId: bounceEvent.messageId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle complaint event
   */
  static async handleComplaint(complaintEvent: ComplaintEvent): Promise<void> {
    try {
      logger.info('Processing complaint event', {
        messageId: complaintEvent.messageId,
        recipientCount: complaintEvent.complainedRecipients.length
      });

      // Update delivery log
      await this.updateDeliveryStatus(
        complaintEvent.messageId,
        'complained',
        {
          complaintReason: complaintEvent.complaintFeedbackType || 'spam',
          timestamp: complaintEvent.timestamp
        }
      );

      // Handle complaints - automatically unsubscribe users
      for (const recipient of complaintEvent.complainedRecipients) {
        await this.handleSpamComplaint(recipient.emailAddress, complaintEvent.messageId);
      }

      // Log complaint details
      await db('email_complaints').insert({
        message_id: complaintEvent.messageId,
        complained_recipients: JSON.stringify(complaintEvent.complainedRecipients),
        feedback_type: complaintEvent.complaintFeedbackType,
        timestamp: complaintEvent.timestamp,
        created_at: new Date()
      });

    } catch (error) {
      logger.error('Failed to handle complaint event', {
        messageId: complaintEvent.messageId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle permanent bounce - mark email as invalid
   */
  private static async handlePermanentBounce(emailAddress: string, messageId: string): Promise<void> {
    try {
      // Find user by email
      const user = await db('users')
        .where({ email: emailAddress })
        .first();

      if (user) {
        // Mark email as invalid
        await db('users')
          .where({ id: user.id })
          .update({
            email_verified: false,
            email_bounce_count: db.raw('COALESCE(email_bounce_count, 0) + 1'),
            last_bounce_at: new Date()
          });

        // Disable all email notifications for this user
        await db('email_preferences')
          .where({ user_id: user.id })
          .update({
            alert_emails: false,
            marketing_emails: false,
            weekly_digest: false,
            updated_at: new Date()
          });

        logger.warn('User email marked as invalid due to permanent bounce', {
          userId: user.id,
          email: emailAddress,
          messageId
        });
      }
    } catch (error) {
      logger.error('Failed to handle permanent bounce', {
        emailAddress,
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle spam complaint - unsubscribe user
   */
  private static async handleSpamComplaint(emailAddress: string, messageId: string): Promise<void> {
    try {
      // Find user by email
      const user = await db('users')
        .where({ email: emailAddress })
        .first();

      if (user) {
        // Disable all email notifications
        await db('email_preferences')
          .where({ user_id: user.id })
          .update({
            alert_emails: false,
            marketing_emails: false,
            weekly_digest: false,
            updated_at: new Date()
          });

        // Mark user as complained
        await db('users')
          .where({ id: user.id })
          .update({
            email_complaint_count: db.raw('COALESCE(email_complaint_count, 0) + 1'),
            last_complaint_at: new Date()
          });

        logger.warn('User automatically unsubscribed due to spam complaint', {
          userId: user.id,
          email: emailAddress,
          messageId
        });
      }
    } catch (error) {
      logger.error('Failed to handle spam complaint', {
        emailAddress,
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get delivery statistics for a user
   */
  static async getUserDeliveryStats(userId: string): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalBounced: number;
    totalComplained: number;
    deliveryRate: number;
    lastEmailSent?: Date;
  }> {
    try {
      const stats = await db('email_delivery_logs')
        .where({ user_id: userId })
        .select(
          db.raw('COUNT(*) as total_sent'),
          db.raw('SUM(CASE WHEN delivered_at IS NOT NULL THEN 1 ELSE 0 END) as total_delivered'),
          db.raw('SUM(CASE WHEN bounced_at IS NOT NULL THEN 1 ELSE 0 END) as total_bounced'),
          db.raw('SUM(CASE WHEN complained_at IS NOT NULL THEN 1 ELSE 0 END) as total_complained'),
          db.raw('MAX(sent_at) as last_email_sent')
        )
        .first();

      const totalSent = parseInt(stats.total_sent) || 0;
      const totalDelivered = parseInt(stats.total_delivered) || 0;
      const totalBounced = parseInt(stats.total_bounced) || 0;
      const totalComplained = parseInt(stats.total_complained) || 0;

      return {
        totalSent,
        totalDelivered,
        totalBounced,
        totalComplained,
        deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
        lastEmailSent: stats.last_email_sent
      };
    } catch (error) {
      logger.error('Failed to get user delivery stats', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        totalSent: 0,
        totalDelivered: 0,
        totalBounced: 0,
        totalComplained: 0,
        deliveryRate: 0
      };
    }
  }

  /**
   * Clean up old delivery logs
   */
  static async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deleted = await db('email_delivery_logs')
        .where('sent_at', '<', cutoffDate)
        .del();

      logger.info('Cleaned up old email delivery logs', {
        deleted,
        cutoffDate
      });

      return deleted;
    } catch (error) {
      logger.error('Failed to cleanup old delivery logs', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }
}