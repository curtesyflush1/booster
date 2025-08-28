import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { Alert } from '../models/Alert';
import { HTTP_TIMEOUTS, RETRY_CONFIG, DEFAULT_VALUES } from '../constants';

interface WebhookConfig {
  id: string;
  userId: string;
  name: string;
  url: string;
  secret?: string;
  isActive: boolean;
  events: WebhookEvent[];
  headers?: Record<string, string>;
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  filters: {
    retailers?: string[];
    categories?: string[];
    priceRange?: { min?: number; max?: number };
    keywords?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
}

type WebhookEvent = 'alert.created' | 'alert.updated' | 'product.restocked' | 'product.price_changed' | 'user.subscription_changed';

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: any;
  signature?: string;
}

interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseTime: number;
  error?: string;
  retryCount: number;
}

export class WebhookService {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private deliveryQueue: Array<{ webhookId: string; payload: WebhookPayload; retryCount: number }> = [];
  private isProcessingQueue = false;

  constructor() {
    // Start processing queue
    this.startQueueProcessor();
  }

  async createWebhook(config: Omit<WebhookConfig, 'id' | 'createdAt' | 'updatedAt' | 'totalCalls' | 'successfulCalls' | 'failedCalls'>): Promise<WebhookConfig> {
    const webhook: WebhookConfig = {
      ...config,
      id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      retryConfig: {
        maxRetries: RETRY_CONFIG.WEBHOOK_DEFAULT_MAX_RETRIES,
        retryDelay: RETRY_CONFIG.WEBHOOK_DEFAULT_RETRY_DELAY,
        backoffMultiplier: RETRY_CONFIG.WEBHOOK_DEFAULT_BACKOFF_MULTIPLIER,
        ...config.retryConfig
      }
    };

    // Validate webhook URL
    await this.validateWebhookUrl(webhook.url);

    this.webhooks.set(webhook.id, webhook);
    logger.info(`Created webhook ${webhook.id} for user ${webhook.userId}`);
    
    return webhook;
  }

