import { BaseModel } from '../../models/BaseModel';
import { logger } from '../../utils/logger';

export type DropPredictionQuery = {
  productId?: string;
  setName?: string;
  retailerSlug?: string;
  horizonMinutes?: number; // how far ahead to search for windows
  topK?: number; // number of windows to return
};

export type PredictedWindow = {
  retailerId: string; // slug
  start: string; // ISO timestamp
  end: string;   // ISO timestamp
  confidence: number; // 0-100
  rationale: string[];
  shadowProb?: number; // optional shadow classifier probability
};

export class DropPredictionService {
  private static get db() { return BaseModel.getKnex(); }

  static async predictWindows(query: DropPredictionQuery): Promise<PredictedWindow[]> {
    const horizon = Math.min(Math.max(query.horizonMinutes ?? 180, 30), 24 * 60); // clamp 30m..24h
    const topK = Math.min(Math.max(query.topK ?? 3, 1), 5);
    const retailerSlug = query.retailerSlug ?? 'best-buy';
    const now = new Date();

    try {
      // Prefer trained model weights when available
      try {
        const { dropWindowModelRunner } = await import('./DropWindowModelRunner');
        const weights = dropWindowModelRunner.getRetailerHourWeights(retailerSlug);
        if (weights) {
          const ranked = weights
            .map((w, h) => ({ h, w }))
            .sort((a,b)=>b.w-a.w)
            .slice(0, topK);
          const out: PredictedWindow[] = [];
          for (const r of ranked) {
            const start = new Date(now);
            start.setUTCMinutes(0,0,0);
            if (start.getUTCHours() >= r.h) start.setUTCDate(start.getUTCDate() + 1);
            start.setUTCHours(r.h);
            const end = new Date(start.getTime() + 60*60*1000);
            if (start.getTime() - now.getTime() <= horizon * 60 * 1000) {
              out.push({ retailerId: retailerSlug, start: start.toISOString(), end: end.toISOString(), confidence: Math.round(r.w*100), rationale: ['trained_hour_histogram'] });
            }
          }
          if (out.length) return out;
        }
      } catch {}

      // If we have product-level history, derive simple hour-of-day histogram from availability_snapshots
      if (query.productId) {
        const rows: Array<{ snapshot_time: Date; retailer_id: string; in_stock: boolean }>
          = await this.db('availability_snapshots')
            .select('snapshot_time', 'retailer_id', 'in_stock')
            .where('product_id', query.productId)
            .andWhere('snapshot_time', '>=', new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000))
            .orderBy('snapshot_time', 'asc')
            .limit(5000);

        if (rows.length > 0) {
          // Build hour-of-day frequency for when items are in stock
          const byHour: Record<number, number> = {};
          for (const r of rows) {
            if (!r.in_stock) continue;
            const hr = new Date(r.snapshot_time).getUTCHours();
            byHour[hr] = (byHour[hr] || 0) + 1;
          }
          const ranked = Object.entries(byHour).sort((a,b) => b[1] - a[1]).slice(0, topK);
          if (ranked.length > 0) {
            const total = Object.values(byHour).reduce((s, v) => s + v, 0) || 1;
            const out: PredictedWindow[] = [];
            for (const [hourStr, cnt] of ranked) {
              const hour = Number(hourStr);
              // Next occurrence of this hour within horizon
              const start = new Date(now);
              start.setUTCMinutes(0, 0, 0);
              if (start.getUTCHours() >= hour) start.setUTCDate(start.getUTCDate() + 1);
              start.setUTCHours(hour);
              const end = new Date(start.getTime() + 60 * 60 * 1000); // 1h window
              if (start.getTime() - now.getTime() <= horizon * 60 * 1000) {
                out.push({
                  retailerId: retailerSlug,
                  start: start.toISOString(),
                  end: end.toISOString(),
                  confidence: Math.round((cnt / total) * 100),
                  rationale: ['availability_snapshot_hour_histogram']
                });
              }
            }
            if (out.length > 0) return out;
          }
        }
      }
    } catch (e) {
      logger.warn('Failed to compute historical drop windows; falling back to heuristics', { error: e instanceof Error ? e.message : String(e) });
    }

    // Heuristic retailer-specific default windows (UTC-based) within the horizon
    const defaults: Record<string, number[]> = {
      'best-buy': [14, 15], // ~9-10am ET
      'walmart': [12, 13],  // ~7-8am ET
      'target': [13, 14],
      'costco': [16],
      'sams-club': [16],
    };
    const hours = defaults[retailerSlug] || [14];
    const windows: PredictedWindow[] = [];
    for (const h of hours.slice(0, topK)) {
      const start = new Date(now);
      start.setUTCMinutes(0, 0, 0);
      if (start.getUTCHours() >= h) start.setUTCDate(start.getUTCDate() + 1);
      start.setUTCHours(h);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      if (start.getTime() - now.getTime() <= horizon * 60 * 1000) {
        windows.push({
          retailerId: retailerSlug,
          start: start.toISOString(),
          end: end.toISOString(),
          confidence: hours.length > 1 ? 60 : 50,
          rationale: ['retailer_default_pattern']
        });
      }
    }
    if (windows.length === 0) {
      // Fallback: next 60 minutes starting now
      const end = new Date(now.getTime() + 60 * 60 * 1000);
      windows.push({ retailerId: retailerSlug, start: now.toISOString(), end: end.toISOString(), confidence: 30, rationale: ['fallback'] });
    }
    // Attach optional shadow probability per window
    const shadowEnabled = (process.env.DROP_CLASSIFIER_SHADOW || 'false').toLowerCase() === 'true';
    if (shadowEnabled) {
      try {
        const { DropClassifierService } = await import('./DropClassifierService');
        await Promise.all(windows.map(async (w) => {
          const minutes = Math.max(15, Math.min(horizon, 240));
          const p = await DropClassifierService.shadowProbability(query.productId || '', retailerSlug, minutes);
          w.shadowProb = Math.round(p * 100) / 100;
          w.rationale.push('shadow_classifier');
        }));
      } catch {}
    }

    // Optional: promote classifier to primary confidence under rollout flag
    try {
      const { redisService } = await import('../redisService');
      const primary = (await redisService.get('config:drop_classifier:primary_enabled')) === 'true';
      const threshold = Number((await redisService.get('config:drop_classifier:threshold')) || '0.5');
      if (primary && shadowEnabled) {
        for (const w of windows) {
          if (typeof w.shadowProb === 'number') {
            const p = w.shadowProb;
            // Adjust confidence; optionally filter below threshold
            const pass = p >= threshold;
            w.confidence = Math.round(p * 100);
            w.rationale.push(pass ? 'primary_classifier_enabled' : 'primary_classifier_below_threshold');
          }
        }
      }
    } catch {}

    return windows;
  }
}

export const dropPredictionService = DropPredictionService;
