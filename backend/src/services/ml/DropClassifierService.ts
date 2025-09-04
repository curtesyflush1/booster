import { BaseModel } from '../../models/BaseModel';
import { dropWindowModelRunner } from './DropWindowModelRunner';

export class DropClassifierService {
  private static get db() { return BaseModel.getKnex(); }
  private static calibrator: { a: number; b: number } | null = null;
  private static calibratorLoaded = false;

  private static loadCalibrator(): void {
    if (this.calibratorLoaded) return;
    this.calibratorLoaded = true;
    try {
      const fs = require('fs');
      const path = require('path');
      const p = path.join(process.cwd(),'data','ml','drop_classifier_calibration.json');
      if (fs.existsSync(p)) {
        const j = JSON.parse(fs.readFileSync(p,'utf8'));
        this.calibrator = { a: Number(j.a || 1), b: Number(j.b || 0) };
      }
    } catch {}
  }

  /**
   * Heuristic shadow classifier: probability of live in next X minutes.
   * Combines retailer hour weight + recent signal counts.
   */
  static async shadowProbability(productId: string, retailerSlug: string, horizonMinutes: number = 60): Promise<number> {
    this.loadCalibrator();
    const db = this.db;
    // Get retailer id
    const ret = await db('retailers').select('id').where('slug', retailerSlug).first();
    if (!ret) return 0.1;
    const retailerId = ret.id as string;
    const now = new Date();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Try model_features first (latest as_of)
    try {
      const mf = await db('model_features')
        .select('features')
        .where({ product_id: productId, retailer_id: retailerId })
        .orderBy('as_of','desc')
        .first();
      if (mf && mf.features) {
        const f = typeof mf.features === 'string' ? JSON.parse(mf.features) : mf.features;
        const counts = f.counts || {};
        const avail = Number(f.availability_ratio || 0);
        const weights = dropWindowModelRunner.getRetailerHourWeights(retailerSlug) || Array.from({length:24},()=>1/24);
        const future = new Date(now.getTime() + horizonMinutes * 60 * 1000);
        const hourWeight = weights[future.getUTCHours()] || 1/24;
        // Simple logistic function
        const z =  
          1.5 * hourWeight +
          0.8 * Math.min(1, (counts.url_live || 0) / 5) +
          0.4 * Math.min(1, (counts.price_present || 0) / 10) +
          0.3 * Math.min(1, (counts.status_change || 0) / 10) +
          0.2 * Math.min(1, (counts.url_seen || 0) / 10) -
          0.5 * Math.max(0, 0.5 - avail); // lower availability raises risk
        const a = this.calibrator?.a ?? 1.0;
        const b = this.calibrator?.b ?? 0.0;
        const prob = 1 / (1 + Math.exp(-(a*z + b)));
        return Math.max(0, Math.min(1, prob));
      }
    } catch {}

    // Fallback: recent signal counts
    const rows: Array<{ signal_type: string; c: string }> = await db('drop_events')
      .select('signal_type', db.raw('COUNT(*) as c'))
      .where({ product_id: productId, retailer_id: retailerId })
      .andWhere('observed_at', '>=', last7d)
      .groupBy('signal_type');
    const counts: Record<string, number> = { url_live: 0, in_stock: 0, price_present: 0, status_change: 0, url_seen: 0 };
    rows.forEach(r => { counts[r.signal_type] = Number(r.c || 0); });

    // Retailer hour weight
    const weights = dropWindowModelRunner.getRetailerHourWeights(retailerSlug) || Array.from({length:24},()=>1/24);
    const future = new Date(now.getTime() + horizonMinutes * 60 * 1000);
    const hour = future.getUTCHours();
    const hourWeight = weights[hour] || 1/24;

    // Simple scoring
    let z = 0;
    z += hourWeight * 0.6; // importance of hour window
    z += Math.min(1, counts.url_live / 5) * 0.2;
    z += Math.min(1, counts.price_present / 10) * 0.1;
    z += Math.min(1, counts.status_change / 10) * 0.05;
    z += Math.min(1, counts.url_seen / 10) * 0.05;

    const a = this.calibrator?.a ?? 1.0;
    const b = this.calibrator?.b ?? 0.0;
    const prob = 1/(1+Math.exp(-(a*z + b)));
    return Math.max(0, Math.min(1, prob));
  }
}

export const dropClassifierService = DropClassifierService;
