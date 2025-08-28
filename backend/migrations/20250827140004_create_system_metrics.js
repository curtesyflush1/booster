/**
 * Create system metrics table for performance monitoring
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('system_metrics', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('metric_name', 100).notNullable();
      table.enu('metric_type', ['gauge', 'counter', 'histogram', 'summary']).notNullable();
      table.decimal('value', 15, 6).notNullable();
      table.jsonb('labels').defaultTo('{}').notNullable();
      table.timestamp('recorded_at').defaultTo(knex.fn.now()).notNullable();
      
      // Optimized indexes for time-series queries
      table.index(['metric_name', 'recorded_at']);
      table.index(['metric_type', 'recorded_at']);
      table.index('recorded_at');
    });
};

/**
 * Drop system metrics table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('system_metrics');
};