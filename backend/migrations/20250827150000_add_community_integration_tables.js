/**
 * Migration to add community and integration features tables
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Discord server configurations table
  await knex.schema.createTable('discord_servers', function (table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('server_id').notNullable();
    table.string('channel_id').notNullable();
    table.text('token'); // Encrypted bot token
    table.jsonb('alert_filters').defaultTo('{}');
    table.boolean('is_active').defaultTo(true);
    table.integer('total_alerts_sent').defaultTo(0);
    table.timestamp('last_alert_sent');
    table.timestamps(true, true);
    
    table.unique(['user_id', 'server_id']);
    table.index(['user_id', 'is_active']);
  });

  // Webhook configurations table
  await knex.schema.createTable('webhooks', function (table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('url').notNullable();
    table.text('secret'); // Encrypted webhook secret
    table.jsonb('events').notNullable(); // Array of event types
    table.jsonb('headers').defaultTo('{}');
    table.jsonb('retry_config').defaultTo('{"maxRetries": 3, "retryDelay": 1000, "backoffMultiplier": 2}');
    table.jsonb('filters').defaultTo('{}');
    table.boolean('is_active').defaultTo(true);
    table.integer('total_calls').defaultTo(0);
    table.integer('successful_calls').defaultTo(0);
    table.integer('failed_calls').defaultTo(0);
    table.timestamp('last_triggered');
    table.timestamps(true, true);
    
    table.index(['user_id', 'is_active']);
  });

  // CSV import/export logs table
  await knex.schema.createTable('csv_operations', function (table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('operation_type', ['import', 'export']).notNullable();
    table.string('filename');
    table.integer('total_rows');
    table.integer('successful_rows');
    table.integer('failed_rows');
    table.jsonb('errors').defaultTo('[]');
    table.enum('status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending');
    table.timestamps(true, true);
    
    table.index(['user_id', 'operation_type']);
    table.index(['created_at']);
  });

  // Social sharing tracking table
  await knex.schema.createTable('social_shares', function (table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('alert_id').references('id').inTable('alerts').onDelete('CASCADE');
    table.string('platform').notNullable();
    table.string('share_type').defaultTo('manual'); // manual, automatic
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('shared_at').defaultTo(knex.fn.now());
    
    table.index(['user_id', 'platform']);
    table.index(['alert_id']);
    table.index(['shared_at']);
  });

  // Community testimonials table
  await knex.schema.createTable('testimonials', function (table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('user_name').notNullable();
    table.string('user_avatar');
    table.text('content').notNullable();
    table.integer('rating').notNullable().checkBetween([1, 5]);
    table.boolean('is_verified').defaultTo(false);
    table.boolean('is_public').defaultTo(true);
    table.boolean('is_featured').defaultTo(false);
    table.jsonb('tags').defaultTo('[]');
    table.jsonb('metadata').defaultTo('{}'); // products_saved, money_saved, etc.
    table.enum('moderation_status', ['pending', 'approved', 'rejected']).defaultTo('pending');
    table.text('moderation_notes');
    table.timestamps(true, true);
    
    table.index(['user_id']);
    table.index(['moderation_status', 'is_public']);
    table.index(['is_featured', 'is_public']);
    table.index(['rating']);
  });

  // Community posts table
  await knex.schema.createTable('community_posts', function (table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('user_name').notNullable();
    table.string('user_avatar');
    table.enum('type', ['success_story', 'tip', 'collection_showcase', 'deal_share', 'question']).notNullable();
    table.string('title').notNullable();
    table.text('content').notNullable();
    table.jsonb('images').defaultTo('[]');
    table.jsonb('tags').defaultTo('[]');
    table.integer('likes').defaultTo(0);
    table.integer('comments_count').defaultTo(0);
    table.boolean('is_public').defaultTo(true);
    table.boolean('is_featured').defaultTo(false);
    table.enum('moderation_status', ['pending', 'approved', 'rejected']).defaultTo('pending');
    table.text('moderation_notes');
    table.timestamps(true, true);
    
    table.index(['user_id']);
    table.index(['type', 'moderation_status']);
    table.index(['is_featured', 'is_public']);
    table.index(['created_at']);
  });

  // Community post comments table
  await knex.schema.createTable('post_comments', function (table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('post_id').notNullable().references('id').inTable('community_posts').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('user_name').notNullable();
    table.string('user_avatar');
    table.text('content').notNullable();
    table.integer('likes').defaultTo(0);
    table.boolean('is_public').defaultTo(true);
    table.enum('moderation_status', ['pending', 'approved', 'rejected']).defaultTo('pending');
    table.timestamps(true, true);
    
    table.index(['post_id', 'moderation_status']);
    table.index(['user_id']);
    table.index(['created_at']);
  });

  // Post likes tracking table
  await knex.schema.createTable('post_likes', function (table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('post_id').notNullable().references('id').inTable('community_posts').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('liked_at').defaultTo(knex.fn.now());
    
    table.unique(['post_id', 'user_id']);
    table.index(['post_id']);
    table.index(['user_id']);
  });

  // Comment likes tracking table
  await knex.schema.createTable('comment_likes', function (table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('comment_id').notNullable().references('id').inTable('post_comments').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('liked_at').defaultTo(knex.fn.now());
    
    table.unique(['comment_id', 'user_id']);
    table.index(['comment_id']);
    table.index(['user_id']);
  });

  console.log('Community and integration tables created successfully');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Drop tables in reverse order to handle foreign key constraints
  await knex.schema.dropTableIfExists('comment_likes');
  await knex.schema.dropTableIfExists('post_likes');
  await knex.schema.dropTableIfExists('post_comments');
  await knex.schema.dropTableIfExists('community_posts');
  await knex.schema.dropTableIfExists('testimonials');
  await knex.schema.dropTableIfExists('social_shares');
  await knex.schema.dropTableIfExists('csv_operations');
  await knex.schema.dropTableIfExists('webhooks');
  await knex.schema.dropTableIfExists('discord_servers');
  
  console.log('Community and integration tables dropped successfully');
};