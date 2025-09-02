/**
 * Add auto_purchase JSONB to watches
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  const hasColumn = await knex.schema.hasColumn('watches', 'auto_purchase');
  if (!hasColumn) {
    await knex.schema.alterTable('watches', (table) => {
      table.jsonb('auto_purchase').defaultTo(JSON.stringify({}));
    });
  }
};

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  const hasColumn = await knex.schema.hasColumn('watches', 'auto_purchase');
  if (hasColumn) {
    await knex.schema.alterTable('watches', (table) => {
      table.dropColumn('auto_purchase');
    });
  }
};

