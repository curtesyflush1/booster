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
  deliveryLogId?: number;
}

export interface EmailSendParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  metadata?: Record<string, any>;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailValidationResult {
  canSend: boolean;
  reason?: string;
}

export interface EmailDeliveryLogParams {
  userId: number;
  alertId?: number;
  emailType: 'alert' | 'welcome' | 'system' | 'marketing' | 'digest';
  recipientEmail: string;
  subject: string;
  messageId?: string;
  metadata: Record<string, any>;
}

export interface EmailStats {
  emailsSent: number;
  emailsDelivered: number;
  emailsBounced: number;
  emailsComplained: number;
  deliveryRate: number;
  bounceRate: number;
  complaintRate: number;
}

export interface BounceWebhookData {
  eventType: 'bounce';
  messageId: string;
  bounceType: 'permanent' | 'transient';
  bounceSubType: string;
  bouncedRecipients: Array<{
    emailAddress: string;
    status: string;
    action: string;
    diagnosticCode?: string;
  }>;
  timestamp: string;
}

export interface ComplaintWebhookData {
  eventType: 'complaint';
  messageId: string;
  complainedRecipients: Array<{
    emailAddress: string;
  }>;
  timestamp: string;
  complaintFeedbackType?: string;
}

export interface DeliveryWebhookData {
  eventType: 'delivery';
  messageId: string;
  timestamp: string;
}

export type EmailWebhookData = BounceWebhookData | ComplaintWebhookData | DeliveryWebhookData;

export class EmailError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'EmailError';
  }
}

export class EmailValidationError extends EmailError {
  constructor(message: string, originalError?: Error) {
    super(message, 'EMAIL_VALIDATION_ERROR', originalError);
    this.name = 'EmailValidationError';
  }
}

export class EmailTransportError extends EmailError {
  constructor(message: string, originalError?: Error) {
    super(message, 'EMAIL_TRANSPORT_ERROR', originalError);
    this.name = 'EmailTransportError';
  }
}

export class EmailTemplateError extends EmailError {
  constructor(message: string, originalError?: Error) {
    super(message, 'EMAIL_TEMPLATE_ERROR', originalError);
    this.name = 'EmailTemplateError';
  }
}