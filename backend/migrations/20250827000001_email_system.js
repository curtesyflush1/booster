/**
 * Email system migration
 * Creates tables for email preferences, delivery tracking, bounces, and complaints
 */

exports.up = function(knex) {
  return Promise.all([
    // Email preferences table
    knex.schema.createTable('email_preferences', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.boolean('alert_emails').defaultTo(true);
      table.boolean('marketing_emails').defaultTo(true);
      table.boolean('weekly_digest').defaultTo(true);
      table.string('unsubscribe_token').notNullable().unique();
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['unsubscribe_token']);
    }),

    // Email delivery logs table
    knex.schema.createTable('email_delivery_logs', function(table) {
      table.string('id').primary();
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.uuid('alert_id').nullable().references('id').inTable('alerts').onDelete('SET NULL');
      table.enum('email_type', ['alert', 'welcome', 'marketing', 'digest', 'system']).notNullable();
      table.string('recipient_email').notNullable();
      table.string('subject').notNullable();
      table.string('message_id').nullable();
      table.timestamp('sent_at').notNullable();
      table.timestamp('delivered_at').nullable();
      table.timestamp('bounced_at').nullable();
      table.timestamp('complained_at').nullable();
      table.text('bounce_reason').nullable();
      table.text('complaint_reason').nullable();
      table.jsonb('metadata').nullable();
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['alert_id']);
      table.index(['message_id']);
      table.index(['sent_at']);
      table.index(['email_type']);
    }),

    // Unsubscribe tokens table
    knex.schema.createTable('unsubscribe_tokens', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('token').notNullable().unique();
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.enum('email_type', ['all', 'alerts', 'marketing', 'digest']).notNullable();
      table.timestamp('expires_at').notNullable();
      table.timestamp('used_at').nullable();
      table.timestamps(true, true);
      
      table.index(['token']);
      table.index(['user_id']);
      table.index(['expires_at']);
    }),

    // Email bounces table
    knex.schema.createTable('email_bounces', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('message_id').notNullable();
      table.enum('bounce_type', ['permanent', 'transient']).notNullable();
      table.string('bounce_sub_type').notNullable();
      table.jsonb('bounced_recipients').notNullable();
      table.timestamp('timestamp').notNullable();
      table.timestamps(true, true);
      
      table.index(['message_id']);
      table.index(['bounce_type']);
      table.index(['timestamp']);
    }),

    // Email complaints table
    knex.schema.createTable('email_complaints', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('message_id').notNullable();
      table.jsonb('complained_recipients').notNullable();
      table.string('feedback_type').nullable();
      table.timestamp('timestamp').notNullable();
      table.timestamps(true, true);
      
      table.index(['message_id']);
      table.index(['timestamp']);
    })
  ]);
};

exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('email_complaints'),
    knex.schema.dropTableIfExists('email_bounces'),
    knex.schema.dropTableIfExists('unsubscribe_tokens'),
    knex.schema.dropTableIfExists('email_delivery_logs'),
    knex.schema.dropTableIfExists('email_preferences')
  ]);
};