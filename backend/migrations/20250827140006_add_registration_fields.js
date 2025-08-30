/**
 * Add missing registration fields
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .alterTable('users', function (table) {
      // Add newsletter subscription field
      table.boolean('newsletter_subscription').defaultTo(false);
      // Add terms accepted field
      table.boolean('terms_accepted').defaultTo(false);
    });
};

/**
 * Rollback registration fields
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .alterTable('users', function (table) {
      table.dropColumn('newsletter_subscription');
      table.dropColumn('terms_accepted');
    });
};
