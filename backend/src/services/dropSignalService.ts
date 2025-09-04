import { createHash } from 'crypto';
import { BaseModel } from '../models/BaseModel';
import { logger } from '../utils/logger';
import { redisService } from './redisService';

export type DropSignal = {
  product_id: string;
  retailer_id: string;
  signal_type: string; // e.g., status_change|in_stock|price_present|url_live
  signal_value?: string | number | boolean | Record<string, unknown> | null;
  source?: string; // service/component name
  confidence?: number; // 0-100
  observed_at?: Date;
};

function hashValue(v: unknown): string {
  try {
    const s = typeof v === 'string' ? v : JSON.stringify(v ?? '');
    return createHash('sha1').update(s).digest('hex').slice(0, 10);
  } catch {
    return 'noval';
  }
}

export class DropSignalService {
  private static dedupTtlSec = 600; // 10 minutes

  private static get db() {
    return BaseModel.getKnex();
  }

  static buildDedupKey(sig: DropSignal): string {
    const hv = hashValue(sig.signal_value);
    const t = sig.signal_type;
    return `dropsig:${sig.product_id}:${sig.retailer_id}:${t}:${hv}`;
  }

  static async publishSignal(signal: DropSignal): Promise<boolean> {
    const key = this.buildDedupKey(signal);
    try {
      // Deduplicate in Redis when available
      if (redisService.isReady()) {
        const exists = await redisService.exists(key);
        if (exists) return false;
        await redisService.set(key, '1', this.dedupTtlSec);
      }

      const payload: any = {
        id: this.db.raw('gen_random_uuid()'),
        product_id: signal.product_id,
        retailer_id: signal.retailer_id,
        signal_type: signal.signal_type,
        signal_value: signal.signal_value == null ? null : String(typeof signal.signal_value === 'string' ? signal.signal_value : JSON.stringify(signal.signal_value)),
        source: signal.source ?? 'drop-signal-service',
        confidence: signal.confidence ?? null,
        observed_at: signal.observed_at ?? new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      await this.db('drop_events').insert(payload);
      logger.info('Drop signal recorded', {
        productId: signal.product_id,
        retailerId: signal.retailer_id,
        type: signal.signal_type,
      });
      return true;
    } catch (error) {
      logger.warn('Failed to publish drop signal', {
        error: error instanceof Error ? error.message : String(error),
        productId: signal.product_id,
        retailerId: signal.retailer_id,
        type: signal.signal_type,
      });
      return false;
    }
  }

  static async recordUrlCandidate(args: {
    product_id: string;
    retailer_id: string;
    url: string;
    pattern_id?: string;
    score?: number;
    reason?: string;
  }): Promise<void> {
    try {
      const now = new Date();
      // Upsert by retailer+url unique constraint
      const existing = await this.db('url_candidates')
        .select('id', 'score')
        .where({ retailer_id: args.retailer_id, url: args.url })
        .first();

      if (existing) {
        await this.db('url_candidates')
          .where({ id: existing.id })
          .update({
            product_id: args.product_id,
            pattern_id: args.pattern_id ?? null,
            score: args.score ?? existing.score ?? null,
            reason: args.reason ?? null,
            updated_at: now,
          });
      } else {
        await this.db('url_candidates').insert({
          id: this.db.raw('gen_random_uuid()'),
          product_id: args.product_id,
          retailer_id: args.retailer_id,
          pattern_id: args.pattern_id ?? null,
          url: args.url,
          status: 'unknown',
          score: args.score ?? null,
          reason: args.reason ?? null,
          first_seen_at: now,
          created_at: now,
          updated_at: now,
        });
      }
    } catch (error) {
      logger.warn('Failed to record URL candidate', {
        error: error instanceof Error ? error.message : String(error),
        retailerId: args.retailer_id,
        url: args.url,
      });
    }
  }
}

export const dropSignalService = DropSignalService;

