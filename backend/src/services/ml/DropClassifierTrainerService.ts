import fs from 'fs';
import path from 'path';
import { BaseModel } from '../../models/BaseModel';
import { logger } from '../../utils/logger';
import { dropWindowModelRunner } from './DropWindowModelRunner';

type Calibrator = { a: number; b: number; trainedAt: string; metrics: { rows: number; auc: number; precisionAt10: number } };

export class DropClassifierTrainerService {
  private static get db() { return BaseModel.getKnex(); }
  private static outPath = path.join(process.cwd(), 'data', 'ml', 'drop_classifier_calibration.json');

  static async train(options: { lookbackDays?: number; horizonMinutes?: number; historyWindowDays?: number; sampleStepMinutes?: number; maxSamples?: number } = {}): Promise<Calibrator | null> {
    const lookbackDays = Math.max(7, Math.min(options.lookbackDays ?? 30, 120));
    const horizonMin = Math.max(30, Math.min(options.horizonMinutes ?? 60, 240));
    const historyDays = Math.max(1, Math.min(options.historyWindowDays ?? 7, 30));
    const stepMin = Math.max(30, Math.min(options.sampleStepMinutes ?? 60, 180));
    const maxSamples = Math.max(500, Math.min(options.maxSamples ?? 5000, 20000));
    const now = new Date();
    const start = new Date(now.getTime() - lookbackDays*24*60*60*1000);
    try {
      // Use retailer slugs mapping
      const retailers: Array<{ id: string; slug: string }> = await this.db('retailers').select('id','slug');
      const idToSlug = new Map(retailers.map(r => [r.id, r.slug] as const));

      // Build distinct product/retailer pairs seen in drop_events
      const pairs: Array<{ product_id: string; retailer_id: string; max_time: Date }> = await this.db('drop_events')
        .select('product_id','retailer_id')
        .max({ max_time: 'observed_at' })
        .where('observed_at','>=', start)
        .groupBy('product_id','retailer_id')
        .limit(1000);

      if (!pairs.length) return null;

      const samples: Array<{ s: number; y: number }> = [];

      for (const pr of pairs) {
        const slug = idToSlug.get(pr.retailer_id);
        if (!slug) continue;
        // Sample times in stepMin increments
        let t = new Date(Math.max(start.getTime(), pr.max_time.getTime() - lookbackDays*24*60*60*1000));
        const end = pr.max_time;
        while (t < end && samples.length < maxSamples) {
          // History window
          const histStart = new Date(t.getTime() - historyDays*24*60*60*1000);
          // Counts in history
          const rows = await this.db('drop_events')
            .select('signal_type')
            .count({ c: '*' })
            .where({ product_id: pr.product_id, retailer_id: pr.retailer_id })
            .andWhere('observed_at','>=', histStart)
            .andWhere('observed_at','<', t)
            .groupBy('signal_type');
          const counts: Record<string, number> = { url_live:0, in_stock:0, price_present:0, status_change:0, url_seen:0 };
          rows.forEach((r:any)=>{ counts[r.signal_type] = Number(r.c || 0); });
          // Availability ratio in history
          const snaps = await this.db('availability_snapshots')
            .select('in_stock')
            .where({ product_id: pr.product_id, retailer_id: pr.retailer_id })
            .andWhere('snapshot_time','>=', histStart)
            .andWhere('snapshot_time','<', t)
            .limit(2000);
          const avail = snaps.length ? snaps.filter(s=>s.in_stock).length / snaps.length : 0;
          // Hour weight
          const weights = dropWindowModelRunner.getRetailerHourWeights(slug) || Array.from({length:24},()=>1/24);
          const hourWeight = weights[new Date(t.getTime() + horizonMin*60*1000).getUTCHours()] || 1/24;
          // Raw score like shadow classifier
          const score =  1.5*hourWeight
            + 0.8*Math.min(1, counts.url_live/5)
            + 0.4*Math.min(1, counts.price_present/10)
            + 0.3*Math.min(1, counts.status_change/10)
            + 0.2*Math.min(1, counts.url_seen/10)
            - 0.5*Math.max(0, 0.5 - avail);
          // Label: any live event in [t, t+horizon]
          const futureEnd = new Date(t.getTime() + horizonMin*60*1000);
          const labelRow = await this.db('drop_events')
            .where({ product_id: pr.product_id, retailer_id: pr.retailer_id })
            .andWhere('observed_at','>=', t)
            .andWhere('observed_at','<=', futureEnd)
            .andWhere((qb:any)=> qb.where('signal_type','url_live').orWhere('signal_type','in_stock'))
            .first();
          const y = !!labelRow ? 1 : 0;
          samples.push({ s: score, y });
          t = new Date(t.getTime() + stepMin*60*1000);
          if (samples.length >= maxSamples) break;
        }
        if (samples.length >= maxSamples) break;
      }

      if (samples.length < 50) {
        logger.warn('DropClassifierTrainer: insufficient samples', { samples: samples.length });
        return null;
      }

      // Fit logistic calibration: p = sigmoid(a*s + b)
      let a = 1.0, b = 0.0;
      const lr = 0.1;
      const iters = 200;
      for (let k=0; k<iters; k++) {
        let ga = 0, gb = 0;
        for (const r of samples) {
          const z = a*r.s + b;
          const p = 1/(1+Math.exp(-z));
          const diff = (p - r.y);
          ga += diff * r.s;
          gb += diff;
        }
        a -= lr * ga / samples.length;
        b -= lr * gb / samples.length;
      }

      // Metrics
      const scored = samples.map(r => ({ p: 1/(1+Math.exp(-(a*r.s + b))), y: r.y }));
      scored.sort((x,y)=> y.p - x.p);
      const k = Math.max(1, Math.floor(0.1 * scored.length));
      const topK = scored.slice(0, k);
      const precisionAt10 = topK.filter(r => r.y===1).length / k;
      // AUC
      const pos = scored.filter(r=>r.y===1);
      const neg = scored.filter(r=>r.y===0);
      let auc = 0.5;
      if (pos.length && neg.length) {
        let rankSum = 0;
        let rank = 1;
        for (const r of scored) { if (r.y===1) rankSum += rank; rank++; }
        const U = rankSum - pos.length*(pos.length+1)/2;
        auc = U / (pos.length * neg.length);
      }

      const calibrator: Calibrator = { a, b, trainedAt: new Date().toISOString(), metrics: { rows: samples.length, auc: Number(auc.toFixed(4)), precisionAt10: Number(precisionAt10.toFixed(4)) } };
      fs.mkdirSync(path.dirname(this.outPath), { recursive: true });
      fs.writeFileSync(this.outPath, JSON.stringify(calibrator, null, 2), 'utf8');
      logger.info('DropClassifierTrainer: trained', calibrator);
      return calibrator;
    } catch (error) {
      logger.error('DropClassifierTrainer: failed', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }
}

export const dropClassifierTrainerService = DropClassifierTrainerService;

