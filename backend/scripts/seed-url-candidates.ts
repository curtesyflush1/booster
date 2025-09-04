import 'dotenv/config';
import { BaseModel } from '../src/models/BaseModel';
import { URLPatternService } from '../src/services/URLPatternService';

async function main() {
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    const [k, v] = a.startsWith('--') ? [a.slice(2), process.argv[i + 1]] : [a, undefined];
    if (v && !v.startsWith('--')) { args.set(k, v); i++; } else { args.set(k, 'true'); }
  }

  const productId = args.get('product') || args.get('product_id');
  const retailer = args.get('retailer');
  const sku = args.get('sku') || undefined;
  const upc = args.get('upc') || undefined;
  const name = args.get('name') || undefined;
  const setName = args.get('set') || args.get('set_name') || undefined;

  const knex = BaseModel.getKnex();

  let resolvedProductId = productId;
  let resolvedRetailer = retailer as string | undefined;

  if (!resolvedProductId) {
    const row = await knex('products')
      .select('id')
      .where('is_active', true)
      .orderBy('popularity_score', 'desc')
      .first();
    if (!row) throw new Error('No active products found; please provide --product <uuid>');
    resolvedProductId = row.id;
  }
  if (!resolvedRetailer) {
    const rr = await knex('retailers').select('slug').where('is_active', true).orderBy('slug', 'asc').first();
    if (!rr) throw new Error('No active retailers found; please provide --retailer <slug>');
    resolvedRetailer = rr.slug;
  }

  const candidates = await URLPatternService.generateCandidates({
    productId: resolvedProductId!,
    retailerSlug: resolvedRetailer!,
    sku, upc, name, setName
  });

  console.log(JSON.stringify({ productId: resolvedProductId, retailer: resolvedRetailer, count: candidates.length, candidates }, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error('Seeding URL candidates failed:', e?.message || e);
  process.exit(1);
});

