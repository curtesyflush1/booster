/**
 * Create admin audit log table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('admin_audit_log', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('admin_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('action', 100).notNullable();
      table.string('target_type', 50).nullable();
      table.string('target_id', 255).nullable();
      table.jsonb('details').defaultTo('{}').notNullable();
      table.string('ip_address', 45).nullable();
      table.text('user_agent').nullable();
      table.timestamps(true, true);
      
      // Composite indexes for better query performance
      table.index(['admin_user_id', 'created_at']);
      table.index(['action', 'created_at']);
      table.index(['target_type', 'target_id']);
      table.index('created_at');
      
      // Data integrity constraint
      table.check('(target_type IS NULL AND target_id IS NULL) OR (target_type IS NOT NULL AND target_id IS NOT NULL)');
    });
};

/**
 * Drop admin audit log table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('admin_audit_log');
};