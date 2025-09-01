import dotenv from 'dotenv';
dotenv.config();

import { transactionService } from '../src/services/transactionService';
import { billingEventService } from '../src/services/billingEventService';
import { redisService } from '../src/services/redisService';

async function main() {
  await redisService.connect();

  // Emit a sample purchase attempt
  await transactionService.recordPurchaseAttempt({
    product_id: '11111111-1111-1111-1111-111111111111',
    retailer_slug: 'best-buy',
    user_id_hash: 'userhash-example',
    qty: 1,
    alert_at: new Date().toISOString(),
  });

  // Emit a sample billing event
  await billingEventService.recordAndEmit({
    stripe_customer_id: 'cus_TEST123',
    subscription_id: 'sub_TEST123',
    event_type: 'invoice.payment_succeeded',
    amount_cents: 2000,
    currency: 'usd',
    status: 'succeeded',
    invoice_id: 'in_TEST123',
    occurred_at: new Date().toISOString(),
    raw_event: { id: 'evt_TEST', type: 'invoice.payment_succeeded' }
  });

  process.stdout.write('Test events emitted.\n');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

