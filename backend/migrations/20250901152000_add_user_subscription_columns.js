/**
 * Add subscription-related columns to users table
 * @param { import('knex').Knex } knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('users', function (table) {
    table.string('stripe_customer_id', 255).unique().nullable();
    table.string('subscription_id', 255).unique().nullable();
    table.string('subscription_status', 50).nullable();
    table.timestamp('subscription_start_date').nullable();
    table.timestamp('subscription_end_date').nullable();
    table.timestamp('trial_end_date').nullable();
    table.boolean('cancel_at_period_end').notNullable().defaultTo(false);
  });

  // helpful indexes
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status)');
};

/**
 * @param { import('knex').Knex } knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('users', function (table) {
    table.dropColumn('stripe_customer_id');
    table.dropColumn('subscription_id');
    table.dropColumn('subscription_status');
    table.dropColumn('subscription_start_date');
    table.dropColumn('subscription_end_date');
    table.dropColumn('trial_end_date');
    table.dropColumn('cancel_at_period_end');
  });
};

