import { Product } from '../models/Product';
import { logger } from '../utils/logger';
import { PerformanceTracker } from '../utils/encryption/performanceTracker';

enum AnalyticsEventType {
  PRODUCT_VIEW = 'product_view',
  PRODUCT_SCAN = 'product_scan',
  PRODUCT_SEARCH = 'product_search'
}

interface AnalyticsEvent {
  type: AnalyticsEventType;
  productId: string;
  weight: number;
  metadata?: Record<string, any>;
}

// Event weight constants for consistency
const EVENT_WEIGHTS = {
  VIEW: 1,
  SCAN: 2,
  SEARCH: 0.5
} as const;

interface AnalyticsConfig {
  batchSize?: number;
  processInterval?: number;
  maxQueueSize?: number;
  enablePerformanceTracking?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

class AnalyticsService {
  private eventQueue: AnalyticsEvent[] = [];
  private processing = false;
  private readonly BATCH_SIZE: number;
  private readonly PROCESS_INTERVAL: number;
  private readonly MAX_QUEUE_SIZE: number;
  private readonly RETRY_ATTEMPTS: number;
  private readonly RETRY_DELAY: number;
  private intervalId: NodeJS.Timeout;
  private performanceTracker?: PerformanceTracker;
  private failedEvents: AnalyticsEvent[] = [];

  constructor(config: AnalyticsConfig = {}) {
    this.BATCH_SIZE = config.batchSize ?? 10;
    this.PROCESS_INTERVAL = config.processInterval ?? 5000; // 5 seconds
    this.MAX_QUEUE_SIZE = config.maxQueueSize ?? 1000;
    this.RETRY_ATTEMPTS = config.retryAttempts ?? 3;
    this.RETRY_DELAY = config.retryDelay ?? 1000;
    
    if (config.enablePerformanceTracking) {
      this.performanceTracker = new PerformanceTracker({
        enableWarnings: true,
        slowOperationThreshold: 500 // 500ms threshold for analytics operations
      });
    }
    
    // Process events periodically
    this.intervalId = setInterval(() => this.processEvents(), this.PROCESS_INTERVAL);
  }

  /**
   * Track a product view event
   */
  trackProductView(productId: string, metadata?: Record<string, any>): void {
    if (!this.isValidProductId(productId)) {
      logger.warn('Invalid product ID for view tracking', { productId });
      return;
    }
    this.addEvent(this.createEvent(AnalyticsEventType.PRODUCT_VIEW, productId, EVENT_WEIGHTS.VIEW, metadata));
  }

  /**
   * Track a product barcode scan event
   */
  trackProductScan(productId: string, metadata?: Record<string, any>): void {
    if (!this.isValidProductId(productId)) {
      logger.warn('Invalid product ID for scan tracking', { productId });
      return;
    }
    this.addEvent(this.createEvent(AnalyticsEventType.PRODUCT_SCAN, productId, EVENT_WEIGHTS.SCAN, metadata));
  }

  /**
   * Create an analytics event with optional metadata
   */
  private createEvent(
    type: AnalyticsEventType, 
    productId: string, 
    weight: number, 
    metadata?: Record<string, any>
  ): AnalyticsEvent {
    const event: AnalyticsEvent = { type, productId, weight };
    if (metadata) {
      event.metadata = metadata;
    }
    return event;
  }

  /**
   * Validate product ID format (UUID)
   */
  private isValidProductId(productId: string): boolean {
    if (!productId || typeof productId !== 'string') {
      return false;
    }
    // UUID v4 regex pattern
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(productId);
  }

  /**
   * Track a product search event
   */
  trackProductSearch(searchTerm: string, resultCount: number): void {
    if (!searchTerm?.trim() || resultCount < 0) {
      logger.warn('Invalid search parameters', { searchTerm, resultCount });
      return;
    }
    logger.info('Product search tracked', { searchTerm, resultCount });
    // Could track search analytics here in the future
  }

  private addEvent(event: AnalyticsEvent): void {
    // Prevent memory leaks by limiting queue size
    if (this.eventQueue.length >= this.MAX_QUEUE_SIZE) {
      logger.warn('Analytics queue full, dropping oldest events', { 
        queueSize: this.eventQueue.length,
        maxSize: this.MAX_QUEUE_SIZE 
      });
      this.eventQueue.splice(0, this.BATCH_SIZE); // Remove oldest events
    }
    
    this.eventQueue.push(event);

    // Process immediately if queue is getting large
    if (this.eventQueue.length >= this.BATCH_SIZE && !this.processing) {
      this.processEvents().catch(error => 
        logger.error('Failed to process events immediately', { error: error.message })
      );
    }
  }

