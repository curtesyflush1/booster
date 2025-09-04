import { BaseModel } from '../models/BaseModel';
import { logger } from '../utils/logger';
import { RetailerIntegrationService } from './RetailerIntegrationService';

interface ProductRow {
  id: string;
  sku?: string | null;
  upc?: string | null;
  is_active: boolean;
}

interface RetailerRow {
  id: string; // DB UUID
  slug: string; // e.g., 'best-buy'
  is_active: boolean;
}

export class AvailabilityPollingService extends BaseModel<any> {
  validate(): any[] { return []; }
  sanitize<T>(data: T): T { return data; }

  private static running = false;
  private static timer: NodeJS.Timeout | null = null;

  static start(): void {
    if (this.running) return;
    this.running = true;

    const intervalMs = Number(process.env.SCANNER_INTERVAL_MS || 120000); // default 2 minutes
    logger.info('AvailabilityPollingService started', { intervalMs });

    // kick first run shortly after start
    setTimeout(() => this.scanBatch().catch(() => {}), 5000);
    this.timer = setInterval(() => {
      this.scanBatch().catch((err) => logger.error('Availability scan failed', { error: err instanceof Error ? err.message : String(err) }));
    }, intervalMs);
  }

  static stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
  }

  static async scanBatch(): Promise<void> {
    const batchSize = Number(process.env.SCANNER_BATCH_SIZE || 25);
    const integration = new RetailerIntegrationService();

    // Load active retailers from DB and build slug->uuid map
    const retailers: RetailerRow[] = await this.db('retailers').select('id', 'slug', 'is_active');
    const activeRetailers = retailers.filter(r => r.is_active);
    if (activeRetailers.length === 0) {
      logger.warn('Availability scan skipped: no active retailers');
      return;
    }
    const slugToId = new Map(activeRetailers.map(r => [r.slug, r.id] as const));

    // Pick a batch of active products by popularity then recency
    const products: ProductRow[] = await this.db('products')
      .select('id', 'sku', 'upc', 'is_active')
      .where('is_active', true)
      .orderBy('popularity_score', 'desc')
      .orderBy('created_at', 'desc')
      .limit(batchSize);

    if (products.length === 0) {
      logger.info('Availability scan found no active products');
      return;
    }

    logger.info('Scanning product availability', { count: products.length, retailers: activeRetailers.length });

    for (const product of products) {
      try {
        const responses = await integration.checkProductAvailability({
          productId: product.id,
          sku: product.sku || undefined,
          upc: product.upc || undefined,
        });

        for (const res of responses) {
          const dbRetailerId = slugToId.get(res.retailerId);
          if (!dbRetailerId) continue;
          // Load previous availability to detect transitions
          const prev = await this.db('product_availability')
            .select('in_stock', 'availability_status', 'price', 'product_url')
            .where({ product_id: product.id, retailer_id: dbRetailerId })
            .first();

          const wentInStock = !!res.inStock && prev && (prev.in_stock === false || prev.availability_status === 'out_of_stock');

          await this.upsertAvailability({
            product_id: product.id,
            retailer_id: dbRetailerId,
            in_stock: res.inStock,
            price: res.price ?? null,
            original_price: res.originalPrice ?? null,
            availability_status: res.availabilityStatus,
            product_url: res.productUrl,
            cart_url: res.cartUrl ?? null,
            stock_level: res.stockLevel ?? null,
            store_locations: JSON.stringify(res.storeLocations ?? []),
            last_checked: new Date(),
          });

          // Publish normalized signals for ML/drop detection
          try {
            const { DropSignalService } = await import('./dropSignalService');
            const baseSig = {
              product_id: product.id,
              retailer_id: dbRetailerId,
              source: 'availability-poller',
            } as const;

            // Availability status flip
            if (prev && prev.availability_status !== res.availabilityStatus) {
              await DropSignalService.publishSignal({
                ...baseSig,
                signal_type: 'status_change',
                signal_value: { from: prev.availability_status, to: res.availabilityStatus },
                confidence: 80,
              });
            }

            // Price appeared
            if ((!prev || prev.price == null) && (res.price != null)) {
              await DropSignalService.publishSignal({
                ...baseSig,
                signal_type: 'price_present',
                signal_value: { price: res.price, original: res.originalPrice ?? null },
                confidence: 70,
              });
            }

            // Product URL discovered/changed
            if (res.productUrl && (!prev || prev.product_url !== res.productUrl)) {
              await DropSignalService.publishSignal({
                ...baseSig,
                signal_type: 'url_seen',
                signal_value: res.productUrl,
                confidence: 60,
              });
            }
          } catch (e) {
            logger.warn('Failed to publish drop signals', {
              productId: product.id,
              retailerId: dbRetailerId,
              error: e instanceof Error ? e.message : String(e)
            });
          }

          // Trigger restock alerts on transition into stock
          if (wentInStock) {
            try {
              // Record outcome first for lead-time measurement
              try {
                const { DropOutcomeService } = await import('./DropOutcomeService');
                await DropOutcomeService.recordFirstInStock(product.id, dbRetailerId, new Date());
              } catch {}

              const { AlertProcessingService } = await import('./alertProcessingService');
              // Fetch active watches for this product; filter to retailer when specified on watch
              const watches = await this.db('watches')
                .select('id', 'user_id', 'retailer_ids', 'is_active')
                .where({ product_id: product.id, is_active: true });

              const targetWatches = (watches || []).filter((w: any) => {
                if (Array.isArray(w.retailer_ids) && w.retailer_ids.length > 0) {
                  return w.retailer_ids.includes(dbRetailerId);
                }
                return true;
              });

              const payloadData = {
                availability_status: 'in_stock',
                product_url: res.productUrl,
                cart_url: res.cartUrl ?? undefined,
                price: res.price ?? undefined,
                stock_level: res.stockLevel ?? undefined,
                timestamp: new Date().toISOString()
              } as any;

              await Promise.allSettled(
                targetWatches.map((w: any) =>
                  AlertProcessingService.generateAlert({
                    userId: w.user_id,
                    productId: product.id,
                    retailerId: dbRetailerId,
                    watchId: w.id,
                    type: 'restock',
                    data: payloadData
                  })
                )
              );

              // Also emit a high-confidence in_stock signal
              try {
                const { DropSignalService } = await import('./dropSignalService');
                await DropSignalService.publishSignal({
                  product_id: product.id,
                  retailer_id: dbRetailerId,
                  signal_type: 'in_stock',
                  signal_value: true,
                  source: 'availability-poller',
                  confidence: 95,
                });
              } catch {}
            } catch (e) {
              logger.warn('Failed to generate restock alerts', {
                productId: product.id,
                retailerId: dbRetailerId,
                error: e instanceof Error ? e.message : String(e)
              });
            }
          }
        }
      } catch (err) {
        logger.warn('Availability check failed for product', {
          productId: product.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Gentle pacing to respect rate limits
      await new Promise(r => setTimeout(r, Number(process.env.SCANNER_PRODUCT_DELAY_MS || 250)));
    }
  }

  private static async upsertAvailability(data: any): Promise<void> {
    // Try update first; if 0 rows, insert
    const updated = await this.db('product_availability')
      .where({ product_id: data.product_id, retailer_id: data.retailer_id })
      .update({
        in_stock: data.in_stock,
        price: data.price,
        original_price: data.original_price,
        availability_status: data.availability_status,
        product_url: data.product_url,
        cart_url: data.cart_url,
        stock_level: data.stock_level,
        store_locations: data.store_locations,
        last_checked: data.last_checked,
        updated_at: new Date(),
      });

    if (updated === 0) {
      await this.db('product_availability').insert({
        id: this.db.raw('gen_random_uuid()'),
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    try {
      // Also record a price history point for ML/trending when price is present
      if (data.price !== null && data.price !== undefined) {
        await this.db('price_history').insert({
          id: this.db.raw('gen_random_uuid()'),
          product_id: data.product_id,
          retailer_id: data.retailer_id,
          price: data.price,
          original_price: data.original_price,
          in_stock: data.in_stock,
          availability_status: data.availability_status,
          recorded_at: new Date()
        });
      }
    } catch (e) {
      logger.warn('Failed to insert price history during availability upsert', {
        productId: data.product_id,
        retailerId: data.retailer_id,
        error: e instanceof Error ? e.message : String(e)
      });
    }
  }
}
