import { purchaseOrchestrator, PurchaseJob } from './PurchaseOrchestrator';
import { logger } from '../utils/logger';

const queue: PurchaseJob[] = [];
let workerStarted = false;

export function addJob(job: PurchaseJob): void {
  queue.push(job);
  logger.info('Purchase job enqueued', { retailer: job.retailerSlug, productId: job.productId });
}

export function startWorker(pollMs: number = 5000): void {
  if (workerStarted) return;
  workerStarted = true;
  logger.info('PurchaseQueue worker started', { pollMs });
  setInterval(async () => {
    if (queue.length === 0) return;
    const job = queue.shift()!;
    try {
      await purchaseOrchestrator.executePurchase(job);
    } catch (error) {
      logger.error('Purchase job failed unexpectedly', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }, pollMs);
}

