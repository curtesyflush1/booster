import { BaseModel } from '../models/BaseModel';
import { logger } from '../utils/logger';
import { addJob as enqueuePurchase } from './PurchaseQueue';

/**
 * Watches predicted windows and enqueues staged purchase attempts for users
 * who have auto_purchase enabled for the product/retailer.
 *
 * Phase hooks (approximation):
 * - T-2m: prefetch map via light enqueue (qty 0 -> noop checkout flow warmup in BrowserApiService)
 * - T-30s: low QPS add-to-cart stage (1 job)
 * - T-0: burst for premium users first (queue handles priority weighting)
 */
export class PredictionOrchestrationService {
  private static get db() { return BaseModel.getKnex(); }

  static async runOnce(): Promise<number> {
    const now = Date.now();
    try {
      // Pull all active hot product windows from Redis via DB fallback: look at last 10 minutes of url_candidates for hints
      // Simpler: query product-level hot flags in Redis by scanning DB for active watches
      const watches: Array<{ id: string; user_id: string; product_id: string; retailer_ids: string[] | null; auto_purchase: any; max_price?: number|null }>
        = await this.db('watches')
          .select('watches.id', 'watches.user_id', 'watches.product_id', 'watches.retailer_ids', 'watches.auto_purchase', 'watches.max_price')
          .where('watches.is_active', true)
          .whereNotNull('watches.auto_purchase');

      if (watches.length === 0) return 0;

      // Map retailer id -> slug
      const retailerRows: Array<{ id: string; slug: string }> = await this.db('retailers').select('id','slug');
      const idToSlug = new Map(retailerRows.map(r => [r.id, r.slug] as const));

      let enqueued = 0;
      for (const w of watches) {
        const retailers = Array.isArray(w.retailer_ids) && w.retailer_ids.length ? w.retailer_ids : retailerRows.map(r => r.id);
        for (const rid of retailers) {
          const slug = idToSlug.get(rid);
          if (!slug) continue;
          // Read hot window from Redis for this product/retailer
          try {
            const { redisService } = await import('./redisService');
            const key = `scan:hot:product:${w.product_id}:${slug}`;
            const val = await redisService.get(key);
            if (!val) continue;
            const meta = JSON.parse(val) as { start: string; end: string; conf: number };
            const startMs = new Date(meta.start).getTime();
            const delta = startMs - now;
            // Stage actions near window
            const ap = w.auto_purchase || {};
            const maxPrice = Number(w.max_price || ap.max_price || 0) || undefined;
            const jobBase = { userId: w.user_id, productId: w.product_id, retailerSlug: slug, qty: ap.qty || 1, maxPrice };

            if (delta <= 0 && delta > -20_000) {
              // T-0..-20s: burst (enqueue 2 jobs spaced by queue worker pacing)
              enqueuePurchase({ ...jobBase });
              enqueuePurchase({ ...jobBase });
              enqueued += 2;
            } else if (delta <= 30_000) {
              // T-30s: single staged add-to-cart
              enqueuePurchase({ ...jobBase });
              enqueued += 1;
            } else if (delta <= 120_000) {
              // T-2m: light prewarm (noop path uses BrowserApiService stub)
              enqueuePurchase({ ...jobBase, qty: 0 });
              enqueued += 1;
            }
          } catch (e) {
            logger.warn('PredictionOrchestration window check failed', { watchId: w.id, retailerId: rid, error: e instanceof Error ? e.message : String(e) });
          }
        }
      }
      if (enqueued > 0) {
        logger.info('PredictionOrchestration enqueued purchases', { count: enqueued });
      }
      return enqueued;
    } catch (error) {
      logger.error('PredictionOrchestrationService.runOnce failed', { error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }
}

export const predictionOrchestrationService = PredictionOrchestrationService;
