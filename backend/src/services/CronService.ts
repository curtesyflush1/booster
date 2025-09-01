import cron from 'node-cron';
import { logger } from '../utils/logger';
import { AvailabilityPollingService } from './availabilityPollingService';
import { DataCollectionService } from './dataCollectionService';
import { WatchMonitoringService } from './watchMonitoringService';

export class CronService {
  private static started = false;

  static start(): void {
    if (this.started) return;
    this.started = true;

    // Every 5 minutes: scan a batch of products across retailers
    cron.schedule('*/5 * * * *', async () => {
      try {
        logger.info('[Cron] Availability scan started');
        await AvailabilityPollingService.scanBatch();
        // Light maintenance: update watch pack counts occasionally
        await WatchMonitoringService.updateWatchPackSubscriberCounts().catch(() => {});
        logger.info('[Cron] Availability scan completed');
      } catch (error) {
        logger.error('[Cron] Availability scan failed', { error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Hourly: comprehensive data collection (price history, snapshots, analysis)
    cron.schedule('0 * * * *', async () => {
      try {
        logger.info('[Cron] Data collection started');
        await DataCollectionService.runDataCollection();
        logger.info('[Cron] Data collection completed');
      } catch (error) {
        logger.error('[Cron] Data collection failed', { error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Daily at 02:30: cleanup watches and other maintenance
    cron.schedule('30 2 * * *', async () => {
      try {
        logger.info('[Cron] Watch cleanup started');
        await WatchMonitoringService.cleanupWatches();
        logger.info('[Cron] Watch cleanup completed');
      } catch (error) {
        logger.error('[Cron] Watch cleanup failed', { error: error instanceof Error ? error.message : String(error) });
      }
    });

    logger.info('CronService scheduled jobs initialized');
  }
}