  async updateWebhook(webhookId: string, updates: Partial<WebhookConfig>): Promise<WebhookConfig> {
    const existing = this.webhooks.get(webhookId);
    if (!existing) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    // Validate URL if it's being updated
    if (updates.url && updates.url !== existing.url) {
      await this.validateWebhookUrl(updates.url);
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    this.webhooks.set(webhookId, updated);
    logger.info(`Updated webhook ${webhookId}`);
    
    return updated;
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    this.webhooks.delete(webhookId);
    logger.info(`Deleted webhook ${webhookId}`);
  }

  async getWebhook(webhookId: string): Promise<WebhookConfig | null> {
    return this.webhooks.get(webhookId) || null;
  }

  async getUserWebhooks(userId: string): Promise<WebhookConfig[]> {
    return Array.from(this.webhooks.values()).filter(webhook => webhook.userId === userId);
  }

  async getAllWebhooks(): Promise<WebhookConfig[]> {
    return Array.from(this.webhooks.values());
  }

  private async validateWebhookUrl(url: string): Promise<void> {
    try {
      const urlObj = new URL(url);
      
      // Only allow HTTPS in production
      if (process.env.NODE_ENV === 'production' && urlObj.protocol !== 'https:') {
        throw new Error('Webhook URLs must use HTTPS in production');
      }

      // Prevent localhost/private IPs in production
      if (process.env.NODE_ENV === 'production') {
        const hostname = urlObj.hostname;
        if (hostname === 'localhost' || 
            hostname.startsWith('127.') || 
            hostname.startsWith('10.') || 
            hostname.startsWith('192.168.') ||
            (hostname.startsWith('172.') && parseInt(hostname.split('.')[1]) >= 16 && parseInt(hostname.split('.')[1]) <= 31)) {
          throw new Error('Private IP addresses are not allowed for webhooks in production');
        }
      }

      logger.info(`Validated webhook URL: ${url}`);
    } catch (error) {
      logger.error(`Invalid webhook URL ${url}:`, error);
      throw new Error(`Invalid webhook URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async triggerWebhook(event: WebhookEvent, data: any, userId?: string): Promise<void> {
    const webhooks = userId 
      ? this.webhooks.values()
      : Array.from(this.webhooks.values()).filter(webhook => webhook.userId === userId);

    for (const webhook of webhooks) {
      if (!webhook.isActive || !webhook.events.includes(event)) {
        continue;
      }

      // Apply filters for alert events
      if (event.startsWith('alert.') || event.startsWith('product.')) {
        if (!this.shouldTriggerWebhook(data, webhook.filters)) {
          continue;
        }
      }

      const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data
      };

      // Add signature if secret is configured
      if (webhook.secret) {
        payload.signature = this.generateSignature(payload, webhook.secret);
      }

      // Add to delivery queue
      this.deliveryQueue.push({
        webhookId: webhook.id,
        payload,
        retryCount: 0
      });
    }

    // Process queue if not already processing
    if (!this.isProcessingQueue) {
      this.processDeliveryQueue();
    }
  }

  private shouldTriggerWebhook(data: any, filters: WebhookConfig['filters']): boolean {
    // Check retailer filter
    if (filters.retailers && filters.retailers.length > 0 && data.retailerName) {
      if (!filters.retailers.includes(data.retailerName.toLowerCase())) {
        return false;
      }
    }

    // Check price range filter
    if (filters.priceRange && data.price !== undefined) {
      if (filters.priceRange.min && data.price < filters.priceRange.min) {
        return false;
      }
      if (filters.priceRange.max && data.price > filters.priceRange.max) {
        return false;
      }
    }

    // Check keywords filter
    if (filters.keywords && filters.keywords.length > 0 && data.productName) {
      const productNameLower = data.productName.toLowerCase();
      const hasKeyword = filters.keywords.some(keyword => 
        productNameLower.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) {
        return false;
      }
    }

    return true;
  }

  private generateSignature(payload: WebhookPayload, secret: string): string {
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  private async startQueueProcessor(): Promise<void> {
    setInterval(() => {
      if (!this.isProcessingQueue && this.deliveryQueue.length > 0) {
        this.processDeliveryQueue();
      }
    }, INTERVALS.WEBSOCKET_MESSAGE_DELAY); // Check every second
  }

  private async processDeliveryQueue(): Promise<void> {
    if (this.isProcessingQueue || this.deliveryQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.deliveryQueue.length > 0) {
        const item = this.deliveryQueue.shift();
        if (!item) continue;

        const webhook = this.webhooks.get(item.webhookId);
        if (!webhook) continue;

        const result = await this.deliverWebhook(webhook, item.payload);
        
        // Update webhook statistics
        webhook.totalCalls++;
        webhook.lastTriggered = new Date();
        
        if (result.success) {
          webhook.successfulCalls++;
          logger.info(`Webhook ${webhook.id} delivered successfully`);
        } else {
          webhook.failedCalls++;
          
          // Retry if not exceeded max retries
          if (item.retryCount < webhook.retryConfig.maxRetries) {
            const delay = webhook.retryConfig.retryDelay * Math.pow(webhook.retryConfig.backoffMultiplier, item.retryCount);
            
            setTimeout(() => {
              this.deliveryQueue.push({
                ...item,
                retryCount: item.retryCount + 1
              });
            }, delay);
            
            logger.warn(`Webhook ${webhook.id} delivery failed, retrying in ${delay}ms (attempt ${item.retryCount + 1}/${webhook.retryConfig.maxRetries})`);
          } else {
            logger.error(`Webhook ${webhook.id} delivery failed after ${webhook.retryConfig.maxRetries} retries`);
          }
        }

        this.webhooks.set(webhook.id, webhook);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async deliverWebhook(webhook: WebhookConfig, payload: WebhookPayload): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();
    
    try {
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'BoosterBeacon-Webhook/1.0',
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp,
        ...webhook.headers
      };

      if (payload.signature) {
        headers['X-Webhook-Signature'] = `sha256=${payload.signature}`;
      }

      const response: AxiosResponse = await axios.post(webhook.url, payload, {
        headers,
        timeout: HTTP_TIMEOUTS.WEBHOOK_REQUEST,
        validateStatus: (status) => status >= 200 && status < 300
      });

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        statusCode: response.status,
        responseTime,
        retryCount: 0
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      let statusCode: number | undefined;
      let errorMessage = 'Unknown error';

      if (axios.isAxiosError(error)) {
        statusCode = error.response?.status;
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      logger.error(`Webhook delivery failed for ${webhook.id}:`, {
        url: webhook.url,
        error: errorMessage,
        statusCode,
        responseTime
      });

      return {
        success: false,
        statusCode,
        responseTime,
        error: errorMessage,
        retryCount: 0
      };
    }
  }

  async testWebhook(webhookId: string): Promise<WebhookDeliveryResult> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    const testPayload: WebhookPayload = {
      event: 'alert.created',
      timestamp: new Date().toISOString(),
      data: {
        id: 'test-alert-id',
        productName: 'Test Pokémon TCG Product',
        retailerName: 'Test Retailer',
        price: 4.99,
        availability: 'In Stock',
        productUrl: 'https://example.com/test-product',
        isTest: true
      }
    };

    if (webhook.secret) {
      testPayload.signature = this.generateSignature(testPayload, webhook.secret);
    }

    return await this.deliverWebhook(webhook, testPayload);
  }

  async getWebhookStats(webhookId: string): Promise<{
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    successRate: number;
    lastTriggered?: Date;
  }> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    const successRate = webhook.totalCalls > 0 
      ? (webhook.successfulCalls / webhook.totalCalls) * 100 
      : 0;

    return {
      totalCalls: webhook.totalCalls,
      successfulCalls: webhook.successfulCalls,
      failedCalls: webhook.failedCalls,
      successRate: Math.round(successRate * 100) / 100,
      lastTriggered: webhook.lastTriggered
    };
  }
}

export const webhookService = new WebhookService();