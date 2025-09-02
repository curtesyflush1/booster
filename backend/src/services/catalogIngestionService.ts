import { BaseModel } from '../models/BaseModel';
import { logger } from '../utils/logger';
import { RetailerIntegrationService } from './RetailerIntegrationService';
import { Product } from '../models/Product';
import { ProductAvailabilityResponse } from '../types/retailer';

interface UpsertResult {
  productId: string;
  created: boolean;
}

/**
 * CatalogIngestionService
 * - Discovers Pokémon TCG products from retailer adapters
 * - Upserts normalized products into `products`
 * - Upserts corresponding entries in `product_availability`
 * - Maintains an optional external mapping table for dedupe (created on demand)
 */
export class CatalogIngestionService extends BaseModel<any> {
  validate(): any[] { return []; }
  sanitize<T>(data: T): T { return data; }

  static async discoverAndIngest(): Promise<{ discovered: number; upserted: number; availabilityUpserts: number; }> {
    const integration = new RetailerIntegrationService();

    const queries = [
      'pokemon tcg',
      'pokemon booster box',
      'pokemon elite trainer box',
      'pokemon booster pack',
      'pokemon collection box',
      'pokemon tin'
    ];

    await this.ensureExternalMapTable();

    let discovered = 0;
    let upserted = 0;
    let availabilityUpserts = 0;

    for (const q of queries) {
      try {
        const items = await integration.searchProducts(q);
        discovered += items.length;
        for (const item of items) {
          const { productId, created } = await this.upsertProductFromDiscovery(item);
          upserted += created ? 1 : 0;
          availabilityUpserts += await this.upsertAvailabilityFromDiscovery(productId, item);
        }
      } catch (err) {
        logger.warn('Catalog discovery query failed', { query: q, error: err instanceof Error ? err.message : String(err) });
      }
      // Gentle pacing between queries
      await new Promise(r => setTimeout(r, 500));
    }

    logger.info('Catalog ingestion completed', { discovered, upserted, availabilityUpserts });
    return { discovered, upserted, availabilityUpserts };
  }

  /**
   * Dry-run discovery that returns a diff of proposed creates/updates
   * without writing to the database.
   */
  static async dryRunDiscover(options?: { queries?: string[] }) {
    const integration = new RetailerIntegrationService();
    const queries = options?.queries && options.queries.length
      ? options.queries
      : [
          'pokemon tcg',
          'pokemon booster box',
          'pokemon elite trainer box',
          'pokemon booster pack',
          'pokemon collection box',
          'pokemon tin'
        ];

    // Map retailer slug -> DB id for availability preview
    const retailers: Array<{ id: string; slug: string }> = await this.db('retailers').select('id', 'slug');
    const slugToRetailerId = new Map(retailers.map(r => [r.slug, r.id] as const));

    const toCreate: any[] = [];
    const toUpdate: Array<{ productId: string; slug: string; changes: Record<string, { from: any; to: any }> }> = [];
    const availabilityPreview: Array<{ productRef: { id?: string; slug: string }; retailer: string; price?: number; url: string; status: string }>
      = [];

    let discovered = 0;

    for (const q of queries) {
      let items: ProductAvailabilityResponse[] = [];
      try {
        items = await integration.searchProducts(q);
      } catch (err) {
        logger.warn('Dry-run discovery search failed', { query: q, error: err instanceof Error ? err.message : String(err) });
        continue;
      }
      discovered += items.length;

      for (const item of items) {
        const meta = item.metadata || ({} as any);
        const name: string = this.normalizeName(meta.name || meta.title || 'Pokémon TCG Product');
        const slug = this.toSlug(name);
        const upc: string | null = meta.upc || null;
        const sku: string | null = meta.sku?.toString?.() || meta.itemId?.toString?.() || null;
        const image_url: string | null = meta.image || meta.image_url || null;
        const msrp: number | null = meta.msrp ? Number(meta.msrp) : (item.originalPrice ? Number(item.originalPrice) : null);
        const series: string | null = meta.series || null;
        const set_name: string | null = meta.set_name || null;
        const description: string | null = meta.shortDescription || null;

        // Determine existence
        let existing = upc ? await Product.findByUPC(upc) : null;
        if (!existing) {
          existing = await Product.findBySlug(slug);
        }

        if (!existing) {
          toCreate.push({ name, slug, upc, sku, msrp, image_url, series, set_name, description });
          availabilityPreview.push({
            productRef: { slug },
            retailer: item.retailerId,
            price: item.price ?? undefined,
            url: item.productUrl,
            status: item.availabilityStatus
          });
        } else {
          const changes: Record<string, { from: any; to: any }> = {};
          const fields: Array<[keyof typeof existing, any]> = [
            ['name', name],
            ['slug', slug],
            ['upc', upc],
            ['sku', sku],
            ['msrp', msrp],
            ['image_url', image_url],
            ['series', series],
            ['set_name', set_name],
            ['description', description]
          ];
          for (const [field, proposed] of fields) {
            const current = (existing as any)[field] ?? null;
            if (proposed != null && String(proposed) !== String(current ?? '')) {
              changes[String(field)] = { from: current, to: proposed };
            }
          }
          if (Object.keys(changes).length > 0) {
            toUpdate.push({ productId: (existing as any).id, slug, changes });
          }

          // Availability preview for existing product
          const retailerUuid = slugToRetailerId.get(item.retailerId);
          if (retailerUuid) {
            availabilityPreview.push({
              productRef: { id: (existing as any).id, slug },
              retailer: item.retailerId,
              price: item.price ?? undefined,
              url: item.productUrl,
              status: item.availabilityStatus
            });
          }
        }
      }
    }

    return {
      discovered,
      toCreateCount: toCreate.length,
      toUpdateCount: toUpdate.length,
      availabilityPreviewCount: availabilityPreview.length,
      toCreate,
      toUpdate,
      availabilityPreview
    };
  }

