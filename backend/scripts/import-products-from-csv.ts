import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
dotenv.config();

import { db } from '../src/config/database';

interface CsvRow {
  name: string;
  slug?: string;
  sku?: string;
  upc?: string;
  category?: string;
  series?: string;
  set_name?: string;
  msrp?: string | number;
  release_date?: string;
  image_url?: string;
  description?: string;
}

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 100);
}

async function ensureCategory(name: string | undefined): Promise<string | null> {
  if (!name || !name.trim()) return null;
  const slug = toSlug(name);
  const existing = await db('product_categories').where({ slug }).first();
  if (existing) return existing.id;
  const [row] = await db('product_categories')
    .insert({
      id: db.raw('gen_random_uuid()'),
      name: name.trim(),
      slug,
      description: null,
      parent_id: null,
      sort_order: 999,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');
  return row.id as string;
}

async function upsertProduct(row: CsvRow): Promise<void> {
  const now = new Date();
  const categoryId = await ensureCategory(row.category);
  const slug = row.slug?.trim() || toSlug(row.name);
  const msrp = row.msrp ? Number(row.msrp) : null;

  const payload: any = {
    name: row.name,
    slug,
    sku: row.sku || null,
    upc: row.upc || null,
    category_id: categoryId,
    set_name: row.set_name || null,
    series: row.series || null,
    release_date: row.release_date || null,
    msrp: msrp ?? null,
    image_url: row.image_url || null,
    description: row.description || null,
    metadata: {},
    is_active: true,
    popularity_score: 100,
    updated_at: now,
  };

  // Try upsert by slug
  await db('products')
    .insert({ id: db.raw('gen_random_uuid()'), created_at: now, ...payload })
    .onConflict('slug')
    .merge({ ...payload });
}

async function main() {
  const fileFlagIndex = process.argv.findIndex(a => a === '--file');
  const fileArg = fileFlagIndex !== -1 ? process.argv[fileFlagIndex + 1] : undefined;
  const filePath = fileArg || path.resolve(__dirname, '../data/products.csv');

  if (!fs.existsSync(filePath)) {
    console.error(`CSV file not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const records = parse(content, { columns: true, skip_empty_lines: true }) as CsvRow[];

  let imported = 0;
  for (const rec of records) {
    if (!rec.name || !rec.name.trim()) continue;
    await upsertProduct(rec);
    imported++;
  }

  console.log(`Imported/updated ${imported} products from CSV.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});

