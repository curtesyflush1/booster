import dotenv from 'dotenv';
dotenv.config();

import { db } from '../src/config/database';

async function main() {
  const slug = 'gamestop';
  const existing = await db('retailers').where({ slug }).first();
  if (existing) {
    console.log('Retailer already present:', { id: existing.id, name: existing.name, slug: existing.slug });
    process.exit(0);
  }

  const [row] = await db('retailers')
    .insert({
      id: db.raw('gen_random_uuid()'),
      name: 'GameStop',
      slug,
      website_url: 'https://www.gamestop.com',
      api_type: 'scraping',
      api_config: JSON.stringify({ base_url: 'https://www.gamestop.com' }),
      is_active: true,
      rate_limit_per_minute: 30,
      health_score: 80,
      supported_features: JSON.stringify(['price_tracking']),
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    })
    .returning('*');

  console.log('Inserted retailer:', { id: row.id, name: row.name, slug: row.slug });
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to insert GameStop retailer:', err);
  process.exit(1);
});

