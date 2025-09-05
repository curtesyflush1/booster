/**
 * Add idempotency key to transactions to enforce uniqueness of duplicate jobs.
 * @param { import('knex').Knex } knex
 */
exports.up = async function up(knex) {
  const has = await knex.schema.hasColumn('transactions', 'idem_key');
  if (!has) {
    await knex.schema.alterTable('transactions', (table) => {
      table.string('idem_key').nullable();
    });
  }
  try {
    await knex.raw("CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_idem_key ON transactions(idem_key) WHERE idem_key IS NOT NULL");
  } catch (e) {
    // ignore
  }
};

/**
 * @param { import('knex').Knex } knex
 */
exports.down = async function down(knex) {
  try {
    await knex.raw('DROP INDEX IF EXISTS uq_transactions_idem_key');
  } catch (e) {}
  const has = await knex.schema.hasColumn('transactions', 'idem_key');
  if (has) {
    await knex.schema.alterTable('transactions', (table) => {
      table.dropColumn('idem_key');
    });
  }
};

