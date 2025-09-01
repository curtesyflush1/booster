import { purchaseOrchestrator, PurchaseJob } from './PurchaseOrchestrator';
import { logger } from '../utils/logger';

// Lightweight cache for user plan weights to avoid DB lookups every tick
const weightCache = new Map<string, { weight: number; expiresAt: number }>();
const WEIGHT_TTL_MS = 60_000; // 60s

async function getWeight(userId: string): Promise<number> {
  const cached = weightCache.get(userId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.weight;

  const { getQueuePriorityWeightForUser } = await import('./planPriorityService');
  const weight = await getQueuePriorityWeightForUser(userId);
  weightCache.set(userId, { weight, expiresAt: now + WEIGHT_TTL_MS });
  return weight;
}

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

    // Choose highest-weight job (Premium > Pro > Free). Stable for equal weights (FIFO).
    let bestIdx = 0;
    let bestWeight = -Infinity;
    for (let i = 0; i < queue.length; i++) {
      try {
        const w = await getWeight(queue[i].userId);
        if (w > bestWeight) {
          bestWeight = w;
          bestIdx = i;
        }
      } catch {
        // If weight resolution fails, treat as lowest priority
        if (bestWeight === -Infinity) {
          bestIdx = i;
          bestWeight = 0;
        }
      }
    }

    const job = queue.splice(bestIdx, 1)[0];
    try {
      await purchaseOrchestrator.executePurchase(job);
    } catch (error) {
      logger.error('Purchase job failed unexpectedly', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }, pollMs);
}
