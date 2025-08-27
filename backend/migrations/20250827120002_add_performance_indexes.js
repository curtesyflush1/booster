/**
 * Add performance indexes for subscription system
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // Add performance indexes to users table
    .alterTable('users', function (table) {
      table.index(['subscription_tier', 'subscription_status'], 'idx_users_subscription_tier_status');
      table.index(['subscription_status', 'subscription_end_date'], 'idx_users_status_end_date');
      table.index(['trial_end_date'], 'idx_users_trial_end_date');
    })
    
    // Add performance indexes to subscription_usage table
    .alterTable('subscription_usage', function (table) {
      table.index(['usage_date', 'usage_type'], 'idx_usage_date_type');
      table.index(['user_id', 'usage_type', 'created_at'], 'idx_usage_user_type_created');
    })
    
    // Add performance indexes to billing_events table
    .alterTable('billing_events', function (table) {
      table.index(['user_id', 'event_type', 'event_date'], 'idx_billing_user_type_date');
      table.index(['event_type', 'created_at'], 'idx_billing_type_created');
    })
    
    // Add performance indexes to conversion_analytics table
    .alterTable('conversion_analytics', function (table) {
      table.index(['event_type', 'event_date'], 'idx_conversion_type_date');
      table.index(['source', 'medium', 'event_date'], 'idx_conversion_source_medium_date');
      table.index(['user_id', 'event_type'], 'idx_conversion_user_type');
    });
};

/**
 * Rollback performance indexes
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    // Drop indexes from users table
    .alterTable('users', function (table) {
      table.dropIndex(['subscription_tier', 'subscription_status'], 'idx_users_subscription_tier_status');
      table.dropIndex(['subscription_status', 'subscription_end_date'], 'idx_users_status_end_date');
      table.dropIndex(['trial_end_date'], 'idx_users_trial_end_date');
    })
    
    // Drop indexes from subscription_usage table
    .alterTable('subscription_usage', function (table) {
      table.dropIndex(['usage_date', 'usage_type'], 'idx_usage_date_type');
      table.dropIndex(['user_id', 'usage_type', 'created_at'], 'idx_usage_user_type_created');
    })
    
    // Drop indexes from billing_events table
    .alterTable('billing_events', function (table) {
      table.dropIndex(['user_id', 'event_type', 'event_date'], 'idx_billing_user_type_date');
      table.dropIndex(['event_type', 'created_at'], 'idx_billing_type_created');
    })
    
    // Drop indexes from conversion_analytics table
    .alterTable('conversion_analytics', function (table) {
      table.dropIndex(['event_type', 'event_date'], 'idx_conversion_type_date');
      table.dropIndex(['source', 'medium', 'event_date'], 'idx_conversion_source_medium_date');
      table.dropIndex(['user_id', 'event_type'], 'idx_conversion_user_type');
    });
};