import fs from 'fs';
import path from 'path';
import { Product } from '../../models/Product';
import { logger } from '../../utils/logger';

export class MLTrainingETLService {
  static async run(outputDir: string = path.join(process.cwd(), 'data', 'ml')): Promise<string> {
    const knex = Product.getKnex();
    try {
      // Ensure output directory exists
      fs.mkdirSync(outputDir, { recursive: true });
      const outPath = path.join(outputDir, 'ml_training_data.csv');

      // Fetch a reasonable set of active products with popularity
      const products: Array<{ id: string; msrp: number | null; created_at: Date; popularity_score?: number }>
        = await knex('products')
          .select('id', 'msrp', 'created_at', 'popularity_score')
          .where('is_active', true)
          .orderBy('popularity_score', 'desc')
          .limit(1000);

      const header = 'product_id,recent_avg,prev_avg,trend_pct,msrp,popularity,label_next7\n';
      fs.writeFileSync(outPath, header, 'utf8');

      for (const p of products) {
        // Pull broader history and aggregate by day for stable windows
        const rawRows: Array<{ price: number | null; recorded_at: Date }>
          = await knex('price_history')
            .select('price', 'recorded_at')
            .where('product_id', p.id)
            .whereNotNull('price')
            .orderBy('recorded_at', 'asc')
            .limit(365);

        if (!rawRows || rawRows.length < 21) continue; // need >= 3 weeks of data

        // Group by day and compute daily average price
        const byDay = new Map<string, number[]>();
        for (const r of rawRows) {
          const price = r.price == null ? null : Number(r.price);
          if (price == null || isNaN(price)) continue;
          const dayKey = r.recorded_at.toISOString().slice(0, 10);
          const arr = byDay.get(dayKey) || [];
          arr.push(price);
          byDay.set(dayKey, arr);
        }
        const daily = Array.from(byDay.entries())
          .sort((a,b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
          .map(([, arr]) => (arr.reduce((s, v) => s + v, 0) / arr.length));

        const window = 7;
        const avg = (arr: number[]) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
        if (daily.length < window * 3) continue; // need prev(7) + recent(7) + forward(7)

        const msrp = p.msrp == null ? 0 : Number(p.msrp) || 0;
        const pop = p.popularity_score == null ? 0 : Number(p.popularity_score) || 0;

        // Generate multiple training samples per product using sliding windows
        for (let start = 0; start + window * 3 <= daily.length; start++) {
          const prevSlice = daily.slice(start, start + window);
          const recentSlice = daily.slice(start + window, start + window * 2);
          const forwardSlice = daily.slice(start + window * 2, start + window * 3);
          const prevAvg = avg(prevSlice);
          const recentAvg = avg(recentSlice);
          const trendPct = prevAvg > 0 ? (recentAvg - prevAvg) / prevAvg : 0;
          const labelNext7 = avg(forwardSlice); // true forward label (next 7-day avg)

          // Sanity checks to avoid degenerate rows
          if (!isFinite(prevAvg) || !isFinite(recentAvg) || !isFinite(labelNext7)) continue;

          const line = [
            p.id,
            recentAvg.toFixed(4),
            prevAvg.toFixed(4),
            trendPct.toFixed(6),
            msrp.toFixed(4),
            pop.toFixed(2),
            labelNext7.toFixed(4)
          ].join(',') + '\n';
          fs.appendFileSync(outPath, line, 'utf8');
        }
      }

      logger.info('ML ETL completed', { outPath });
      return outPath;
    } catch (error) {
      logger.error('ML ETL failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
}
