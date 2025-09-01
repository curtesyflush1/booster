/**
 * Create conversion_analytics table for tracking subscription conversions
 * @param { import('knex').Knex } knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('conversion_analytics', function (table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().index();
    table.string('event_type').notNullable().index();
    table.string('source').defaultTo('direct');
    table.string('medium').defaultTo('organic');
    table.string('campaign').nullable();
    table.jsonb('metadata').defaultTo({});
    table.timestamp('event_date').defaultTo(knex.fn.now()).index();
  });
};

/**
 * @param { import('knex').Knex } knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('conversion_analytics');
};

