/**
 * Create subscription_plans table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('subscription_plans', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name', 100).notNullable();
      table.string('slug', 50).notNullable().unique();
      table.text('description').nullable();
      table.decimal('price', 10, 2).notNullable();
      // Use native enum to avoid parameter bindings in DDL
      table.enu('billing_period', ['monthly', 'yearly'], { useNative: true, enumName: 'billing_period_enum' }).notNullable();
      table.string('stripe_price_id', 255).unique().nullable();
      // Avoid bound parameters in DEFAULT for jsonb by using raw casts
      table.jsonb('features').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
      table.jsonb('limits').notNullable().defaultTo(
        knex.raw(
          `'{"max_watches": null, "max_alerts_per_day": null, "api_rate_limit": null}'::jsonb`
        )
      );
      table.boolean('is_active').notNullable().defaultTo(true);
      table.integer('trial_days').notNullable().defaultTo(0);
      table.timestamps(true, true);
    })
    .then(() => knex.raw('ALTER TABLE subscription_plans ADD CONSTRAINT price_non_negative CHECK (price >= 0)'))
    .then(() => knex.raw('ALTER TABLE subscription_plans ADD CONSTRAINT name_not_empty CHECK (length(trim(name)) > 0)'));
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTable('subscription_plans')
    .then(() => knex.raw('DROP TYPE IF EXISTS billing_period_enum'));
};

