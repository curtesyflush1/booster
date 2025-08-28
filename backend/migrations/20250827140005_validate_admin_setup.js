/**
 * Validation migration to ensure admin setup is correct
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Validate that all required tables exist
  const requiredTables = [
    'users',
    'admin_audit_log', 
    'ml_models',
    'ml_training_data',
    'system_metrics'
  ];

  for (const table of requiredTables) {
    const exists = await knex.schema.hasTable(table);
    if (!exists) {
      throw new Error(`Required table '${table}' does not exist`);
    }
  }

  // Validate that users table has required columns
  const userColumns = await knex('information_schema.columns')
    .where({ table_name: 'users' })
    .select('column_name');
  
  const requiredUserColumns = ['role', 'admin_permissions', 'last_admin_login'];
  const existingColumns = userColumns.map(col => col.column_name);
  
  for (const column of requiredUserColumns) {
    if (!existingColumns.includes(column)) {
      throw new Error(`Required column '${column}' does not exist in users table`);
    }
  }

  // Create default admin user if none exists
  const adminExists = await knex('users').where('role', 'admin').first();
  if (!adminExists) {
    console.log('Creating default admin user...');
    // This would be handled by a seed file in practice
  }

  console.log('Admin setup validation completed successfully');
};

/**
 * No rollback needed for validation
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return Promise.resolve();
};