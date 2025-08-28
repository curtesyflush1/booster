/**
 * Add user roles to existing users table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .alterTable('users', function (table) {
      table.enu('role', ['user', 'admin', 'super_admin']).defaultTo('user').notNullable();
      table.timestamp('last_admin_login').nullable();
      table.jsonb('admin_permissions').defaultTo('[]').notNullable();
      
      table.index('role');
      table.index('last_admin_login');
    });
};

/**
 * Remove user roles from users table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .alterTable('users', function (table) {
      table.dropIndex(['role']);
      table.dropIndex(['last_admin_login']);
      table.dropColumn('role');
      table.dropColumn('last_admin_login');
      table.dropColumn('admin_permissions');
    });
};