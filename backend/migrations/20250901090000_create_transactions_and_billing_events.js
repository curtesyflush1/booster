/**
 * Create transactions and billing_events tables
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // transactions table
  await knex.schema.createTable('transactions', function (table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('product_id').notNullable();
    table.string('retailer_slug', 100).notNullable();
    table.uuid('rule_id').nullable();
    table.string('user_id_hash', 200).notNullable();
    table.string('status', 32).notNullable(); // attempted | carted | purchased | failed
    table.decimal('price_paid', 10, 2).nullable();
    table.decimal('msrp', 10, 2).nullable();
    table.integer('qty').notNullable().defaultTo(1);
    table.timestamp('alert_at').nullable();
    table.timestamp('added_to_cart_at').nullable();
    table.timestamp('purchased_at').nullable();
    table.integer('lead_time_ms').nullable();
    table.text('failure_reason').nullable();
    table.string('region', 64).nullable();
    table.string('session_fingerprint', 255).nullable();
    table.timestamps(true, true);
  });

  await knex.raw("CREATE INDEX IF NOT EXISTS idx_transactions_user_hash ON transactions(user_id_hash)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_transactions_product ON transactions(product_id)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_transactions_retailer ON transactions(retailer_slug)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)");

  // billing_events table
  await knex.schema.createTable('billing_events', function (table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('stripe_customer_id', 255).notNullable();
    table.string('subscription_id', 255).nullable();
    table.string('event_type', 100).notNullable();
    table.integer('amount_cents').nullable();
    table.string('currency', 10).nullable();
    table.string('status', 50).nullable();
    table.string('invoice_id', 255).nullable();
    table.timestamp('occurred_at').notNullable().defaultTo(knex.fn.now());
    table.jsonb('raw_event').nullable();
    table.timestamps(true, true);
  });

  await knex.raw("CREATE INDEX IF NOT EXISTS idx_billing_events_customer ON billing_events(stripe_customer_id)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_billing_events_subscription ON billing_events(subscription_id)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_billing_events_invoice ON billing_events(invoice_id)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_billing_events_type ON billing_events(event_type)");
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('billing_events');
  await knex.schema.dropTableIfExists('transactions');
};

