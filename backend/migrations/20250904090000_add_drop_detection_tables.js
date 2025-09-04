/**
 * Create tables to support drop signal ingestion, URL candidates, features, and outcomes.
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  // drop_events: normalized, append-only stream of detected signals
  await knex.schema.createTable('drop_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    table.uuid('retailer_id').notNullable().references('id').inTable('retailers').onDelete('CASCADE');
    table.string('signal_type').notNullable();
    table.text('signal_value').nullable();
    table.string('source').nullable();
    table.decimal('confidence', 5, 2).nullable();
    table.timestamp('observed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['product_id', 'retailer_id', 'observed_at'], 'idx_drop_events_prod_retailer_time');
    table.index(['signal_type', 'observed_at'], 'idx_drop_events_type_time');
  });

  // drop_outcomes: ground-truth outcomes used to measure performance
  await knex.schema.createTable('drop_outcomes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    table.uuid('retailer_id').notNullable().references('id').inTable('retailers').onDelete('CASCADE');
    table.timestamp('drop_at', { useTz: true }).notNullable();
    table.timestamp('first_seen_at', { useTz: true }).nullable();
    table.timestamp('first_instock_at', { useTz: true }).nullable();
    table.integer('buy_window_sec').nullable();
    table.boolean('success_flag').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['product_id', 'retailer_id', 'drop_at'], 'idx_drop_outcomes_prod_retailer_dropat');
  });

  // model_features: feature vectors and labels for training/evaluation
  await knex.schema.createTable('model_features', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    table.uuid('retailer_id').notNullable().references('id').inTable('retailers').onDelete('CASCADE');
    table.timestamp('as_of', { useTz: true }).notNullable();
    table.jsonb('features').notNullable().defaultTo('{}');
    table.string('label').nullable();
    table.string('split_tag').nullable(); // train/val/test
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['product_id', 'retailer_id', 'as_of'], 'idx_model_features_key');
    table.index(['split_tag'], 'idx_model_features_split');
  });

  // url_candidates: tracked candidate URLs with evolving status and score
  await knex.schema.createTable('url_candidates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    table.uuid('retailer_id').notNullable().references('id').inTable('retailers').onDelete('CASCADE');
    table.string('pattern_id').nullable();
    table.text('url').notNullable();
    table.string('status').notNullable().defaultTo('unknown'); // unknown|valid|invalid|live
    table.decimal('score', 6, 3).nullable();
    table.text('reason').nullable();
    table.timestamp('first_seen_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('last_checked_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['product_id', 'retailer_id'], 'idx_url_candidates_prod_retailer');
    table.index(['retailer_id', 'status'], 'idx_url_candidates_retailer_status');
    table.unique(['retailer_id', 'url'], 'uq_url_candidates_retailer_url');
  });
};

/**
 * Drop all newly created tables
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('url_candidates');
  await knex.schema.dropTableIfExists('model_features');
  await knex.schema.dropTableIfExists('drop_outcomes');
  await knex.schema.dropTableIfExists('drop_events');
};

