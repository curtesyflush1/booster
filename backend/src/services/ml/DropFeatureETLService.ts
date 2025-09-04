import { BaseModel } from '../../models/BaseModel';
import { logger } from '../../utils/logger';

type FeatureRow = {
  product_id: string;
  retailer_id: string;
  as_of: Date;
  features: Record<string, any>;
  label?: string | null;
  split_tag?: string | null;
};

export class DropFeatureETLService {
  private static get db() { return BaseModel.getKnex(); }

  /**
   * Build feature vectors from recent drop_events and availability snapshots.
   */
  static async run(options: { lookbackDays?: number; splitTag?: string } = {}): Promise<number> {
    const lookbackDays = Math.max(7, Math.min(options.lookbackDays ?? 30, 120));
    const splitTag = options.splitTag ?? 'shadow';
    const now = new Date();
    const start = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    try {
      // Gather recent events by product/retailer
      const events: Array<{ product_id: string; retailer_id: string; signal_type: string; observed_at: Date }>
        = await this.db('drop_events')
          .select('product_id','retailer_id','signal_type','observed_at')
          .where('observed_at','>=', start)
          .orderBy('observed_at','asc');

      if (!events.length) return 0;

      // Index by key
      const byKey = new Map<string, FeatureRow>();
      const hourHist = (n=24)=>Array.from({length:n},()=>0);

      for (const ev of events) {
        const key = `${ev.product_id}:${ev.retailer_id}`;
        let row = byKey.get(key);
        if (!row) {
          row = { product_id: ev.product_id, retailer_id: ev.retailer_id, as_of: now, features: { counts: {}, hours: {} }, label: null, split_tag: splitTag };
          row.features.counts = { in_stock:0, status_change:0, price_present:0, url_live:0, url_seen:0 };
          row.features.hours = { in_stock: hourHist(), url_live: hourHist(), status_change: hourHist(), price_present: hourHist(), url_seen: hourHist() };
          byKey.set(key, row);
        }
        const h = new Date(ev.observed_at).getUTCHours();
        if (row.features.counts[ev.signal_type] != null) row.features.counts[ev.signal_type]++;
        if (row.features.hours[ev.signal_type]) row.features.hours[ev.signal_type][h]++;
      }

      // Add availability snapshot ratios (simple signal of avg in_stock rate)
      const keys = Array.from(byKey.keys());
      const pairs = keys.map(k => k.split(':'));
      for (const [product_id, retailer_id] of pairs) {
        try {
          const snaps: Array<{ in_stock: boolean }>= await this.db('availability_snapshots')
            .select('in_stock')
            .where({ product_id, retailer_id })
            .andWhere('snapshot_time','>=', start)
            .limit(2000);
          const total = snaps.length || 1;
          const instockRatio = snaps.filter(s=>s.in_stock).length/total;
          const row = byKey.get(`${product_id}:${retailer_id}`)!;
          row.features.availability_ratio = Number(instockRatio.toFixed(4));
        } catch {}
      }

      // Write to model_features
      let inserted = 0;
      for (const row of byKey.values()) {
        try {
          await this.db('model_features').insert({
            id: this.db.raw('gen_random_uuid()'),
            product_id: row.product_id,
            retailer_id: row.retailer_id,
            as_of: row.as_of,
            features: JSON.stringify(row.features),
            label: row.label ?? null,
            split_tag: row.split_tag ?? null,
            created_at: new Date(),
            updated_at: new Date(),
          });
          inserted++;
        } catch (e) {
          // If duplicates become a problem, add a unique index on (product_id, retailer_id, as_of::date)
        }
      }
      return inserted;
    } catch (error) {
      logger.error('DropFeatureETLService.run failed', { error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }
}

export const dropFeatureETLService = DropFeatureETLService;

