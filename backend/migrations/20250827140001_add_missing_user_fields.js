/**
 * Add missing user fields that were somehow dropped
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Add columns only if they do not already exist
  const hasFirstName = await knex.schema.hasColumn('users', 'first_name');
  if (!hasFirstName) {
    await knex.schema.alterTable('users', function (table) {
      table.string('first_name');
    });
  }

  const hasLastName = await knex.schema.hasColumn('users', 'last_name');
  if (!hasLastName) {
    await knex.schema.alterTable('users', function (table) {
      table.string('last_name');
    });
  }

  const hasPreferences = await knex.schema.hasColumn('users', 'preferences');
  if (!hasPreferences) {
    await knex.schema.alterTable('users', function (table) {
      // Ensure default is jsonb empty object
      table.jsonb('preferences').defaultTo(knex.raw(`'{}'::jsonb`));
    });
  }
};

/**
 * Rollback missing user fields
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const dropIfExists = async (column) => {
    const exists = await knex.schema.hasColumn('users', column);
    if (exists) {
      await knex.schema.alterTable('users', function (table) {
        table.dropColumn(column);
      });
    }
  };

  await dropIfExists('first_name');
  await dropIfExists('last_name');
  await dropIfExists('preferences');
};
