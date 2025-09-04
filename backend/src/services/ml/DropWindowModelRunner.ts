import fs from 'fs';
import path from 'path';
import { BaseModel } from '../../models/BaseModel';
import { logger } from '../../utils/logger';

type ModelFile = {
  trainedAt: string;
  horizonDays: number;
  retailers: Record<string, { hourWeights: number[]; totalEvents: number }>;
};

export class DropWindowModelRunner {
  private modelPath = path.join(process.cwd(), 'data', 'ml', 'drop_window_model.json');
  private model: ModelFile | null = null;

  constructor() {
    try {
      if (fs.existsSync(this.modelPath)) {
        this.model = JSON.parse(fs.readFileSync(this.modelPath, 'utf8')) as ModelFile;
      }
    } catch {}
  }

  async train(horizonDays: number = 30): Promise<void> {
    const db = BaseModel.getKnex();
    const now = new Date();
    const start = new Date(now.getTime() - horizonDays * 24 * 60 * 60 * 1000);
    try {
      // Map retailer id -> slug
      const retailers: Array<{ id: string; slug: string }> = await db('retailers').select('id','slug');
      const idToSlug = new Map(retailers.map(r => [r.id, r.slug] as const));

      // Build per-retailer hour histograms from url_live and in_stock events
      const events: Array<{ retailer_id: string; observed_at: Date; signal_type: string }> = await db('drop_events')
        .select('retailer_id','observed_at','signal_type')
        .where('observed_at','>=', start)
        .whereIn('signal_type', ['url_live','in_stock'])
        .limit(100000);

      const byRetailer: Record<string, { hourWeights: number[]; totalEvents: number }> = {};
      for (const ev of events) {
        const slug = idToSlug.get(ev.retailer_id);
        if (!slug) continue;
        if (!byRetailer[slug]) byRetailer[slug] = { hourWeights: Array.from({length:24},()=>0), totalEvents: 0 };
        const h = new Date(ev.observed_at).getUTCHours();
        byRetailer[slug].hourWeights[h] += 1;
        byRetailer[slug].totalEvents += 1;
      }
      // Normalize
      for (const slug of Object.keys(byRetailer)) {
        const rec = byRetailer[slug];
        const sum = rec.hourWeights.reduce((s,v)=>s+v,0) || 1;
        rec.hourWeights = rec.hourWeights.map(v => Number((v/sum).toFixed(6)));
      }

      const model: ModelFile = { trainedAt: new Date().toISOString(), horizonDays, retailers: byRetailer };
      fs.mkdirSync(path.dirname(this.modelPath), { recursive: true });
      fs.writeFileSync(this.modelPath, JSON.stringify(model, null, 2), 'utf8');
      this.model = model;
      logger.info('DropWindowModelRunner: model trained', { horizonDays, retailers: Object.keys(byRetailer).length });
    } catch (error) {
      logger.error('DropWindowModelRunner.train failed', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  getRetailerHourWeights(slug: string): number[] | null {
    if (!this.model) return null;
    const r = this.model.retailers[slug];
    return r ? r.hourWeights : null;
  }
}

export const dropWindowModelRunner = new DropWindowModelRunner();

