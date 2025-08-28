/**
 * Add user roles and admin functionality
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // Add role column to users table
    .alterTable('users', function (table) {
      table.enu('role', ['user', 'admin', 'super_admin']).defaultTo('user').notNullable();
      table.timestamp('last_admin_login').nullable();
      table.jsonb('admin_permissions').defaultTo('[]').notNullable();
      
      table.index('role');
      table.index('last_admin_login');
    })
    
    // Create admin_audit_log table for tracking admin actions
    .createTable('admin_audit_log', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('admin_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('action', 100).notNullable(); // e.g., 'user_suspended', 'ml_model_trained'
      table.string('target_type', 50).nullable(); // e.g., 'user', 'ml_model', 'system'
      table.string('target_id', 255).nullable(); // ID of the affected entity
      table.jsonb('details').defaultTo('{}').notNullable(); // Action-specific details
      table.string('ip_address', 45).nullable(); // IPv6 support
      table.text('user_agent').nullable();
      table.timestamps(true, true);
      
      // Composite indexes for better query performance
      table.index(['admin_user_id', 'created_at']);
      table.index(['action', 'created_at']);
      table.index(['target_type', 'target_id']);
      table.index('created_at'); // For time-based queries
      
      // Add constraint to ensure target_type and target_id are both null or both not null
      table.check('(target_type IS NULL AND target_id IS NULL) OR (target_type IS NOT NULL AND target_id IS NOT NULL)');
    })
    
    // Create ml_models table for tracking ML model versions and training
    .createTable('ml_models', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name', 100).notNullable(); // e.g., 'price_prediction', 'sellout_risk'
      table.string('version', 50).notNullable();
      table.enu('status', ['training', 'active', 'deprecated', 'failed']).defaultTo('training').notNullable();
      table.jsonb('config').defaultTo('{}').notNullable(); // Model configuration
      table.jsonb('metrics').defaultTo('{}').notNullable(); // Performance metrics
      table.string('model_path', 500).nullable(); // Path to stored model file
      table.timestamp('training_started_at').nullable();
      table.timestamp('training_completed_at').nullable();
      table.timestamp('deployed_at').nullable();
      table.uuid('trained_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.text('training_notes').nullable();
      table.timestamps(true, true);
      
      // Composite indexes for better performance
      table.index(['name', 'status', 'created_at']);
      table.index(['status', 'deployed_at']);
      table.index('trained_by');
      
      // Unique constraint for active models of the same name
      table.unique(['name', 'version']);
      
      // Check constraints for data integrity
      table.check("status != 'active' OR deployed_at IS NOT NULL");
      table.check("status != 'training' OR training_started_at IS NOT NULL");
    })
    
    // Create ml_training_data table for managing training datasets
    .createTable('ml_training_data', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('dataset_name', 200).notNullable();
      table.string('data_type', 100).notNullable(); // e.g., 'price_history', 'availability_patterns'
      table.jsonb('data').notNullable(); // The actual training data
      table.enu('status', ['pending', 'approved', 'rejected']).defaultTo('pending').notNullable();
      table.uuid('reviewed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('reviewed_at').nullable();
      table.text('review_notes').nullable();
      table.timestamps(true, true);
      
      // Composite indexes for better query performance
      table.index(['status', 'data_type', 'created_at']);
      table.index(['dataset_name', 'data_type']);
      table.index('reviewed_by');
      
      // Check constraint to ensure reviewed data has reviewer and timestamp
      table.check("status = 'pending' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)");
    })
    
    // Create system_metrics table for storing system performance data
    .createTable('system_metrics', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('metric_name', 100).notNullable(); // e.g., 'api_response_time', 'alert_delivery_rate'
      table.enu('metric_type', ['gauge', 'counter', 'histogram', 'summary']).notNullable();
      table.decimal('value', 15, 6).notNullable();
      table.jsonb('labels').defaultTo('{}').notNullable(); // Metric labels/tags
      table.timestamp('recorded_at').defaultTo(knex.fn.now()).notNullable();
      
      // Optimized indexes for time-series queries
      table.index(['metric_name', 'recorded_at']);
      table.index(['metric_type', 'recorded_at']);
      table.index('recorded_at'); // For cleanup operations
      
      // Partial index for recent metrics (last 30 days) for better performance
      // Note: This would be added in a separate migration or raw SQL
    });
};

/**
 * Rollback user roles and admin functionality
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    // Drop new tables
    .dropTableIfExists('system_metrics')
    .dropTableIfExists('ml_training_data')
    .dropTableIfExists('ml_models')
    .dropTableIfExists('admin_audit_log')
    
    // Remove role columns from users table
    .alterTable('users', function (table) {
      table.dropIndex('role');
      table.dropColumn('role');
      table.dropColumn('last_admin_login');
      table.dropColumn('admin_permissions');
    });
};