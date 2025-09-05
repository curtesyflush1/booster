import { transactionService } from './transactionService';
import { logger } from '../utils/logger';
import { BrowserApiService } from './BrowserApiService';
import { redisService } from './redisService';

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
    const idemKeyRaw = `${job.userId}|${job.productId}|${job.retailerSlug}|${job.ruleId || ''}|${job.qty || 1}|${job.maxPrice || ''}`;
    const idemKey = 'purch:' + Buffer.from(idemKeyRaw).toString('base64').slice(0, 60);

    // Lightweight idempotency guard (redis-based), 5-minute TTL
    try {
      const redisKey = 'purch_idem:' + idemKey;
      const client = redisService.getClient() as any;
      try { await redisService.connect(); } catch {}
      const setNxRes = await client.set(redisKey, '1', { NX: true, EX: 300 });
      if (setNxRes !== 'OK') {
        logger.warn('PurchaseOrchestrator deduped duplicate job', { retailer: job.retailerSlug, productId: job.productId });
        return;
      }
    } catch {}

    await transactionService.recordPurchaseAttempt({
      product_id: job.productId,
      retailer_slug: job.retailerSlug,
      user_id_hash: userHash,
      rule_id: job.ruleId,
      qty: job.qty ?? 1,
      msrp: job.msrp,
      region: job.region,
      session_fingerprint: job.sessionFingerprint,
      alert_at: job.alertAt ?? new Date().toISOString()
    });

    // Execute checkout via the Browser API stub (or simulate if not configured)
    const browser = new BrowserApiService();
    const result = await browser.executeCheckout({
      userId: job.userId,
      productId: job.productId,
      retailerSlug: job.retailerSlug,
      qty: job.qty ?? 1,
      maxPrice: job.maxPrice,
      sessionFingerprint: job.sessionFingerprint,
    });

    if (result.success) {
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
        added_to_cart_at: result.addedToCartAt || new Date(startedAt + 500).toISOString(),
        purchased_at: result.purchasedAt || new Date().toISOString(),
        price_paid: result.pricePaid ?? job.maxPrice ?? job.msrp ?? 0
      });
      logger.info('Purchase succeeded', { retailer: job.retailerSlug, productId: job.productId });
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
        failure_reason: result.failureReason || 'CHECKOUT_FAILED'
      });
      logger.warn('Purchase failed', { retailer: job.retailerSlug, productId: job.productId });
    }
  }
}

export const purchaseOrchestrator = new PurchaseOrchestrator();
