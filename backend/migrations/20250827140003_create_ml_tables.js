/**
 * Create ML-related tables
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // Create ml_models table
    .createTable('ml_models', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name', 100).notNullable();
      table.string('version', 50).notNullable();
      table.enu('status', ['training', 'active', 'deprecated', 'failed']).defaultTo('training').notNullable();
      table.jsonb('config').defaultTo('{}').notNullable();
      table.jsonb('metrics').defaultTo('{}').notNullable();
      table.string('model_path', 500).nullable();
      table.timestamp('training_started_at').nullable();
      table.timestamp('training_completed_at').nullable();
      table.timestamp('deployed_at').nullable();
      table.uuid('trained_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.text('training_notes').nullable();
      table.timestamps(true, true);
      
      // Indexes and constraints
      table.index(['name', 'status', 'created_at']);
      table.index(['status', 'deployed_at']);
      table.index('trained_by');
      table.unique(['name', 'version']);
      
      // Business logic constraints
      table.check("status != 'active' OR deployed_at IS NOT NULL");
      table.check("status != 'training' OR training_started_at IS NOT NULL");
    })
    
    // Create ml_training_data table
    .createTable('ml_training_data', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('dataset_name', 200).notNullable();
      table.string('data_type', 100).notNullable();
      table.jsonb('data').notNullable();
      table.enu('status', ['pending', 'approved', 'rejected']).defaultTo('pending').notNullable();
      table.uuid('reviewed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('reviewed_at').nullable();
      table.text('review_notes').nullable();
      table.timestamps(true, true);
      
      // Indexes and constraints
      table.index(['status', 'data_type', 'created_at']);
      table.index(['dataset_name', 'data_type']);
      table.index('reviewed_by');
      
      // Ensure reviewed data has reviewer and timestamp
      table.check("status = 'pending' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)");
    });
};

/**
 * Drop ML-related tables
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('ml_training_data')
    .dropTableIfExists('ml_models');
};