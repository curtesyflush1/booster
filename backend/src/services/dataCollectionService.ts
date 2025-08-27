import { logger } from '../utils/logger';
import { BaseModel } from '../models/BaseModel';
import { Product } from '../models/Product';
import { handleDatabaseError } from '../config/database';

export interface DataCollectionConfig {
  priceHistoryRetentionDays: number;
  availabilitySnapshotIntervalMinutes: number;
  engagementMetricsIntervalHours: number;
  batchSize: number;
}

export class DataCollectionService extends BaseModel<any> {
  
  // Required BaseModel methods (not used for this service)
  validate(data: any): any[] {
    return [];
  }
  
  sanitize(data: any): any {
    return data;
  }
  private static config: DataCollectionConfig = {
    priceHistoryRetentionDays: 365,
    availabilitySnapshotIntervalMinutes: 30,
    engagementMetricsIntervalHours: 6,
    batchSize: 100
  };

  /**
   * Collect and store price history data from current availability
   */
  static async collectPriceHistory(): Promise<void> {
    try {
      logger.info('Starting price history collection...');

      // Get current availability data
      const availabilityData = await this.db('product_availability')
        .select(
          'product_id',
          'retailer_id',
          'price',
          'original_price',
          'in_stock',
          'availability_status'
        )
        .whereNotNull('price');

      if (availabilityData.length === 0) {
        logger.info('No availability data found for price history collection');
        return;
      }

      // Prepare price history records
      const priceHistoryRecords = availabilityData.map(record => ({
        product_id: record.product_id,
        retailer_id: record.retailer_id,
        price: record.price,
        original_price: record.original_price,
        in_stock: record.in_stock,
        availability_status: record.availability_status,
        recorded_at: new Date()
      }));

      // Insert in batches
      const batchSize = this.config.batchSize;
      for (let i = 0; i < priceHistoryRecords.length; i += batchSize) {
        const batch = priceHistoryRecords.slice(i, i + batchSize);
        await this.db('price_history').insert(batch);
      }

      logger.info(`Collected price history for ${priceHistoryRecords.length} product-retailer combinations`);
    } catch (error) {
      logger.error('Error collecting price history:', error);
      throw handleDatabaseError(error);
    }
  }

  /**
   * Collect engagement metrics for hype calculation
   */
  static async collectEngagementMetrics(): Promise<void> {
    try {
      logger.info('Starting engagement metrics collection...');

      // Update product popularity scores based on recent activity
      const engagementData = await this.db('products')
        .select(
          'products.id',
          'products.popularity_score',
          this.db.raw('COUNT(DISTINCT watches.id) as watch_count'),
          this.db.raw('COUNT(DISTINCT alerts.id) as alert_count'),
          this.db.raw('COUNT(DISTINCT CASE WHEN alerts.clicked_at IS NOT NULL THEN alerts.id END) as clicked_alerts')
        )
        .leftJoin('watches', function() {
          this.on('products.id', 'watches.product_id')
              .andOn('watches.is_active', '=', DataCollectionService.db.raw('?', [true]))
              .andOn('watches.created_at', '>=', DataCollectionService.db.raw('?', [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)]));
        })
        .leftJoin('alerts', function() {
          this.on('products.id', 'alerts.product_id')
              .andOn('alerts.created_at', '>=', DataCollectionService.db.raw('?', [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)]));
        })
        .where('products.is_active', true)
        .groupBy('products.id', 'products.popularity_score');

      // Calculate new popularity scores
      const updates = engagementData.map(product => {
        const watchCount = parseInt(product.watch_count || '0');
        const alertCount = parseInt(product.alert_count || '0');
        const clickedAlerts = parseInt(product.clicked_alerts || '0');
        
        // Calculate engagement score
        let engagementScore = 0;
        engagementScore += watchCount * 2; // Each watch adds 2 points
        engagementScore += alertCount * 1; // Each alert adds 1 point
        engagementScore += clickedAlerts * 3; // Each click adds 3 points
        
        // Blend with existing popularity score (70% new, 30% existing)
        const currentScore = product.popularity_score || 0;
        const newScore = Math.min(1000, Math.round(engagementScore * 0.7 + currentScore * 0.3));
        
        return {
          id: product.id,
          newScore
        };
      });

