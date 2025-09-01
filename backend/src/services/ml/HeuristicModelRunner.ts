import { IModelRunner } from './IModelRunner';
import { ProductInsights } from '../dashboardService';
import { Product } from '../../models/Product';
import { Alert } from '../../models/Alert';
import { logger } from '../../utils/logger';

/**
 * A simple, deterministic heuristic model that derives insights from
 * recent price history, alert velocity, and product popularity.
 */
export class HeuristicModelRunner implements IModelRunner {
  /**
   * How many days of price history to use for recent vs previous windows.
   */
  private readonly windowDays = 7;

  async predict(productId: string): Promise<ProductInsights | null> {
    try {
      const product = await Product.findById<any>(productId);
      if (!product) return null;

      const knex = Product.getKnex();
      // Pull last 28 days of price history to compute trends
      const priceRows: Array<{ price: number | null; recorded_at: Date }>
        = await knex('price_history')
          .select('price', 'recorded_at')
          .where('product_id', productId)
          .whereNotNull('price')
          .orderBy('recorded_at', 'desc')
          .limit(28);

      const normalize = (v: any) => (v == null ? null : Number(v));
      const prices = priceRows.map(r => normalize(r.price)).filter((p): p is number => typeof p === 'number' && !isNaN(p));

      const recent = prices.slice(0, this.windowDays);
      const previous = prices.slice(this.windowDays, this.windowDays * 2);

      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const recentAvg = avg(recent);
      const prevAvg = avg(previous);

      // Recent trend percent change (deterministic, no randomness)
      const trendPct = prevAvg > 0 ? (recentAvg - prevAvg) / prevAvg : 0;

      // Use msrp as a fallback baseline if no history
      // Aggregate recent user-reported purchases for this product (no PII stored)
      const purchaseRows: Array<{ price_paid: any; lead_time_ms: any; purchased_at: Date }>
        = await knex('transactions')
          .select('price_paid', 'lead_time_ms', 'purchased_at')
          .where({ product_id: productId, status: 'purchased' })
          .whereNotNull('price_paid')
          .orderBy('purchased_at', 'desc')
          .limit(200);

      const paidPrices = purchaseRows
        .map(r => (r.price_paid == null ? null : Number(r.price_paid)))
        .filter((n): n is number => typeof n === 'number' && !isNaN(n));
      const avgPaid = avg(paidPrices);

      const leadTimes = purchaseRows
        .map(r => (r.lead_time_ms == null ? null : Number(r.lead_time_ms)))
        .filter((n): n is number => typeof n === 'number' && !isNaN(n));
      const avgLeadMs = leadTimes.length ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : null;

      const msrp = typeof product.msrp === 'number' ? product.msrp : Number(product.msrp) || 0;

      // Set a sensible baseline: prefer recent market average, else avg paid, else MSRP
      const baseline = recentAvg > 0 ? recentAvg : (avgPaid > 0 ? avgPaid : msrp);

      // Forecasts scale the trend sensibly for week/month
      const nextWeek = baseline * (1 + trendPct * 0.5);
      const nextMonth = baseline * (1 + trendPct * 2);

      // Confidence based on amount of history available (0.4–0.9)
      const historyPoints = prices.length;
      const baseConfidence = Math.max(0.4, Math.min(0.9, historyPoints / 20));
      const sampleSize = paidPrices.length;
      const confidenceBoost = Math.min(0.1, sampleSize / 50); // up to +0.1 with >=5 samples
      const confidence = round2(Math.max(0.4, Math.min(0.95, baseConfidence + confidenceBoost)));

      // Alert velocity and popularity contribute to sellout risk
      const recentAlerts = await Alert.findByProductId(productId, { days: 7, limit: 100 });
      const alertVelocity = recentAlerts.length; // 0..100
      const pop = Number((product as any).popularity_score) || 0; // 0..1000
      // Normalize popularity to 0..100 and weight with alerts
      const popScaled = Math.min(100, pop / 10);
      let selloutScore = Math.max(0, Math.min(100, popScaled * 0.6 + alertVelocity * 3));
      // If users tend to purchase quickly after alerts (short lead times), increase sellout risk
      if (avgLeadMs != null) {
        const hours = avgLeadMs / (1000 * 60 * 60);
        if (hours < 24) selloutScore = Math.min(100, selloutScore + 10);
        else if (hours < 72) selloutScore = Math.min(100, selloutScore + 5);
      }
      const selloutTimeframe = selloutScore > 70 ? '1-2 weeks' : selloutScore > 40 ? '2-4 weeks' : '4+ weeks';
      const selloutConfidence = Math.max(0.5, Math.min(0.9, (alertVelocity / 20) + (popScaled / 200)));

      // ROI estimates based on trend and baseline discount vs msrp
      const paidDiscount = msrp > 0 && avgPaid > 0 ? (msrp - avgPaid) / msrp : null;
      const discount = paidDiscount != null ? paidDiscount : (msrp > 0 && baseline > 0 ? (msrp - baseline) / msrp : 0); // Positive if under msrp
      const shortTermRoi = (trendPct * 100) + (discount * 50);
      const longTermRoi = (trendPct * 200) + (discount * 80);
      const roiConfidence = Math.max(0.45, Math.min(0.85, (confidence + selloutConfidence) / 2));

      // Hype score from popularity + alert velocity
      const hype = Math.min(100, Math.round(popScaled * 0.7 + Math.min(100, alertVelocity * 5) * 0.3));

      return {
        productId,
        productName: (product as any).name || 'Unknown Product',
        priceForcast: {
          nextWeek: round2(nextWeek),
          nextMonth: round2(nextMonth),
          confidence
        },
        selloutRisk: {
          score: Math.round(selloutScore),
          timeframe: selloutTimeframe,
          confidence: round2(selloutConfidence)
        },
        roiEstimate: {
          shortTerm: round2(shortTermRoi),
          longTerm: round2(longTermRoi),
          confidence: round2(roiConfidence)
        },
        hypeScore: hype,
        purchaseSignals: sampleSize > 0 ? {
          averagePaidPrice: round2(avgPaid),
          avgDeltaToMsrpPct: msrp > 0 && avgPaid > 0 ? round2((msrp - avgPaid) / msrp) : 0,
          averageLeadTimeHours: avgLeadMs == null ? null : round2(avgLeadMs / (1000 * 60 * 60)),
          sampleSize
        } : undefined,
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('HeuristicModelRunner.predict failed', { productId, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function avg(arr: number[]) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