  private static toSlug(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 100);
  }

  private static normalizeName(name: string): string {
    return name.replace(/\s+/g, ' ').trim();
  }

  private static async ensureCategory(name?: string | null): Promise<string | null> {
    if (!name || !name.trim()) return null;
    const slug = this.toSlug(name);
    const existing = await this.db('product_categories').where({ slug }).first();
    if (existing) return existing.id as string;
    const [row] = await this.db('product_categories')
      .insert({
        id: this.db.raw('gen_random_uuid()'),
        name: name.trim(),
        slug,
        description: null,
        parent_id: null,
        sort_order: 999,
        created_at: this.db.fn.now(),
        updated_at: this.db.fn.now(),
      })
      .returning('*');
    return row.id as string;
  }

  private static inferCategory(name: string): string | null {
    const n = name.toLowerCase();
    if (n.includes('elite trainer')) return 'Elite Trainer Boxes';
    if (n.includes('booster box')) return 'Booster Boxes';
    if (n.includes('booster pack')) return 'Booster Packs';
    if (n.includes('collection')) return 'Collection Boxes';
    if (n.includes('deck')) return 'Starter Decks';
    return null;
  }

  private static async upsertProductFromDiscovery(item: ProductAvailabilityResponse): Promise<UpsertResult> {
    const meta = item.metadata || {} as any;
    const name: string = this.normalizeName(meta.name || meta.title || 'Pokémon TCG Product');
    const upc: string | null = meta.upc || null;
    const sku: string | null = meta.sku?.toString?.() || meta.itemId?.toString?.() || null;
    const imageUrl: string | null = meta.image || meta.image_url || null;
    const msrp: number | null = meta.msrp ? Number(meta.msrp) : (item.originalPrice ? Number(item.originalPrice) : null);
    const series: string | null = meta.series || null;
    const setName: string | null = meta.set_name || null;
    const description: string | null = meta.shortDescription || null;

    const categoryName = this.inferCategory(name);
    const categoryId = await this.ensureCategory(categoryName);

    // Try to find existing by UPC first
    let existing = upc ? await Product.findByUPC(upc) : null;

    // Otherwise, try by slug
    const slug = this.toSlug(name);
    if (!existing) {
      existing = await Product.findBySlug(slug);
    }

    const now = new Date();
    const payload: any = {
      name,
      slug,
      sku,
      upc,
      category_id: categoryId,
      set_name: setName,
      series,
      release_date: null,
      msrp: msrp ?? null,
      image_url: imageUrl,
      description,
      metadata: {},
      is_active: true,
      popularity_score: 50,
      updated_at: now,
    };

    let productId: string;
    let created = false;
    if (existing) {
      productId = (existing as any).id as string;
      await this.db('products').where({ id: productId }).update(payload);
    } else {
      const [row] = await this.db('products')
        .insert({ id: this.db.raw('gen_random_uuid()'), created_at: now, ...payload })
        .returning('*');
      productId = row.id as string;
      created = true;
    }

    // Record mapping for dedupe/reference
    await this.upsertExternalMap({
      retailer_slug: item.retailerId,
      external_id: sku || slug,
      product_id: productId,
      product_url: item.productUrl,
      last_seen_at: now,
    });

    return { productId, created };
  }

  private static async upsertAvailabilityFromDiscovery(productId: string, item: ProductAvailabilityResponse): Promise<number> {
    // Map retailer slug to DB UUID
    const retailer = await this.db('retailers').where({ slug: item.retailerId }).first();
    if (!retailer) return 0;

    const data: any = {
      product_id: productId,
      retailer_id: retailer.id,
      in_stock: item.inStock,
      price: item.price ?? null,
      original_price: item.originalPrice ?? null,
      availability_status: item.availabilityStatus,
      product_url: item.productUrl,
      cart_url: item.cartUrl ?? null,
      stock_level: item.stockLevel ?? null,
      store_locations: JSON.stringify(item.storeLocations ?? []),
      last_checked: new Date(),
      updated_at: new Date(),
    };

    const updated = await this.db('product_availability')
      .where({ product_id: data.product_id, retailer_id: data.retailer_id })
      .update(data);

    if (updated === 0) {
      await this.db('product_availability').insert({
        id: this.db.raw('gen_random_uuid()'),
        ...data,
        created_at: new Date(),
      });
    }
    return 1;
  }

  private static async ensureExternalMapTable(): Promise<void> {
    const exists = await this.db.schema.hasTable('external_product_map');
    if (!exists) {
      await this.db.schema.createTable('external_product_map', (table) => {
        table.uuid('id').primary().defaultTo(this.db.raw('gen_random_uuid()'));
        table.string('retailer_slug').notNullable();
        table.string('external_id').notNullable();
        table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
        table.string('product_url').notNullable();
        table.timestamp('last_seen_at').notNullable().defaultTo(this.db.fn.now());
        table.timestamps(true, true);
        table.unique(['retailer_slug', 'external_id']);
        table.index(['product_id']);
      });
    }
  }

  private static async upsertExternalMap(row: { retailer_slug: string; external_id: string | null; product_id: string; product_url: string; last_seen_at: Date; }): Promise<void> {
    if (!row.external_id) return;
    const updated = await this.db('external_product_map')
      .where({ retailer_slug: row.retailer_slug, external_id: row.external_id })
      .update({ product_id: row.product_id, product_url: row.product_url, last_seen_at: row.last_seen_at, updated_at: new Date() });
    if (updated === 0) {
      await this.db('external_product_map').insert({ id: this.db.raw('gen_random_uuid()'), ...row, created_at: new Date(), updated_at: new Date() });
    }
  }
}
