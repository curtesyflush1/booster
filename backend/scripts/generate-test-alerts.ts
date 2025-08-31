import { db } from '../src/config/database';
import { Alert } from '../src/models/Alert';
import { IAlert } from '../src/types/database';

async function main() {
  try {
    // Optionally target a specific user via env or CLI arg: --email=user@example.com
    const cliArg = process.argv.find(a => a.startsWith('--email='));
    const envEmail = process.env.ALERTS_USER_EMAIL;
    const targetEmail = cliArg ? cliArg.split('=')[1] : envEmail;

    // Pick the target user or fall back to first user (admin seed should exist)
    const user = targetEmail
      ? await db('users').select('id', 'email').where('email', targetEmail).first()
      : await db('users').select('id', 'email').orderBy('created_at', 'asc').first();
    if (!user) {
      console.error('No matching user found. Provide ALERTS_USER_EMAIL or --email=<addr>, or seed users first.');
      process.exit(1);
    }

    // Pick a product and a retailer for realistic data
    const product = await db('products').select('id', 'name', 'slug').first();
    const retailer = await db('retailers').select('id', 'name', 'slug').first();
    if (!product || !retailer) {
      console.error('Missing product or retailer. Seed catalog first.');
      process.exit(1);
    }

    const now = new Date();
    const alerts: Partial<IAlert>[] = [
      {
        user_id: user.id,
        product_id: product.id,
        retailer_id: retailer.id,
        type: 'restock',
        priority: 'high',
        status: 'sent',
        data: {
          product_name: product.name,
          retailer_name: retailer.name,
          availability_status: 'in_stock',
          product_url: `https://example.com/${product.slug}`,
          cart_url: `https://example.com/${product.slug}/cart`,
          price: 39.99
        } as any,
        sent_at: now
      },
      {
        user_id: user.id,
        product_id: product.id,
        retailer_id: retailer.id,
        type: 'price_drop',
        priority: 'medium',
        status: 'sent',
        data: {
          product_name: product.name,
          retailer_name: retailer.name,
          availability_status: 'in_stock',
          product_url: `https://example.com/${product.slug}`,
          price: 34.99,
          price_change: { percent_change: -12.5 }
        } as any,
        sent_at: new Date(now.getTime() - 1000 * 60 * 60)
      },
      {
        user_id: user.id,
        product_id: product.id,
        retailer_id: retailer.id,
        type: 'low_stock',
        priority: 'urgent',
        status: 'pending',
        data: {
          product_name: product.name,
          retailer_name: retailer.name,
          availability_status: 'low_stock',
          product_url: `https://example.com/${product.slug}`
        } as any,
        // omit delivery_channels to use default []
      }
    ];

    for (const a of alerts) {
      const created = await Alert.createAlert(a);
      console.log('Created alert', created.id, created.type, created.priority);
    }

    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to generate test alerts:', err);
    process.exit(1);
  }
}

main();