  private async processEvents(): Promise<void> {
    if (this.processing || (this.eventQueue.length === 0 && this.failedEvents.length === 0)) {
      return;
    }

    this.processing = true;
    
    const processOperation = async () => {
      // Process failed events first (retry mechanism)
      const eventsToProcess = [
        ...this.failedEvents.splice(0, this.BATCH_SIZE),
        ...this.eventQueue.splice(0, Math.max(0, this.BATCH_SIZE - this.failedEvents.length))
      ];

      if (eventsToProcess.length === 0) {
        return;
      }

      // Group events by product ID to batch updates
      const popularityUpdates = new Map<string, number>();

      for (const event of eventsToProcess) {
        const currentWeight = popularityUpdates.get(event.productId) || 0;
        popularityUpdates.set(event.productId, currentWeight + event.weight);
      }

      // Process popularity updates with retry logic
      const results = await Promise.allSettled(
        Array.from(popularityUpdates.entries()).map(
          ([productId, weight]) => this.updatePopularityWithRetry(productId, weight)
        )
      );

      // Track failed updates for retry
      const failedUpdates: AnalyticsEvent[] = [];
      const updateEntries = Array.from(popularityUpdates.entries());
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const entry = updateEntries[index];
          if (entry) {
            const [productId] = entry;
            // Find original events for this product to retry
            const originalEvents = eventsToProcess.filter(e => e.productId === productId);
            failedUpdates.push(...originalEvents);
          }
        }
      });

      // Add failed events back to retry queue (with limit)
      if (failedUpdates.length > 0 && this.failedEvents.length < this.MAX_QUEUE_SIZE / 2) {
        this.failedEvents.push(...failedUpdates);
        logger.warn('Added failed events to retry queue', { 
          failedCount: failedUpdates.length,
          retryQueueSize: this.failedEvents.length 
        });
      }

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      logger.debug('Processed analytics events', {
        eventCount: eventsToProcess.length,
        productUpdates: popularityUpdates.size,
        successCount,
        failedCount: results.length - successCount
      });
    };

    try {
      if (this.performanceTracker) {
        await this.performanceTracker.trackOperation('analytics-process-events', processOperation);
      } else {
        await processOperation();
      }
    } catch (error) {
      logger.error('Error processing analytics events', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      this.processing = false;
    }
  }

  private async updatePopularityWithRetry(productId: string, weight: number): Promise<void> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.RETRY_ATTEMPTS; attempt++) {
      try {
        await Product.incrementPopularity(productId, weight);
        
        // Log successful retry if it wasn't the first attempt
        if (attempt > 1) {
          logger.info('Popularity update succeeded after retry', { 
            productId, 
            weight, 
            attempt 
          });
        }
        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Log the specific error for debugging
        logger.debug('Popularity update attempt failed', {
          productId,
          weight,
          attempt,
          error: lastError.message,
          errorType: lastError.constructor.name
        });
        
        if (attempt < this.RETRY_ATTEMPTS) {
          // Exponential backoff with jitter to prevent thundering herd
          const baseDelay = this.RETRY_DELAY * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 0.1 * baseDelay; // 10% jitter
          const delay = baseDelay + jitter;
          
          await new Promise(resolve => setTimeout(resolve, delay));
          logger.debug('Retrying popularity update', { 
            productId, 
            weight, 
            attempt: attempt + 1,
            nextDelay: delay 
          });
        }
      }
    }
    
    logger.warn('Failed to update popularity after all retries', { 
      productId, 
      weight, 
      attempts: this.RETRY_ATTEMPTS,
      error: lastError?.message,
      errorType: lastError?.constructor.name
    });
    throw lastError;
  }

  /**
   * Flush all pending events (useful for graceful shutdown)
   */
  async flush(): Promise<void> {
    while (this.eventQueue.length > 0) {
      await this.processEvents();
      // Small delay to prevent tight loop
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Get performance metrics if tracking is enabled
   */
  getPerformanceMetrics(): Record<string, any> | null {
    return this.performanceTracker?.getMetrics() || null;
  }

  /**
   * Get service health information
   */
  getHealthInfo(): {
    queueSize: number;
    failedEventsCount: number;
    isProcessing: boolean;
    performanceMetrics: Record<string, any> | null;
  } {
    return {
      queueSize: this.eventQueue.length,
      failedEventsCount: this.failedEvents.length,
      isProcessing: this.processing,
      performanceMetrics: this.getPerformanceMetrics()
    };
  }

  /**
   * Cleanup resources (stop interval timer)
   */
  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

// Export singleton instance with default configuration
export const analyticsService = new AnalyticsService();

// Export class for testing or custom configurations
export { AnalyticsService };