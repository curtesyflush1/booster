/**
 * Add missing user fields that were somehow dropped
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .alterTable('users', function (table) {
      // Check if columns exist first, then add if missing
      table.string('first_name');
      table.string('last_name');
      table.jsonb('preferences').defaultTo(JSON.stringify({}));
    });
};

/**
 * Rollback missing user fields
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .alterTable('users', function (table) {
      table.dropColumn('first_name');
      table.dropColumn('last_name');
      table.dropColumn('preferences');
    });
};