/**
 * Add push_subscriptions column to users table for web push notifications
 */

exports.up = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    // Add push_subscriptions as JSONB column (PostgreSQL) or JSON (other databases)
    if (knex.client.config.client === 'postgresql') {
      table.jsonb('push_subscriptions').defaultTo('[]');
    } else {
      table.json('push_subscriptions').defaultTo('[]');
    }
    
    // Add index for better query performance
    table.index(['id'], 'idx_users_push_subscriptions');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    // Drop the index first
    table.dropIndex(['id'], 'idx_users_push_subscriptions');
    
    // Drop the column
    table.dropColumn('push_subscriptions');
  });
};