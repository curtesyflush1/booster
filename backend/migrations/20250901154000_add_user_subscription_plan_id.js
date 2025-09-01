/**
 * Add subscription_plan_id to users table to track specific plan/price
 * @param { import('knex').Knex } knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('users', function (table) {
    table.string('subscription_plan_id', 255).nullable().index();
  });
};

/**
 * @param { import('knex').Knex } knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('users', function (table) {
    table.dropColumn('subscription_plan_id');
  });
};

