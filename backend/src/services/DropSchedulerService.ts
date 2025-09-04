import { BaseModel } from '../models/BaseModel';
import { logger } from '../utils/logger';
import { redisService } from './redisService';

type Retailer = { id: string; slug: string; is_active: boolean };

export class DropSchedulerService {
  private static get db() { return BaseModel.getKnex(); }

  /**
   * Refresh predicted windows for popular products and set Redis hot-scan flags.
   * Keeps scope tight to avoid load: top N products, selected retailers.
   */
  static async refreshHotWindows(options: { topProducts?: number; horizonMinutes?: number } = {}): Promise<number> {
    const top = Math.max(5, Math.min(options.topProducts ?? 20, 200));
    const horizon = Math.max(60, Math.min(options.horizonMinutes ?? 180, 1440));
    try {
      const retailers: Retailer[] = await this.db('retailers').select('id', 'slug', 'is_active');
      const activeRetailers = retailers.filter(r => r.is_active && ['best-buy','walmart','target','costco','sams-club'].includes(r.slug));
      if (activeRetailers.length === 0) return 0;

      const products: Array<{ id: string; name?: string|null; set_name?: string|null; sku?: string|null; upc?: string|null }>
        = await this.db('products')
          .select('id', 'name', 'set_name', 'sku', 'upc')
          .where('is_active', true)
          .orderBy('popularity_score', 'desc')
          .limit(top);

      const { DropPredictionService } = await import('./ml/DropPredictionService');
      let setCount = 0;
      for (const p of products) {
        for (const r of activeRetailers) {
          try {
            const preds = await DropPredictionService.predictWindows({ productId: p.id, retailerSlug: r.slug, horizonMinutes: horizon, topK: 2 });
            for (const w of preds) {
              // Set coarse retailer-level hot flag and a product-specific flag until end of window
              const ttlSec = Math.max(30, Math.floor((new Date(w.end).getTime() - Date.now()) / 1000));
              if (ttlSec <= 0) continue;
              await redisService.set(`scan:hot:${r.slug}`, '1', ttlSec);
              await redisService.set(`scan:hot:product:${p.id}:${r.slug}`, JSON.stringify({ start: w.start, end: w.end, conf: w.confidence }), ttlSec);
              setCount++;
            }
          } catch (e) {
            logger.warn('DropSchedulerService prediction failed', { productId: p.id, retailer: r.slug, error: e instanceof Error ? e.message : String(e) });
          }
        }
      }
      return setCount;
    } catch (error) {
      logger.error('DropSchedulerService.refreshHotWindows failed', { error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }

  /**
   * Should we run a higher-cadence scan now?
   */
  static async hasActiveHotWindow(): Promise<boolean> {
    try {
      const keys = await redisService.keys('scan:hot:*');
      return keys.length > 0;
    } catch {
      return false;
    }
  }
}

export const dropSchedulerService = DropSchedulerService;

