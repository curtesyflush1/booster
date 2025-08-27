/**
 * Add usage aggregation table for better performance
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // Create daily usage aggregation table
    .createTable('daily_usage_summary', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.date('usage_date').notNullable();
      table.integer('watches_created').notNullable().defaultTo(0);
      table.integer('alerts_sent').notNullable().defaultTo(0);
      table.integer('api_calls').notNullable().defaultTo(0);
      table.integer('sms_sent').notNullable().defaultTo(0);
      table.integer('discord_sent').notNullable().defaultTo(0);
      table.timestamp('last_updated').notNullable().defaultTo(knex.fn.now());
      table.timestamps(true, true);
      
      // Unique constraint to prevent duplicates
      table.unique(['user_id', 'usage_date'], 'unique_user_daily_usage');
      
      // Indexes for common queries
      table.index('user_id');
      table.index('usage_date');
      table.index(['user_id', 'usage_date']);
      
      // Constraints
      table.check('watches_created_non_negative', knex.raw('watches_created >= 0'));
      table.check('alerts_sent_non_negative', knex.raw('alerts_sent >= 0'));
      table.check('api_calls_non_negative', knex.raw('api_calls >= 0'));
      table.check('sms_sent_non_negative', knex.raw('sms_sent >= 0'));
      table.check('discord_sent_non_negative', knex.raw('discord_sent >= 0'));
    });
};

/**
 * Rollback usage aggregation table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('daily_usage_summary');
};