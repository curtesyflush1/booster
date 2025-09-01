import { transactionService } from './transactionService';
import { logger } from '../utils/logger';

export interface PurchaseJob {
  userId: string;
  productId: string;
  retailerSlug: string;
  ruleId?: string;
  qty?: number;
  msrp?: number;
  maxPrice?: number;
  region?: string;
  sessionFingerprint?: string;
  alertAt?: string; // ISO timestamp
}

export class PurchaseOrchestrator {
  async executePurchase(job: PurchaseJob): Promise<void> {
    const startedAt = Date.now();

    // Pseudonymize user for analytics/ML
    const userHash = `hash:${job.userId}`; // TODO: Replace with HMAC(KMS) in production

    await transactionService.recordPurchaseAttempt({
      product_id: job.productId,
      retailer_slug: job.retailerSlug,
      user_id_hash: userHash,
      rule_id: job.ruleId,
      qty: job.qty ?? 1,
      msrp: job.msrp,
      region: job.region,
      session_fingerprint: job.sessionFingerprint,
      alert_at: job.alertAt ?? new Date().toISOString(),
    });

    // Simulate checkout time (1–2s)
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.floor(Math.random() * 1000)));

    const succeed = Math.random() < 0.7; // 70% success for demo
    if (succeed) {
      const purchasedAt = new Date();
      await transactionService.recordPurchaseSuccess({
        product_id: job.productId,
        retailer_slug: job.retailerSlug,
        user_id_hash: userHash,
        rule_id: job.ruleId,
        qty: job.qty ?? 1,
        msrp: job.msrp,
        region: job.region,
        session_fingerprint: job.sessionFingerprint,
        alert_at: job.alertAt ?? new Date(startedAt).toISOString(),
        added_to_cart_at: new Date(startedAt + 500).toISOString(),
        purchased_at: purchasedAt.toISOString(),
        price_paid: job.maxPrice ?? job.msrp ?? 0,
      });
      logger.info('Simulated purchase succeeded', { retailer: job.retailerSlug, productId: job.productId });
    } else {
      await transactionService.recordPurchaseFailure({
        product_id: job.productId,
        retailer_slug: job.retailerSlug,
        user_id_hash: userHash,
        rule_id: job.ruleId,
        qty: job.qty ?? 1,
        msrp: job.msrp,
        region: job.region,
        session_fingerprint: job.sessionFingerprint,
        alert_at: job.alertAt ?? new Date(startedAt).toISOString(),
        failure_reason: 'SIMULATED_OUT_OF_STOCK',
      });
      logger.warn('Simulated purchase failed', { retailer: job.retailerSlug, productId: job.productId });
    }
  }
}

export const purchaseOrchestrator = new PurchaseOrchestrator();

