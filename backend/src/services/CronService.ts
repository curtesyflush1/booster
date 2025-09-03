import cron, { ScheduledTask } from 'node-cron';
import { logger } from '../utils/logger';
import { AvailabilityPollingService } from './availabilityPollingService';
import { DataCollectionService } from './dataCollectionService';
import { PriceDropAlertService } from './priceDropAlertService';
import { MLTrainingETLService } from './ml/MLTrainingETLService';
import { PricePredictionModelRunner } from './ml/PricePredictionModelRunner';
import { WatchMonitoringService } from './watchMonitoringService';
import parser from 'cron-parser';

export class CronService {
  private static started = false;
  private static jobs: Record<string, {
    name: string;
    cron: string;
    task: ScheduledTask;
    lastRunStartedAt?: Date;
    lastRunEndedAt?: Date;
    lastDurationMs?: number;
    lastSuccessAt?: Date;
    lastError?: string;
  }> = {};

  private static registerJob(name: string, cronExpr: string, fn: () => Promise<void>): void {
    const task = cron.schedule(cronExpr, async () => {
      const meta = this.jobs[name];
      try {
        meta.lastRunStartedAt = new Date();
        await fn();
        meta.lastRunEndedAt = new Date();
        meta.lastDurationMs = meta.lastRunEndedAt.getTime() - meta.lastRunStartedAt.getTime();
        meta.lastSuccessAt = meta.lastRunEndedAt;
        meta.lastError = undefined;
      } catch (error) {
        meta.lastRunEndedAt = new Date();
        meta.lastDurationMs = meta.lastRunEndedAt.getTime() - (meta.lastRunStartedAt?.getTime() || meta.lastRunEndedAt.getTime());
        meta.lastError = error instanceof Error ? error.message : String(error);
      }
    });

    this.jobs[name] = { name, cron: cronExpr, task };
  }

  static getStatus(): Array<{
    name: string;
    cron: string;
    lastRunStartedAt?: Date;
    lastRunEndedAt?: Date;
    lastDurationMs?: number;
    lastSuccessAt?: Date;
    lastError?: string;
    nextRunAt?: Date;
  }> {
    const out: Array<any> = [];
    for (const name of Object.keys(this.jobs)) {
      const meta = this.jobs[name]!;
      let nextRunAt: Date | undefined;
      try {
        const it = parser.parseExpression(meta.cron, { currentDate: new Date() });
        nextRunAt = it.next().toDate();
      } catch {}
      out.push({
        name: meta.name,
        cron: meta.cron,
        lastRunStartedAt: meta.lastRunStartedAt,
        lastRunEndedAt: meta.lastRunEndedAt,
        lastDurationMs: meta.lastDurationMs,
        lastSuccessAt: meta.lastSuccessAt,
        lastError: meta.lastError,
        nextRunAt,
      });
    }
    return out;
  }

  static start(): void {
    if (this.started) return;
    this.started = true;

    // Every 5 minutes: scan a batch of products across retailers
    this.registerJob('availability_scan', '*/5 * * * *', async () => {
      logger.info('[Cron] Availability scan started');
      await AvailabilityPollingService.scanBatch();
      // Light maintenance: update watch pack counts occasionally
      await WatchMonitoringService.updateWatchPackSubscriberCounts().catch(() => {});
      logger.info('[Cron] Availability scan completed');
    });

    // Hourly: comprehensive data collection (price history, snapshots, analysis)
    this.registerJob('data_collection', '0 * * * *', async () => {
      logger.info('[Cron] Data collection started');
      await DataCollectionService.runDataCollection();
      logger.info('[Cron] Data collection completed');
    });

    // Every 3 hours: catalog discovery & ingestion (Pokemon TCG)
    this.registerJob('catalog_ingestion', '0 */3 * * *', async () => {
      const { CatalogIngestionService } = await import('./catalogIngestionService');
      logger.info('[Cron] Catalog ingestion started');
      await CatalogIngestionService.discoverAndIngest();
      logger.info('[Cron] Catalog ingestion completed');
    });

    // Every 10 minutes: monitor price changes and send price-drop alerts
    this.registerJob('price_drop_monitoring', '*/10 * * * *', async () => {
      logger.info('[Cron] Price drop monitoring started');
      await PriceDropAlertService.monitorPriceChanges();
      logger.info('[Cron] Price drop monitoring completed');
    });

    // Daily at 02:30: cleanup watches and other maintenance
    this.registerJob('watch_cleanup', '30 2 * * *', async () => {
      logger.info('[Cron] Watch cleanup started');
      await WatchMonitoringService.cleanupWatches();
      logger.info('[Cron] Watch cleanup completed');
    });

    // Daily at 00:00: ML ETL + model training
    this.registerJob('ml_pipeline', '0 0 * * *', async () => {
      logger.info('[Cron] ML ETL started');
      await MLTrainingETLService.run();
      logger.info('[Cron] ML ETL completed; training model');
      const runner = new PricePredictionModelRunner();
      await runner.train();
      logger.info('[Cron] ML training completed');
    });

    logger.info('CronService scheduled jobs initialized');
  }
}