      // Update popularity scores in batches
      const batchSize = this.config.batchSize;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        // Use a transaction for batch updates
        await this.db.transaction(async (trx) => {
          for (const update of batch) {
            await trx('products')
              .where('id', update.id)
              .update({
                popularity_score: update.newScore,
                updated_at: new Date()
              });
          }
        });
      }

      logger.info(`Updated popularity scores for ${updates.length} products`);
    } catch (error) {
      logger.error('Error collecting engagement metrics:', error);
      throw handleDatabaseError(error);
    }
  }

  /**
   * Clean up old historical data to manage storage
   */
  static async cleanupOldData(): Promise<void> {
    try {
      logger.info('Starting data cleanup...');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.priceHistoryRetentionDays);

      // Clean up old price history
      const deletedPriceHistory = await this.db('price_history')
        .where('recorded_at', '<', cutoffDate)
        .del();

      logger.info(`Cleaned up ${deletedPriceHistory} old price history records`);

      // Clean up old alert deliveries (keep for 90 days)
      const alertCutoffDate = new Date();
      alertCutoffDate.setDate(alertCutoffDate.getDate() - 90);

      const deletedAlertDeliveries = await this.db('alert_deliveries')
        .where('created_at', '<', alertCutoffDate)
        .whereIn('status', ['delivered', 'failed', 'bounced'])
        .del();

      logger.info(`Cleaned up ${deletedAlertDeliveries} old alert delivery records`);

      // Clean up old system health records (keep for 30 days)
      const healthCutoffDate = new Date();
      healthCutoffDate.setDate(healthCutoffDate.getDate() - 30);

      const deletedHealthRecords = await this.db('system_health')
        .where('checked_at', '<', healthCutoffDate)
        .del();

      logger.info(`Cleaned up ${deletedHealthRecords} old system health records`);

    } catch (error) {
      logger.error('Error during data cleanup:', error);
      throw handleDatabaseError(error);
    }
  }

  /**
   * Collect availability snapshots for trend analysis
   */
  static async collectAvailabilitySnapshots(): Promise<void> {
    try {
      logger.info('Starting availability snapshot collection...');

      // Get current availability status for all products
      const availabilitySnapshots = await this.db('product_availability')
        .select(
          'product_id',
          'retailer_id',
          'in_stock',
          'availability_status',
          'stock_level',
          'last_checked'
        );

      if (availabilitySnapshots.length === 0) {
        logger.info('No availability data found for snapshot collection');
        return;
      }

      // Store snapshots in a dedicated table (create if needed)
      await this.ensureAvailabilitySnapshotsTable();

      const snapshotRecords = availabilitySnapshots.map(snapshot => ({
        ...snapshot,
        snapshot_time: new Date()
      }));

      // Insert in batches
      const batchSize = this.config.batchSize;
      for (let i = 0; i < snapshotRecords.length; i += batchSize) {
        const batch = snapshotRecords.slice(i, i + batchSize);
        await this.db('availability_snapshots').insert(batch);
      }

      logger.info(`Collected ${snapshotRecords.length} availability snapshots`);
    } catch (error) {
      logger.error('Error collecting availability snapshots:', error);
      throw handleDatabaseError(error);
    }
  }

  /**
   * Analyze and update product trends
   */
  static async analyzeProductTrends(): Promise<void> {
    try {
      logger.info('Starting product trend analysis...');

      // Get products with sufficient data for trend analysis
      const products = await this.db('products')
        .select('id', 'name')
        .where('is_active', true)
        .whereExists(function() {
          this.select('*')
              .from('price_history')
              .whereRaw('price_history.product_id = products.id')
              .where('recorded_at', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
        });

      const trendAnalysis = [];

      for (const product of products) {
        // Calculate price trend
        const priceData = await this.db('price_history')
          .select('price', 'recorded_at')
          .where('product_id', product.id)
          .where('recorded_at', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
          .orderBy('recorded_at', 'asc');

        if (priceData.length >= 5) {
          const priceTrend = this.calculateTrend(priceData.map(p => ({
            value: parseFloat(p.price),
            date: new Date(p.recorded_at)
          })));

          // Calculate availability trend
          const availabilityData = await this.db('product_availability')
            .select('in_stock', 'last_checked')
            .where('product_id', product.id)
            .where('last_checked', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
            .orderBy('last_checked', 'asc');

          const availabilityTrend = this.calculateTrend(availabilityData.map(a => ({
            value: a.in_stock ? 1 : 0,
            date: new Date(a.last_checked)
          })));

          trendAnalysis.push({
            productId: product.id,
            priceTrend,
            availabilityTrend,
            analyzedAt: new Date()
          });
        }
      }

      // Store trend analysis results
      await this.ensureTrendAnalysisTable();
      
      if (trendAnalysis.length > 0) {
        // Clear old analysis for these products
        const productIds = trendAnalysis.map(t => t.productId);
        await this.db('trend_analysis')
          .whereIn('product_id', productIds)
          .del();

        // Insert new analysis
        const analysisRecords = trendAnalysis.map(analysis => ({
          product_id: analysis.productId,
          price_trend: analysis.priceTrend,
          availability_trend: analysis.availabilityTrend,
          analyzed_at: analysis.analyzedAt
        }));

        await this.db('trend_analysis').insert(analysisRecords);
      }

      logger.info(`Analyzed trends for ${trendAnalysis.length} products`);
    } catch (error) {
      logger.error('Error analyzing product trends:', error);
      throw handleDatabaseError(error);
    }
  }

  /**
   * Run all data collection tasks
   */
  static async runDataCollection(): Promise<void> {
    try {
      logger.info('Starting comprehensive data collection...');

      await Promise.all([
        this.collectPriceHistory(),
        this.collectEngagementMetrics(),
        this.collectAvailabilitySnapshots()
      ]);

      await this.analyzeProductTrends();
      
      logger.info('Data collection completed successfully');
    } catch (error) {
      logger.error('Error during data collection:', error);
      throw error;
    }
  }

  /**
   * Schedule data collection tasks
   */
  static scheduleDataCollection(): void {
    // Price history collection every 30 minutes
    setInterval(async () => {
      try {
        await this.collectPriceHistory();
      } catch (error) {
        logger.error('Scheduled price history collection failed:', error);
      }
    }, this.config.availabilitySnapshotIntervalMinutes * 60 * 1000);

    // Engagement metrics every 6 hours
    setInterval(async () => {
      try {
        await this.collectEngagementMetrics();
      } catch (error) {
        logger.error('Scheduled engagement metrics collection failed:', error);
      }
    }, this.config.engagementMetricsIntervalHours * 60 * 60 * 1000);

    // Availability snapshots every 30 minutes
    setInterval(async () => {
      try {
        await this.collectAvailabilitySnapshots();
      } catch (error) {
        logger.error('Scheduled availability snapshot collection failed:', error);
      }
    }, this.config.availabilitySnapshotIntervalMinutes * 60 * 1000);

    // Trend analysis every 24 hours
    setInterval(async () => {
      try {
        await this.analyzeProductTrends();
      } catch (error) {
        logger.error('Scheduled trend analysis failed:', error);
      }
    }, 24 * 60 * 60 * 1000);

    // Data cleanup every 7 days
    setInterval(async () => {
      try {
        await this.cleanupOldData();
      } catch (error) {
        logger.error('Scheduled data cleanup failed:', error);
      }
    }, 7 * 24 * 60 * 60 * 1000);

    logger.info('Data collection tasks scheduled successfully');
  }

  // Helper methods

  private static calculateTrend(data: Array<{ value: number; date: Date }>): number {
    if (data.length < 2) return 0;

    const n = data.length;
    const sumX = data.reduce((sum, _, i) => sum + i, 0);
    const sumY = data.reduce((sum, point) => sum + point.value, 0);
    const sumXY = data.reduce((sum, point, i) => sum + i * point.value, 0);
    const sumXX = data.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return isNaN(slope) ? 0 : slope;
  }

  private static async ensureAvailabilitySnapshotsTable(): Promise<void> {
    const exists = await this.db.schema.hasTable('availability_snapshots');
    if (!exists) {
      await this.db.schema.createTable('availability_snapshots', (table) => {
        table.uuid('id').primary().defaultTo(this.db.raw('gen_random_uuid()'));
        table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
        table.uuid('retailer_id').notNullable().references('id').inTable('retailers').onDelete('CASCADE');
        table.boolean('in_stock').notNullable();
        table.string('availability_status');
        table.integer('stock_level');
        table.timestamp('last_checked');
        table.timestamp('snapshot_time').defaultTo(this.db.fn.now());
        
        table.index(['product_id', 'snapshot_time']);
        table.index(['retailer_id', 'snapshot_time']);
      });
    }
  }

  private static async ensureTrendAnalysisTable(): Promise<void> {
    const exists = await this.db.schema.hasTable('trend_analysis');
    if (!exists) {
      await this.db.schema.createTable('trend_analysis', (table) => {
        table.uuid('id').primary().defaultTo(this.db.raw('gen_random_uuid()'));
        table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
        table.decimal('price_trend', 10, 6);
        table.decimal('availability_trend', 10, 6);
        table.timestamp('analyzed_at').defaultTo(this.db.fn.now());
        
        table.index('product_id');
        table.index('analyzed_at');
      });
    }
  }
}